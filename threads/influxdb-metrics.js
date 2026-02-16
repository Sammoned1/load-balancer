// simple-influxdb.js
class InfuxDbMetrics {
  constructor() {
    this.url = 'http://localhost:8086';
    this.token = 'my-super-secret-auth-token';
    this.org = 'myorg';
    this.bucket = 'threads';
    this.requestCounter = 0;
  }
    
  // Отправка одной метрики
  sendMetric(responseTime, redirected, testCase) {
    // Правильный формат для InfluxDB v2
    const line = `loadtest,test_case=${testCase},redirected=${redirected} response_time=${responseTime} ${Date.now()}000000`;

    try {
      fetch(`http://localhost:8086/api/v2/write?org=${this.org}&bucket=${this.bucket}&precision=ns`, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${this.token}`,
          'Content-Type': 'text/plain'
        },
        body: line
      });
        
    } catch (error) {
      process.send({
        type: 'LOG',
        message: `[InfluxDB] Ошибка соединения: ${error.message}`
      });
    }
  }
}

module.exports = InfuxDbMetrics;