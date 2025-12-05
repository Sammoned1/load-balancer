import http from 'k6/http';

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
    const response = http.get('http://backend:8080/api/dynamic/bubble-sort');
    
    if (response.status === 200) {
      // Можно добавить простую проверку ответа
      const data = response.json();

      if (data.executedOn === 'server') {
        // console.log("==========> SERVER < ==========");
        
        console.log({
          executedOn: data.executedOn,
          executionTime: data.executionTime,
          algorithm: data.algorithm
        });
      } else {
        // console.log("==========> CLIENT < ==========");
        
        const startTime = Date.now();
        const splicedData = data.inputData.splice(0, 800)

        const fn = new Function('return ' + data.functionSource)();
        const result = fn(splicedData);

        const endTime = Date.now();
        const executionTime = `${endTime - startTime} ms`;

        console.log({
          executedOn: data.executedOn,
          algorithm: data.algorithm,
          executionTime,
        });
      }
    }
  } catch (error) {
    console.error(error); 
  }
}