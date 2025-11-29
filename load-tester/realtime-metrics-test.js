import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 1,
  duration: '30s',
};

export default function () {
  // Сначала проверяем метрики здоровья
  const healthResponse = http.get('http://lb_backend:8080/api/health');
  
  if (healthResponse.status === 200) {
    try {
      const healthData = healthResponse.json();
      console.log('📊 Current metrics:', {
        activeRequests: healthData.loadBalancer?.activeRequests,
        timestamp: healthData.timestamp
      });
    } catch (e) {
      // Ignore
    }
  }
  
  // Затем делаем основной запрос
  const response = http.post(
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
    console.log(`🎯 Execution: ${json.executedOn} (Time: ${json.executionTime})`);
  } catch (e) {
    // Ignore
  }

  sleep(1); // Задержка 1 секунда между запросами
}