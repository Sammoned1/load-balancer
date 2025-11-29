import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '5s', target: 5 },   // Быстрый рост
    { duration: '15s', target: 8 },  // Высокая нагрузка
    { duration: '5s', target: 2 },   // Снижение
  ],
  thresholds: {
    http_req_duration: ['p(95)<3000'],
    http_req_failed: ['rate<0.15'],
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
    'status is 200': (r) => r.status === 200,
    'response has success': (r) => {
      try {
        return r.json().success === true;
      } catch (e) {
        return false;
      }
    }
  });

  // Уменьшили задержку между запросами
  sleep(Math.random() * 0.5);
}

export function teardown() {
  const statsResponse = http.get('http://lb_backend:8080/api/stats');
  
  console.log('\n📈 ===== FINAL LOAD BALANCER STATISTICS =====');
  try {
    const stats = statsResponse.json();
    console.log(JSON.stringify(stats.data, null, 2));
  } catch (e) {
    console.log('Failed to get stats:', e);
  }
  console.log('============================================\n');
}