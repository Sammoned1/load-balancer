import http from 'k6/http';
import { Counter, Trend } from 'k6/metrics';

const serverExecutionTime = new Trend('server_execution_time', true);
const clientExecutionTime = new Trend('client_execution_time', true);
const serverOperations = new Counter('server_operations_total');
const clientOperations = new Counter('client_operations_total');

const serverBubbleSortExecutionTime = new Trend('server_bubble_sort_execution_time', true)
const clientBubbleSortExecutionTime = new Trend('client_bubble_sort_execution_time', true)
const serverBubbleSortOperations = new Counter('server_bubble_sort_operations')
const clientBubbleSortOperations = new Counter('client_bubble_sort_operations')

const serverFibonacciExecutionTime = new Trend('server_fibonacci_execution_time', true)
const clientFibonacciExecutionTime = new Trend('client_fibonacci_execution_time', true)
const serverFibonacciOperations = new Counter('server_fibonacci_operations')
const clientFibonacciOperations = new Counter('client_fibonacci_operations')

const serverPermutationsExecutionTime = new Trend('server_permutations_execution_time', true)
const clientPermutationsExecutionTime = new Trend('client_permutations_execution_time', true)
const serverPermutationsOperations = new Counter('server_permutations_operations')
const clientPermutationsOperations = new Counter('client_permutations_operations')

const totalOperations = new Counter('total_operations');

export const options = {
  scenarios: {
    extended_load: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      stages: [
        { target: 5, duration: '30s' },
        { target: 10, duration: '60s' },
        { target: 3, duration: '60s' },
        { target: 1, duration: '30s' },
      ],
      preAllocatedVUs: 5,
      maxVUs: 15,
    },
  },
  
  maxDuration: '185s',
  
  iterationTimeout: '30s',
  teardownTimeout: '15s',
  setupTimeout: '5s',
  
  thresholds: {
    http_req_failed: ['rate<0.02'],
    http_req_duration: ['p(95)<8000'],
    iteration_duration: ['p(95)<25000'],
  },
  
  discardResponseBodies: false,
  noConnectionReuse: true,
};

export default function () {
  try {
    const algorithms = ['bubble-sort', 'fibonacci', 'permutations'];
    const randomAlgorithm = algorithms[Math.floor(Math.random() * algorithms.length)];

    totalOperations.add(1);

    const response = http.get(`http://backend:8080/api/dynamic/${randomAlgorithm}`);
    
    if (response.status === 200) {
      const data = response.json();

      if (data.executedOn === 'server') {
        console.log("==========> SERVER < ==========");
        serverOperations.add(1);

        if (data.executionTime) {
          serverExecutionTime.add(data.executionTime);
          switch (data.algorithm) {
            case 'bubble-sort':
              serverBubbleSortExecutionTime.add(data.executionTime)
              serverBubbleSortOperations.add(1)
              break;
            case 'fibonacci':
              serverFibonacciExecutionTime.add(data.executionTime)
              serverFibonacciOperations.add(1)
              break;
            case 'permutations':
              serverPermutationsExecutionTime.add(data.executionTime)
              serverPermutationsOperations.add(1)
              break;
          }
        }
      } else {
        console.log("==========> CLIENT < ==========");

        clientOperations.add(1);

        const fn = new Function('return ' + data.functionSource)();

        switch (data.algorithm) {
          case 'bubble-sort': {
            const startTime = Date.now()
            const splicedData = data.inputData.splice(0, 800)

            const result = fn(splicedData);

            const endTime = Date.now();
            const executionTime = endTime - startTime;

            clientExecutionTime.add(executionTime);
            clientBubbleSortExecutionTime.add(executionTime)
            clientBubbleSortOperations.add(1)
            break;
          }
          case 'fibonacci': {
            const startTime = Date.now()
            const realisticFibNumber = 29
            
            const result = fn(realisticFibNumber);

            const endTime = Date.now();
            const executionTime = endTime - startTime;

            clientExecutionTime.add(executionTime);
            clientFibonacciExecutionTime.add(executionTime)
            clientFibonacciOperations.add(1)
            break;
          }
          case 'permutations': {
            const startTime = Date.now()
            const splicedData = data.inputData.splice(0, 7)
            const result = fn(splicedData);

            const endTime = Date.now();
            const executionTime = endTime - startTime;

            clientExecutionTime.add(executionTime);
            clientPermutationsExecutionTime.add(executionTime)
            clientPermutationsOperations.add(1)
            break;
          }
        }
      }
    }
  } catch (error) {
    console.error(error); 
  }
}