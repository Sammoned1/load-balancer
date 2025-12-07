const http = require('http');

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
            try {
                const response = JSON.parse(data);
                const networkTime = Date.now() - requestStartTime;
                let totalTime = networkTime;
                let redirected = false;

                if (response.executedOn === 'client') {
                    const clientStart = Date.now();
                    const fn = new Function('return ' + response.functionSource)();
                    redirected = true;

                    await new Promise(resolve => {
                      setTimeout(() => resolve(fn(response.inputData)), 5000)
                    })

                    totalTime += (Date.now() - clientStart);
                }
                
                completedRequests++;
                pendingRequests.delete(requestId);
                
                if (process.send) {
                    process.send({
                        type: 'METRIC',
                        responseTime: totalTime,
                        redirected: redirected
                    });
                }
                
                checkIfShouldExit();
                
            } catch (error) {
                completedRequests++;
                pendingRequests.delete(requestId);
                checkIfShouldExit();
            }
        });
    });
    
    req.on('error', (error) => {
        completedRequests++;
        pendingRequests.delete(requestId);
        checkIfShouldExit();
    });
    
    req.setTimeout(300000, () => {
        req.destroy();
        completedRequests++;
        pendingRequests.delete(requestId);
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
    const interval = 1000 / config.rps;
    
    intervalId = setInterval(() => {
        sendRequest();
    }, interval);
    
    setTimeout(() => {
        clearInterval(intervalId);
        sendingStopped = true;
        checkIfShouldExit();
    }, config.duration * 1000);
}

process.on('uncaughtException', (err) => {
    if (intervalId) clearInterval(intervalId);
    process.exit(1);
});