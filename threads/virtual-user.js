const http = require('http');
const InfuxDbMetrics = require('./influxdb-metrics')
const influxDB = new InfuxDbMetrics();

let config = null;
let sentRequests = 0;
let completedRequests = 0;
let pendingRequests = new Map();
let intervalId = null;

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
    
    if (process.send) {
        process.send({ type: 'SENT' });
    }
    
    const requestId = sentRequests;
    const requestStartTime = Date.now();
    
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
            const networkTime = Date.now() - requestStartTime;
            try {
                const response = JSON.parse(data);
                let totalTime = networkTime;
                let redirected = false;

                if (response.executedOn === 'client') {
                    const clientStart = Date.now();
                    const fn = new Function('return ' + response.functionSource)();
                    redirected = true;

                    await new Promise(resolve => {
                      setTimeout(() => resolve(fn(response.inputData)), 6000)
                    })

                    totalTime += (Date.now() - clientStart);
                }
                
                completedRequests++;
                pendingRequests.delete(requestId);
                
                if (process.send) {
                    process.send({
                        type: 'METRIC',
                        responseTime: totalTime,
                        redirected: redirected,
                        outcome: (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) ? 'ok' : 'http_error',
                        httpStatus: res.statusCode
                    });
                }

				influxDB.sendMetric(totalTime, redirected, config.testCase, config.runId);
                
                checkIfShouldExit();
                
            } catch (error) {
                // JSON не распарсился или другой runtime error в обработке ответа.
                completedRequests++;
                pendingRequests.delete(requestId);

                if (process.send) {
                    process.send({
                        type: 'METRIC',
                        responseTime: networkTime,
                        redirected: false,
                        outcome: 'parse_error',
                        httpStatus: res.statusCode
                    });
                }
                checkIfShouldExit();
            }
        });
    });
    
    req.on('error', (error) => {
        completedRequests++;
        pendingRequests.delete(requestId);

        if (process.send) {
            process.send({
                type: 'METRIC',
                responseTime: Date.now() - requestStartTime,
                redirected: false,
                outcome: 'network_error',
                errorCode: error && error.code ? String(error.code) : undefined,
                errorMessage: error && error.message ? String(error.message) : undefined
            });
        }
        checkIfShouldExit();
    });
    
    req.setTimeout(300000, () => {
        req.destroy();
        completedRequests++;
        pendingRequests.delete(requestId);

        if (process.send) {
            process.send({
                type: 'METRIC',
                responseTime: Date.now() - requestStartTime,
                redirected: false,
                outcome: 'timeout',
                errorCode: 'REQUEST_TIMEOUT'
            });
        }
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

    // setInterval заметно дрейфует под нагрузкой и даёт смещения по количеству запросов.
    // Делаем планировщик с коррекцией дрейфа: следующий тик всегда привязан к "идеальному" расписанию.
    const intervalMs = 1000 / config.rps;
    const startTime = Date.now();
    const endTime = startTime + (config.duration * 1000);
    let tick = 0;

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
    process.exit(1);
});