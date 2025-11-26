import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 10 },
    { duration: '1m', target: 30 },
    { duration: '2m', target: 50 },
    { duration: '30s', target: 10 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<5000'],
    http_req_failed: ['rate<0.05'],
  },
};

export default function () {
  const algorithms = ['bubble-sort', 'fibonacci', 'permutations'];
  const randomAlgorithm = algorithms[Math.floor(Math.random() * algorithms.length)];
  
  const response = http.get(
    `http://lb_backend:8080/api/dynamic/${randomAlgorithm}`,
    JSON.stringify({}),
    { 
      headers: { 
        'Content-Type': 'application/json',
        'User-Agent': 'k6-load-test'
      } 
    }
  );

  check(response, {
    'status is 200': function (r) {
      return r.status === 200;
    },
    'response has success': function (r) {
      try {
        const json = r.json();
        return json.success === true;
      } catch (e) {  // ← Исправлено: добавлен параметр e
        return false;
      }
    },
    'reasonable response time': function (r) {
      return r.timings.duration < 10000;
    }
  });

  sleep(Math.random() * 1.9 + 0.1);
}