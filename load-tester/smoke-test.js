import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 3,           // 3 виртуальных пользователя
  duration: '10s',  // Всего 10 секунд
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% запросов < 2s
    http_req_failed: ['rate<0.1'],     // Меньше 10% ошибок
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
        'Content-Type': 'application/json'
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
      } catch (e) {
        return false;
      }
    }
  });
}