import client from "prom-client";

const register = new client.Registry();
client.collectDefaultMetrics({ register });

// Counter для всех обработанных запросов
const requestsCounter = new client.Counter({
  name: "backend_requests_total",
  help: "Количество запросов, обработанных сервером",
});

// Histogram для времени выполнения запросов
const computeDurationHistogram = new client.Histogram({
  name: "compute_duration_seconds",
  help: "Время выполнения запроса compute на сервере",
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10], // можно настроить под нагрузку
});

register.registerMetric(requestsCounter);
register.registerMetric(computeDurationHistogram);

export { register, requestsCounter, computeDurationHistogram };
