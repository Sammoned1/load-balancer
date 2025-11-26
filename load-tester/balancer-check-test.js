import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 10,          // 10 пользователей
  duration: '20s',  // 20 секунд
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

  const checkResult = check(response, {
    'status is 200': function (r) {
      return r.status === 200;
    },
    'response has success': function (r) {
      try {
        const json = r.json();
        
        // Считаем где выполнялось
        if (json.executedOn === 'server') serverCount++;
        else if (json.executedOn === 'client') clientCount++;
        
        return json.success === true;
      } catch (e) {
        return false;
      }
    }
  });
  
  return checkResult;
}

export function handleSummary(data) {
  const total = serverCount + clientCount;
  const serverPercent = total > 0 ? ((serverCount / total) * 100).toFixed(1) : 0;
  const clientPercent = total > 0 ? ((clientCount / total) * 100).toFixed(1) : 0;
  
  console.log('\n=== BALANCER DISTRIBUTION ===');
  console.log(`Total requests: ${total}`);
  console.log(`Server executions: ${serverCount} (${serverPercent}%)`);
  console.log(`Client executions: ${clientCount} (${clientPercent}%)`);
  
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
  };
}