const { fork } = require('child_process');
const os = require('os');

class SimpleOrchestrator {
    constructor(config) {
        this.config = {
            targetRPS: config.targetRPS || 100,
            duration: config.duration || 60,
            numProcesses: config.numProcesses || Math.floor(os.cpus().length),
            serverUrl: config.serverUrl || 'http://localhost:8080',
            testCase: config.testCase || 1
        };
        
        this.processes = [];
        this.metrics = {
            responseTimes: [],
            redirectedOps: 0,
            sentRequests: 0,
            completedRequests: 0
        };
        
        this.startTime = null;
        this.completedVUs = 0;
        this.logInterval = null;
    }

    async start() {
        console.log(`🚀 Запуск нагрузочного теста`);
        console.log(`   Целевой RPS.............: ${this.config.targetRPS}`);
        console.log(`   Длительность теста......: ${this.config.duration}с`);
        console.log(`   Количество процессов....: ${this.config.numProcesses}`);
        console.log(`   Тест-кейс..............: ${this.config.testCase}`);
        console.log(`   Сервер.................: ${this.config.serverUrl}`);
        console.log('');
        
        const rpsPerProcess = Math.ceil(this.config.targetRPS / this.config.numProcesses);
        const totalExpectedRequests = this.config.targetRPS * this.config.duration;
        
        console.log(`📊 Расчет нагрузки:`);
        console.log(`   RPS на процесс.........: ${rpsPerProcess}`);
        console.log(`   Интервал отправки.......: ${(1000 / rpsPerProcess).toFixed(0)}ms`);
        console.log(`   Ожидаемое кол-во запросов: ${totalExpectedRequests}`);
        console.log('');
        
        this.startTime = Date.now();
        this.startLogging();
        
        for (let i = 0; i < this.config.numProcesses; i++) {
            await this.createProcess(i, rpsPerProcess);
        }
        
        console.log(`✅ Все ${this.config.numProcesses} процессов запущены\n`);
        console.log(`⏱️  Тест длится ${this.config.duration} секунд...\n`);
        
        await this.waitForProcesses();
        
        clearInterval(this.logInterval);
        this.printResults();
    }
    
    async createProcess(id, rpsPerProcess) {
        return new Promise((resolve) => {
            const child = fork('./virtual-user-simple.js', [], {
                stdio: ['pipe', 'pipe', 'pipe', 'ipc']
            });
            
            child.on('message', (msg) => {
                switch(msg.type) {
                    case 'SENT':
                        this.metrics.sentRequests++;
                        break;
                    case 'METRIC':
                        // console.log('=== RESPONSE', msg.responseTime);
                      
                        this.metrics.responseTimes.push(msg.responseTime);
                        this.metrics.completedRequests++;
                        if (msg.redirected) {
                            this.metrics.redirectedOps++;
                        }
                        break;
                }
            });
            
            child.on('exit', () => {
                this.completedVUs++;
            });
            
            this.processes.push({ id, child });
            
            child.send({
                id: id,
                serverUrl: this.config.serverUrl,
                rps: rpsPerProcess,
                duration: this.config.duration,
                testCase: this.config.testCase
            });
            
            resolve();
        });
    }
    
    startLogging() {
        this.logInterval = setInterval(() => {
            this.printProgress();
        }, 5000);
    }
    
    printProgress() {
        const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
        const testTimeElapsed = Math.min(elapsed, this.config.duration);
        const activeVUs = this.processes.length - this.completedVUs;
        
        const expectedSentByNow = Math.floor(testTimeElapsed * this.config.targetRPS);
        
        console.log(`[${elapsed.toString().padStart(3, '0')}s] ` +
                   `VUs: ${activeVUs}/${this.processes.length} ` +
                   `| ` +
                   `Запросы: ${this.metrics.completedRequests}/${expectedSentByNow} ` +
                   `| ` +
                   `RPS: ${this.config.targetRPS} ` +
                   `| ` +
                   `Перенаправлено: ${this.metrics.redirectedOps} ` +
                   `| ` +
                   `Ожидает ответа: ${this.metrics.sentRequests - this.metrics.completedRequests}`);
    }
    

    async waitForProcesses() {
        console.log('\n⏳ Ожидаю завершения ВСЕХ процессов...');
        
        // Создаем промисы для каждого процесса
        const exitPromises = this.processes.map(proc => {
            return new Promise((resolve) => {
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
    
    printResults() {
        if (this.metrics.completedRequests === 0) {
            console.log('❌ Нет данных');
            return;
        }
        
        const avgTime = this.metrics.responseTimes.reduce((a, b) => a + b, 0) / this.metrics.responseTimes.length;
        const sortedTimes = [...this.metrics.responseTimes].sort((a, b) => a - b);
        
        const p90 = this.calculatePercentile(sortedTimes, 90);
        const p95 = this.calculatePercentile(sortedTimes, 95);
        
        const actualDuration = (Date.now() - this.startTime) / 1000;
        const expectedRequests = this.config.targetRPS * this.config.duration;
        
        console.log('\n' + '═'.repeat(70));
        console.log('📊 РЕЗУЛЬТАТЫ НАГРУЗОЧНОГО ТЕСТА');
        console.log('═'.repeat(70));
        console.log('');
        console.log('     Общая информация:');
        console.log(`       Длительность теста........: ${actualDuration.toFixed(1)}с`);
        console.log(`       VUs.......................: ${this.processes.length}`);
        console.log(`       RPS..............: ${this.config.targetRPS}`);
        console.log(`       Тест-кейс...............: ${this.config.testCase}`);
        console.log('');
        console.log('     Статистика запросов:');
        console.log(`       Отправлено запросов.......: ${this.metrics.sentRequests}`);
        console.log(`       Получено ответов..........: ${this.metrics.completedRequests}`);
        console.log(`       Ожидалось запросов........: ${expectedRequests}`);
        console.log(`       Перенаправлено на клиент..: ${this.metrics.redirectedOps}`);
        console.log('');
        
        if (this.metrics.responseTimes.length > 0) {
            console.log('     Время ответа (response time):');
            console.log(`       Среднее..................: ${avgTime.toFixed(2)}ms`);
            console.log(`       Минимум..................: ${Math.min(...this.metrics.responseTimes).toFixed(2)}ms`);
            console.log(`       Максимум.................: ${Math.max(...this.metrics.responseTimes).toFixed(2)}ms`);
            console.log(`       p(90)....................: ${p90.toFixed(2)}ms`);
            console.log(`       p(95)....................: ${p95.toFixed(2)}ms`);
            console.log('');
        }
        
        console.log('═'.repeat(70));
    }
    
    calculatePercentile(sortedArray, percentile) {
        if (sortedArray.length === 0) return 0;
        const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
        return sortedArray[Math.max(0, Math.min(index, sortedArray.length - 1))];
    }
}

if (require.main === module) {
    const config = {
        targetRPS: parseInt(process.env.RPS) || 10,
        duration: parseInt(process.env.DURATION) || 15,
        serverUrl: process.env.SERVER_URL || 'http://localhost:8080',
        testCase: parseInt(process.env.TEST_CASE) || 1
    };
    
    const orchestrator = new SimpleOrchestrator(config);
    orchestrator.start().catch(console.error);
}

module.exports = SimpleOrchestrator;