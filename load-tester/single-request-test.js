import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 1,      // 1 виртуальный пользователь
  iterations: 1, // Только 1 итерация
};

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

  console.log(`Status: ${response.status}`);
  console.log(`Body: ${response.body}`);
  
  const result = check(response, {
    'status is 200': function (r) {
      return r.status === 200;
    },
    'response has success': function (r) {
      try {
        const json = r.json();
        console.log(`Executed on: ${json.executedOn}`);
        console.log(`Execution time: ${json.executionTime}`);
        return json.success === true;
      } catch (e) {
        console.log('Error parsing JSON:', e);
        return false;
      }
    }
  });
  
  return result;
}