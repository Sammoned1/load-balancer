import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 5,
  duration: '15s',
};

let serverCount = 0;
let clientCount = 0;
let requestHistory = [];

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
    const executedOn = json.executedOn;
    
    if (executedOn === 'server') serverCount++;
    else if (executedOn === 'client') clientCount++;
    
    requestHistory.push({
      timestamp: new Date().toISOString(),
      executedOn: executedOn,
      status: response.status
    });
    
  } catch (e) {
    // Ignore JSON parse errors for now
  }

  check(response, {
    'status is 200': (r) => r.status === 200
  });
}

export function handleSummary(data) {
  const total = serverCount + clientCount;
  const serverPercent = total > 0 ? ((serverCount / total) * 100).toFixed(1) : 0;
  const clientPercent = total > 0 ? ((clientCount / total) * 100).toFixed(1) : 0;
  
  console.log('\n=== DETAILED BALANCER ANALYSIS ===');
  console.log(`Total requests: ${total}`);
  console.log(`Server executions: ${serverCount} (${serverPercent}%)`);
  console.log(`Client executions: ${clientCount} (${clientPercent}%)`);
  
  // Анализ распределения по времени
  const first10 = requestHistory.slice(0, 10);
  console.log('\nFirst 10 requests:');
  first10.forEach((req, i) => {
    console.log(`  ${i + 1}. ${req.executedOn} - ${req.timestamp}`);
  });
  
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
  };
}