import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 8,           // 8 виртуальных пользователей
  duration: '20s',  // 20 секунд - быстрый тест
};

let serverCount = 0;
let clientCount = 0;

export default function () {
  const response = http.get(
    'http://lb_backend:8080/api/dynamic/bubble-sort',
    JSON.stringify({}),
    { 
      headers: { 
        'Content-Type': 'application/json'
      } 
    }
  );

  try {
    const json = response.json();
    if (json.executedOn === 'server') serverCount++;
    else if (json.executedOn === 'client') clientCount++;
  } catch (e) {
    // Ignore
  }

  check(response, {
    'status is 200': (r) => r.status === 200
  });
}

export function handleSummary(data) {
  const total = serverCount + clientCount;
  const serverPercent = total > 0 ? ((serverCount / total) * 100).toFixed(1) : 0;
  const clientPercent = total > 0 ? ((clientCount / total) * 100).toFixed(1) : 0;
  
  console.log('\n=== RATIO TEST RESULTS ===');
  console.log(`Target: 70% Server / 30% Client`);
  console.log(`Actual: ${serverPercent}% Server / ${clientPercent}% Client`);
  console.log(`Total requests: ${total}`);
  console.log(`Server executions: ${serverCount}`);
  console.log(`Client executions: ${clientCount}`);
  
  // Проверяем отклонение от целевой пропорции
  const deviation = Math.abs(serverPercent - 70);
  const isAcceptable = deviation <= 10; // Допускаем ±10% отклонение
  
  console.log(`Deviation from target: ${deviation.toFixed(1)}%`);
  console.log(`Acceptable: ${isAcceptable ? '✅' : '❌'}`);
  
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
  };
}