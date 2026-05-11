const http = require('http');
const InfuxDbMetrics = require('./influxdb-metrics')
const influxDB = new InfuxDbMetrics();

let config = null;
let sentRequests = 0;
let completedRequests = 0;
let pendingRequests = new Map();
let intervalId = null;

function emit(message) {
    if (process.send) {
        process.send(message);
    } else {
        process.stdout.write(`${JSON.stringify(message)}\n`);
    }
}

process.on('message', (message) => {
    if (message.id !== undefined) {
        config = message;
        start();
    }
});

function generateInput() {
    const algorithms = ['bubble-sort', 'fibonacci', 'permutations'];
    return algorithms[Math.floor(Math.random() * algorithms.length)];
}

function sendRequest() {
    const algorithm = generateInput();
    sentRequests++;
    
    emit({ type: 'SENT' });
    
    const requestId = sentRequests;
    const requestStartTime = Date.now();
    const requestStartHr = process.hrtime.bigint();
    
    pendingRequests.set(requestId, { startTime: requestStartTime });
    
    const endpoints = {
        1: 'server-side',
        2: 'client-side',
        3: 'dynamic'
    };
    
    const url = `${config.serverUrl}/api/${endpoints[config.testCase]}/${algorithm}`;
    
    const req = http.get(url, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', async () => {
            const endHrBeforeParse = process.hrtime.bigint();
            const networkTimeMs = Number(endHrBeforeParse - requestStartHr) / 1e6;
            try {
                const response = JSON.parse(data);
                let redirected = false;
                let outcome = (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) ? 'ok' : 'http_error';
                let totalTimeMs = Number(process.hrtime.bigint() - requestStartHr) / 1e6;

                if (response.executedOn === 'client') {
                    redirected = true;
                    const clientStartHr = process.hrtime.bigint();
                    try {
                        const fn = new Function('return ' + response.functionSource)();
                        fn(response.inputData);
                    } catch (e) {
                        outcome = 'client_exec_error';
                    }
                    const clientComputeMs = Number(process.hrtime.bigint() - clientStartHr) / 1e6;
                    // total = network-to-end + client compute (client compute happens after response)
                    totalTimeMs = Number(process.hrtime.bigint() - requestStartHr) / 1e6;
                    // If function failed quickly, still include compute time in total.
                    // (Already included in wall totalTimeMs, kept for clarity)
                    void clientComputeMs;
                }
                
                completedRequests++;
                pendingRequests.delete(requestId);
                
                emit({
                    type: 'METRIC',
                    responseTime: totalTimeMs,
                    redirected: redirected,
                    outcome,
                    httpStatus: res.statusCode
                });

				influxDB.sendMetric(totalTimeMs, redirected, config.testCase, config.runId);
                
                checkIfShouldExit();
                
            } catch (error) {
                // JSON не распарсился или другой runtime error в обработке ответа.
                completedRequests++;
                pendingRequests.delete(requestId);

                emit({
                    type: 'METRIC',
                    responseTime: networkTimeMs,
                    redirected: false,
                    outcome: 'parse_error',
                    httpStatus: res.statusCode
                });
                checkIfShouldExit();
            }
        });
    });
    
    req.on('error', (error) => {
        completedRequests++;
        pendingRequests.delete(requestId);

        emit({
            type: 'METRIC',
            responseTime: Date.now() - requestStartTime,
            redirected: false,
            outcome: 'network_error',
            errorCode: error && error.code ? String(error.code) : undefined,
            errorMessage: error && error.message ? String(error.message) : undefined
        });
        checkIfShouldExit();
    });
    
    req.setTimeout(300000, () => {
        req.destroy();
        completedRequests++;
        pendingRequests.delete(requestId);

        emit({
            type: 'METRIC',
            responseTime: Date.now() - requestStartTime,
            redirected: false,
            outcome: 'timeout',
            errorCode: 'REQUEST_TIMEOUT'
        });
        checkIfShouldExit();
    });
}

let sendingStopped = false;
let processExiting = false;

function checkIfShouldExit() {
    if (sendingStopped && pendingRequests.size === 0 && !processExiting) {
        processExiting = true;
        process.exit(0);
    }
}

function start() {
    if (!config || typeof config.rps !== 'number' || config.rps <= 0) {
        // Нечего отправлять — завершаемся по таймеру, чтобы orchestrator не зависал.
        setTimeout(() => process.exit(0), (config?.duration || 0) * 1000);
        return;
    }

    const configuredStartAt = Number(config.startAt || 0);
    if (configuredStartAt > Date.now()) {
        setTimeout(start, configuredStartAt - Date.now());
        return;
    }

    // setInterval заметно дрейфует под нагрузкой и даёт смещения по количеству запросов.
    // Делаем планировщик с коррекцией дрейфа: следующий тик всегда привязан к "идеальному" расписанию.
    const intervalMs = 1000 / config.rps;
    const startTime = Date.now();
    const endTime = startTime + (config.duration * 1000);
    let tick = 0;

    emit({
        type: 'STARTED',
        vuId: config.id,
        startedAt: startTime
    });

    const scheduleNext = () => {
        const plannedAt = startTime + (tick * intervalMs);
        const delay = Math.max(0, plannedAt - Date.now());

        intervalId = setTimeout(() => {
            const now = Date.now();
            if (now >= endTime) {
                sendingStopped = true;
                checkIfShouldExit();
                return;
            }

            tick++;
            sendRequest();
            scheduleNext();
        }, delay);
    };

    scheduleNext();
}

process.on('uncaughtException', (err) => {
    if (intervalId) clearInterval(intervalId);
    emit({
        type: 'METRIC',
        responseTime: 0,
        redirected: false,
        outcome: 'runtime_error',
        errorCode: err && err.code ? String(err.code) : 'UNCAUGHT_EXCEPTION',
        errorMessage: err && err.message ? String(err.message) : String(err)
    });
    process.exit(1);
});

if (!process.send) {
    config = {
        id: Number(process.env.VU_ID || 0),
        serverUrl: process.env.SERVER_URL || 'http://backend:8080',
        rps: Number(process.env.RPS || 1),
        duration: Number(process.env.DURATION || 60),
        testCase: Number(process.env.TEST_CASE || 3),
        runId: process.env.RUN_ID || `manual_${Date.now()}`,
        startAt: Number(process.env.START_AT || 0)
    };

    start();
}