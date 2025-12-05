import http from 'k6/http';
import { Counter, Trend } from 'k6/metrics';

const serverExecutionTime = new Trend('server_execution_time', true);
const clientExecutionTime = new Trend('client_execution_time', true);
const serverOperations = new Counter('server_operations_total');
const clientOperations = new Counter('client_operations_total');
const totalOperations = new Counter('total_operations');

export const options = {
  scenarios: {
    realistic_load: {
      executor: 'ramping-arrival-rate', // Более реалистично чем constant
      startRate: 1,     // Начинаем с 1 запроса в секунду
      timeUnit: '1s',
      stages: [
        { target: 5, duration: '5s' },   // Плавный рост: 5сек до 5 запр/сек
        { target: 10, duration: '10s' }, // Достигаем пика: 10 запр/сек
        { target: 3, duration: '10s' },  // Спад нагрузки
        { target: 1, duration: '5s' },   // Завершение
      ],
      preAllocatedVUs: 5,
      maxVUs: 15,
    },
  },
  
  // Ограничиваем общее количество операций
  maxDuration: '35s',       // Максимум 35 секунд (чуть больше чем stages)
  
  // Таймауты
  iterationTimeout: '15s',  // 15 секунд на одну операцию (с алгоритмом)
  teardownTimeout: '10s',
  
  // Пороги для мониторинга
  thresholds: {
    http_req_failed: ['rate<0.01'],    // Менее 1% ошибок
    http_req_duration: ['p(95)<5000'], // 95% запросов < 5 сек
    iteration_duration: ['max<15000'], // Ни одна операция не > 15 сек
  },
  
  // Оптимизация для изоляции
  discardResponseBodies: false,
  noConnectionReuse: true,
};

export default function () {
  try {
    totalOperations.add(1);

    const response = http.get('http://backend:8080/api/dynamic/bubble-sort');
    
    if (response.status === 200) {
      // Можно добавить простую проверку ответа
      const data = response.json();

      if (data.executedOn === 'server') {
        serverOperations.add(1);

        if (data.executionTime) {
          serverExecutionTime.add(data.executionTime);
        }
        
        // console.log("==========> SERVER < ==========");
        
        console.log({
          executedOn: data.executedOn,
          executionTime: `${data.executionTime} ms`,
          algorithm: data.algorithm
        });
      } else {
        clientOperations.add(1);

        // console.log("==========> CLIENT < ==========");
        
        const startTime = Date.now();
        const splicedData = data.inputData.splice(0, 800)

        const fn = new Function('return ' + data.functionSource)();
        const result = fn(splicedData);

        const endTime = Date.now();
        const executionTime = endTime - startTime;

        clientExecutionTime.add(executionTime);

        console.log({
          executedOn: data.executedOn,
          algorithm: data.algorithm,
          executionTime: `${executionTime} ms`,
        });
      }
    }
  } catch (error) {
    console.error(error); 
  }
}