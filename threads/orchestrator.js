const { fork, spawn } = require('child_process');
const os = require('os');
const InfuxDbMetrics = require('./influxdb-metrics');

class SimpleOrchestrator {
    constructor(config) {
        this.config = {
            targetRPS: config.targetRPS || 100,
            duration: config.duration || 60,
            numProcesses: config.numProcesses || Math.floor(os.cpus().length),
            serverUrl: config.serverUrl || 'http://localhost:8080',
            testCase: config.testCase || 1,
            vuRuntime: config.vuRuntime || 'process',
            dockerImage: config.dockerImage || 'loadtest-vu:latest',
            dockerNetwork: config.dockerNetwork || 'load-balancing-system_lb_network',
            vuCpus: config.vuCpus || '0.15',
            vuMemory: config.vuMemory || '64m',
            vuStartDelayMs: config.vuStartDelayMs ?? ((config.vuRuntime || 'process') === 'docker' ? 5000 : 0)
        };
        
        // Один run_id на всё испытание
        this.runId = config.runId || `${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
        this.influx = new InfuxDbMetrics();

        this.processes = [];
        this.metrics = {
            responseTimesOk: [],
            redirectedOps: 0,
            sentRequests: 0,
            completedRequests: 0,
            okRequests: 0,
            errorRequests: 0,
            timeoutRequests: 0,
            networkErrorRequests: 0,
            parseErrorRequests: 0,
            httpErrorRequests: 0,
            httpStatusCounts: {},
            errorCodeCounts: {},
            errorMessageCounts: {}
        };
        
        this.startTime = null;
        this.loadPhaseStartTime = null;
        this.loadPhaseEndTime = null;
        this.completedVUs = 0;
        this.startedVUs = 0;
        this.expectedVUs = 0;
        this.allVusStartedResolve = null;
        this.allVusStartedPromise = null;
        this.logInterval = null;
        this.prometheusPushgatewayUrl = process.env.PROMETHEUS_PUSHGATEWAY_URL || 'http://localhost:9091';
        
        // Инициализация метрик Prometheus
        this.initPrometheusMetrics();
    }

    initPrometheusMetrics() {
        // Эти счетчики будут использоваться для отправки метрик
        this.sentRequestsCounter = 0;
        this.redirectedOpsCounter = 0;
    }

    async start() {
        console.log(`🚀 Запуск нагрузочного теста`);
        console.log(`   Run ID..................: ${this.runId}`);
        console.log(`   Pushgateway URL........: ${this.prometheusPushgatewayUrl}`);
        console.log(`   Целевой RPS.............: ${this.config.targetRPS}`);
        console.log(`   Длительность теста......: ${this.config.duration}с`);
        console.log(`   Runtime VU..............: ${this.config.vuRuntime}`);
        console.log(`   Количество VU...........: ${this.config.numProcesses}`);
        console.log(`   Тест-кейс..............: ${this.config.testCase}`);
        console.log(`   Сервер.................: ${this.config.serverUrl}`);
        if (this.config.vuRuntime === 'docker') {
            console.log(`   Docker image............: ${this.config.dockerImage}`);
            console.log(`   Docker network..........: ${this.config.dockerNetwork}`);
            console.log(`   VU limits...............: cpus=${this.config.vuCpus}, memory=${this.config.vuMemory}`);
            console.log(`   VU start delay..........: ${this.config.vuStartDelayMs}ms`);
        }
        console.log('');
        
        // ВАЖНО: распределяем RPS так, чтобы СУММА по процессам = targetRPS.
        // Иначе при Math.ceil суммарный RPS становится больше targetRPS, что выглядит как "фантомные" запросы.
        const desiredProcesses = Math.max(1, Math.min(this.config.numProcesses, this.config.targetRPS));
        const baseRps = Math.floor(this.config.targetRPS / desiredProcesses);
        const remainder = this.config.targetRPS % desiredProcesses;
        const rpsPlan = Array.from({ length: desiredProcesses }, (_, i) => baseRps + (i < remainder ? 1 : 0));
        const actualTargetRps = rpsPlan.reduce((a, b) => a + b, 0);

        const totalExpectedRequests = actualTargetRps * this.config.duration;
        
        console.log(`📊 Расчет нагрузки:`);
        console.log(`   Процессов (эффективно)..: ${desiredProcesses}`);
        console.log(`   План RPS по процессам...: [${rpsPlan.join(', ')}] (sum=${actualTargetRps})`);
        console.log(`   Интервал отправки.......: ~${(1000 / Math.max(...rpsPlan)).toFixed(0)}ms (зависит от процесса)`);
        console.log(`   Ожидаемое кол-во запросов: ${totalExpectedRequests}`);
        console.log('');
        
        this.startTime = Date.now();
        this.startLogging();

        this.expectedVUs = desiredProcesses;
        this.startedVUs = 0;
        this.allVusStartedPromise = new Promise((resolve) => {
            this.allVusStartedResolve = resolve;
        });
        const startAt = Date.now() + this.config.vuStartDelayMs;

        for (let i = 0; i < desiredProcesses; i++) {
            await this.createProcess(i, rpsPlan[i], startAt);
        }

        // Фаза нагрузки начинается после того, как все VU реально запустили свой scheduler.
        // Для Docker это важно: container spawn != Node process inside container is ready.
        await this.allVusStartedPromise;
        this.loadPhaseStartTime = startAt;
        console.log(`✅ Все ${desiredProcesses} процессов запущены\n`);
        console.log(`⏱️  Тест длится ${this.config.duration} секунд...\n`);
        setTimeout(() => {
            this.loadPhaseEndTime = Date.now();
        }, this.config.duration * 1000);
        
        await this.waitForProcesses();
        
        clearInterval(this.logInterval);
        await this.printResults();
    }
    
    async createProcess(id, rpsPerProcess, startAt) {
        if (this.config.vuRuntime === 'docker') {
            return this.createDockerContainer(id, rpsPerProcess, startAt);
        }

        return new Promise((resolve) => {
            const child = fork('./virtual-user.js', [], {
                stdio: ['pipe', 'pipe', 'pipe', 'ipc']
            });
            
            child.on('message', (msg) => this.handleVuMessage(msg));

            const processInfo = { id, child, runtime: 'process', exited: false };

            child.on('exit', () => {
                processInfo.exited = true;
                this.completedVUs++;
            });

            this.processes.push(processInfo);
            
            child.send({
                id: id,
                serverUrl: this.config.serverUrl,
                rps: rpsPerProcess,
                duration: this.config.duration,
                testCase: this.config.testCase,
                runId: this.runId,
                startAt
            });
            
            resolve();
        });
    }

    async createDockerContainer(id, rpsPerProcess, startAt) {
        return new Promise((resolve, reject) => {
            const containerName = `loadtest-vu-${this.runId}-${id}`.replace(/[^a-zA-Z0-9_.-]/g, '-');
            const args = [
                'run',
                '--rm',
                '--name', containerName,
                '--network', this.config.dockerNetwork,
                '--cpus', String(this.config.vuCpus),
                '--memory', String(this.config.vuMemory),
                '-e', `VU_ID=${id}`,
                '-e', `RUN_ID=${this.runId}`,
                '-e', `RPS=${rpsPerProcess}`,
                '-e', `DURATION=${this.config.duration}`,
                '-e', `TEST_CASE=${this.config.testCase}`,
                '-e', `START_AT=${startAt}`,
                '-e', `SERVER_URL=${this.config.serverUrl}`,
                '-e', `INFLUX_URL=${process.env.INFLUX_URL || 'http://influxdb:8086'}`,
                '-e', `INFLUX_TOKEN=${process.env.INFLUX_TOKEN || 'my-super-secret-auth-token'}`,
                '-e', `INFLUX_ORG=${process.env.INFLUX_ORG || 'myorg'}`,
                '-e', `INFLUX_BUCKET=${process.env.INFLUX_BUCKET || 'threads'}`,
                this.config.dockerImage
            ];

            const child = spawn('docker', args, {
                stdio: ['ignore', 'pipe', 'pipe']
            });

            child.stdout.setEncoding('utf8');
            child.stderr.setEncoding('utf8');

            let stdoutBuffer = '';
            child.stdout.on('data', (chunk) => {
                stdoutBuffer += chunk;
                const lines = stdoutBuffer.split(/\r?\n/);
                stdoutBuffer = lines.pop() || '';

                for (const line of lines) {
                    this.handleDockerOutputLine(id, line);
                }
            });

            child.stderr.on('data', (chunk) => {
                for (const line of chunk.split(/\r?\n/).filter(Boolean)) {
                    console.log(`[VU ${id} stderr] ${line}`);
                }
            });

            child.once('spawn', () => {
                this.processes.push({ id, child, containerName, runtime: 'docker', exited: false });
                resolve();
            });

            child.once('error', (error) => {
                reject(error);
            });

            child.once('exit', (code) => {
                if (stdoutBuffer.trim()) {
                    this.handleDockerOutputLine(id, stdoutBuffer.trim());
                    stdoutBuffer = '';
                }

                const processInfo = this.processes.find((proc) => proc.id === id);
                if (processInfo) processInfo.exited = true;
                this.completedVUs++;
                if (code !== 0) {
                    console.log(`[VU ${id}] Docker container exited with code ${code}`);
                }
            });
        });
    }

    handleDockerOutputLine(id, line) {
        if (!line.trim()) return;

        try {
            const msg = JSON.parse(line);
            this.handleVuMessage(msg);
        } catch (error) {
            console.log(`[VU ${id}] ${line}`);
        }
    }

    handleVuMessage(msg) {
        switch(msg.type) {
            case 'STARTED':
                this.startedVUs++;
                if (this.startedVUs >= this.expectedVUs && this.allVusStartedResolve) {
                    this.allVusStartedResolve();
                    this.allVusStartedResolve = null;
                }
                break;
            case 'SENT':
                this.metrics.sentRequests++;
                break;
            case 'METRIC':
                this.metrics.completedRequests++;

                if (msg.redirected) this.metrics.redirectedOps++;

                // outcome: ok | timeout | network_error | parse_error | http_error | unknown_error
                const outcome = msg.outcome || 'unknown_error';
                if (outcome === 'ok') {
                    this.metrics.okRequests++;
                    if (typeof msg.responseTime === 'number' && Number.isFinite(msg.responseTime)) {
                        this.metrics.responseTimesOk.push(msg.responseTime);
                    }
                } else {
                    this.metrics.errorRequests++;
                    if (outcome === 'timeout') this.metrics.timeoutRequests++;
                    if (outcome === 'network_error') this.metrics.networkErrorRequests++;
                    if (outcome === 'parse_error') this.metrics.parseErrorRequests++;
                    if (outcome === 'http_error') this.metrics.httpErrorRequests++;
                }

                if (typeof msg.httpStatus === 'number') {
                    const key = String(msg.httpStatus);
                    this.metrics.httpStatusCounts[key] = (this.metrics.httpStatusCounts[key] || 0) + 1;
                }

                if (typeof msg.errorCode === 'string' && msg.errorCode.length > 0) {
                    this.metrics.errorCodeCounts[msg.errorCode] = (this.metrics.errorCodeCounts[msg.errorCode] || 0) + 1;
                }
                if (typeof msg.errorMessage === 'string' && msg.errorMessage.length > 0) {
                    const normalized = msg.errorMessage.slice(0, 120);
                    this.metrics.errorMessageCounts[normalized] = (this.metrics.errorMessageCounts[normalized] || 0) + 1;
                }
                break;
            case 'LOG':
                console.log(msg.message);
                break;
        }
    }
    
    startLogging() {
        this.logInterval = setInterval(() => {
            this.printProgress();
        }, 5000);
    }
    
    printProgress() {
        const now = Date.now();
        const elapsed = Math.floor((now - this.startTime) / 1000);
        const loadElapsedSeconds = this.loadPhaseStartTime ? (now - this.loadPhaseStartTime) / 1000 : (now - this.startTime) / 1000;
        const testTimeElapsedSeconds = Math.min(loadElapsedSeconds, this.config.duration);
        const activeVUs = this.processes.length - this.completedVUs;
        
        // ВАЖНО: считаем по дробному времени, иначе на границах 5s/10s получаются "фантомные" запросы
        // из-за округления секунд вниз.
        const expectedSentByNow = Math.round(testTimeElapsedSeconds * this.config.targetRPS);
        const pending = this.metrics.sentRequests - this.metrics.completedRequests;
        
        console.log(`[${elapsed.toString().padStart(3, '0')}s] ` +
                   `VUs: ${activeVUs}/${this.processes.length} ` +
                   `| ` +
                   `Отправлено: ${this.metrics.sentRequests}/${expectedSentByNow} ` +
                   `| ` +
                   `Завершено: ${this.metrics.completedRequests} ` +
                   `| ` +
                   `RPS: ${this.config.targetRPS} ` +
                   `| ` +
                   `Перенаправлено: ${this.metrics.redirectedOps} ` +
                   `| ` +
                   `Ожидает ответа: ${pending}`);
    }
    

    async waitForProcesses() {
        console.log('\n⏳ Ожидаю завершения ВСЕХ процессов...');
        
        // Создаем промисы для каждого процесса
        const exitPromises = this.processes.map(proc => {
            return new Promise((resolve) => {
                if (proc.exited) {
                    console.log(`[Process ${proc.id}] Завершился`);
                    resolve();
                    return;
                }

                proc.child.once('exit', () => {
                    console.log(`[Process ${proc.id}] Завершился`);
                    resolve();
                });
            });
        });
        
        // Ждем завершения ВСЕХ процессов
        await Promise.all(exitPromises);
        
        console.log('✅ ВСЕ процессы завершились');
    }
    
    async printResults() {
        if (this.metrics.completedRequests === 0) {
            console.log('❌ Нет данных');
            return;
        }
        
        const okCount = this.metrics.responseTimesOk.length;
        const avgTime = okCount > 0
            ? this.metrics.responseTimesOk.reduce((a, b) => a + b, 0) / okCount
            : 0;
        const sortedTimes = [...this.metrics.responseTimesOk].sort((a, b) => a - b);
        
        const p90 = this.calculatePercentile(sortedTimes, 90);
        const p95 = this.calculatePercentile(sortedTimes, 95);
        
        const now = Date.now();
        const wallClockDuration = (now - this.startTime) / 1000;
        const loadPhaseDuration = this.loadPhaseStartTime
            ? ((this.loadPhaseEndTime ?? now) - this.loadPhaseStartTime) / 1000
            : this.config.duration;

        const expectedRequests = this.config.targetRPS * this.config.duration;
        
        console.log('\n' + '═'.repeat(70));
        console.log('📊 РЕЗУЛЬТАТЫ НАГРУЗОЧНОГО ТЕСТА');
        console.log('═'.repeat(70));
        console.log('');
        console.log('     Общая информация:');
        console.log(`       Длительность (wall clock).: ${wallClockDuration.toFixed(1)}с`);
        console.log(`       Фаза нагрузки.............: ${loadPhaseDuration.toFixed(1)}с (план: ${this.config.duration}с)`);
        console.log(`       VUs.......................: ${this.processes.length}`);
        console.log(`       RPS..............: ${this.config.targetRPS}`);
        console.log(`       Тест-кейс...............: ${this.config.testCase}`);
        console.log('');
        console.log('     Статистика запросов:');
        console.log(`       Отправлено запросов.......: ${this.metrics.sentRequests}`);
        console.log(`       Завершено запросов........: ${this.metrics.completedRequests}`);
        console.log(`       Ожидалось запросов........: ${expectedRequests}`);
        console.log(`       Перенаправлено на клиент..: ${this.metrics.redirectedOps}`);
        console.log('');
        console.log('     Успешность (прозрачно):');
        console.log(`       OK (есть метрика).........: ${this.metrics.okRequests}`);
        console.log(`       Ошибки всего..............: ${this.metrics.errorRequests}`);
        console.log(`         TIMEOUT................: ${this.metrics.timeoutRequests}`);
        console.log(`         NETWORK_ERROR..........: ${this.metrics.networkErrorRequests}`);
        console.log(`         PARSE_ERROR............: ${this.metrics.parseErrorRequests}`);
        console.log(`         HTTP_non_2xx...........: ${this.metrics.httpErrorRequests}`);
        if (Object.keys(this.metrics.httpStatusCounts).length > 0) {
            const topStatuses = Object.entries(this.metrics.httpStatusCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 6)
                .map(([code, count]) => `${code}:${count}`)
                .join(', ');
            console.log(`       HTTP статусы (top)........: ${topStatuses}`);
        }

        if (Object.keys(this.metrics.errorCodeCounts).length > 0) {
            const topCodes = Object.entries(this.metrics.errorCodeCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 6)
                .map(([code, count]) => `${code}:${count}`)
                .join(', ');
            console.log(`       Error codes (top).........: ${topCodes}`);
        }

        if (Object.keys(this.metrics.errorMessageCounts).length > 0) {
            const topMsgs = Object.entries(this.metrics.errorMessageCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3)
                .map(([msg, count]) => `"${msg}":${count}`)
                .join(' | ');
            console.log(`       Error messages (top)......: ${topMsgs}`);
        }
        console.log('');
        
        if (okCount > 0) {
            console.log('     Время ответа (response time):');
            console.log(`       (считается только по OK)..: ${okCount}`);
            console.log(`       Среднее..................: ${avgTime.toFixed(2)}ms`);
            console.log(`       Минимум..................: ${Math.min(...this.metrics.responseTimesOk).toFixed(2)}ms`);
            console.log(`       Максимум.................: ${Math.max(...this.metrics.responseTimesOk).toFixed(2)}ms`);
            console.log(`       p(90)....................: ${p90.toFixed(2)}ms`);
            console.log(`       p(95)....................: ${p95.toFixed(2)}ms`);
            console.log('');
        } else {
            console.log('     Время ответа (response time):');
            console.log('       ❌ Нет OK-метрик для расчёта latency (все запросы завершились ошибкой/таймаутом)');
            console.log('');
        }
        
        console.log('═'.repeat(70));

        // Пишем итоговые агрегаты для этого испытания в InfluxDB
        // p95/median берём по OK, throughput считаем как OK / длительность фазы нагрузки (обычно 60s)
        const avgMs = avgTime;
        const p95Ms = p95;
        const medianMs = okCount > 0 ? this.calculatePercentile(sortedTimes, 50) : 0;
        const throughputRps = loadPhaseDuration > 0 ? (this.metrics.okRequests / loadPhaseDuration) : 0;
        const clientShare = this.metrics.okRequests > 0 ? (this.metrics.redirectedOps / this.metrics.okRequests) : 0;
        const tailS = Math.max(0, wallClockDuration - loadPhaseDuration);

        try {
            await this.influx.sendSummary({
            runId: this.runId,
            testCase: this.config.testCase,
            targetRps: this.config.targetRPS,
            durationS: this.config.duration,
            vusCount: this.expectedVUs || this.processes.length,
            p95Ms,
            avgMs,
            medianMs,
            throughputRps,
            clientShare,

            sentCount: this.metrics.sentRequests,
            completedCount: this.metrics.completedRequests,
            okCount: this.metrics.okRequests,
            errorCount: this.metrics.errorRequests,
            timeoutCount: this.metrics.timeoutRequests,
            networkErrorCount: this.metrics.networkErrorRequests,
            parseErrorCount: this.metrics.parseErrorRequests,
            httpErrorCount: this.metrics.httpErrorRequests,
            redirectedOkCount: this.metrics.redirectedOps,

            wallClockS: wallClockDuration,
            loadPhaseS: loadPhaseDuration,
            tailS
            });
        } catch (e) {
            console.log(`[InfluxDB] Failed to write loadtest_summary for run_id=${this.runId}:`, e?.message || e);
        }
    }
    
    calculatePercentile(sortedArray, percentile) {
        if (sortedArray.length === 0) return 0;
        const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
        return sortedArray[Math.max(0, Math.min(index, sortedArray.length - 1))];
    }
}

if (require.main === module) {
    const vuRuntime = process.env.VU_RUNTIME || 'process';
    const config = {
        targetRPS: parseInt(process.env.RPS) || 16,
        duration: parseInt(process.env.DURATION) || 60,
        numProcesses: parseInt(process.env.NUM_VUS || process.env.VUS) || Math.floor(os.cpus().length),
        serverUrl: process.env.SERVER_URL || (vuRuntime === 'docker' ? 'http://backend:8080' : 'http://localhost:8080'),
        testCase: parseInt(process.env.TEST_CASE) || 3,
        vuRuntime,
        dockerImage: process.env.VU_DOCKER_IMAGE || 'loadtest-vu:latest',
        dockerNetwork: process.env.DOCKER_NETWORK || 'load-balancing-system_lb_network',
        vuCpus: process.env.VU_CPUS || '0.25',
        vuMemory: process.env.VU_MEMORY || '64m',
        vuStartDelayMs: process.env.VU_START_DELAY_MS !== undefined
            ? Number(process.env.VU_START_DELAY_MS)
            : undefined
    };
    
    const orchestrator = new SimpleOrchestrator(config);
    orchestrator.start().catch(console.error);
}

module.exports = SimpleOrchestrator;