import { Request, Response } from 'express';
import { 
  bubbleSort, 
  fibonacci, 
  generateNumberPermutations 
} from '../utils/algorithms';
import { 
  BUBBLE_SORT_INPUT, 
  FIBONACCI_INPUT, 
  PERMUTATIONS_INPUT,
  PERFORMANCE_TEST_DATA 
} from '../consts';
import { logger } from '..';

export class ServerSideController {
  /**
   * Обработчик для пузырьковой сортировки
   */
  public async handleBubbleSort(req: Request, res: Response): Promise<void> {
    try {
      const startTime = process.hrtime();
      
      const inputArray = BUBBLE_SORT_INPUT;
      const result = bubbleSort(inputArray);
      
      const endTime = process.hrtime(startTime);
      const executionTimeMs = (endTime[0] * 1000 + endTime[1] / 1000000).toFixed(2);
      logger.info(`Bubble-sort. Execution time: ${executionTimeMs} ms`)
      
      res.json({
        success: true,
        algorithm: 'bubble-sort',
        // input: inputArray,
        // result: result,
        inputLength: inputArray.length,
        executionTime: `${executionTimeMs} ms`,
        performance: 'measured'
      });
      
    } catch (error) {
      logger.error('Error in handleBubbleSort:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error during bubble sort'
      });
    }
  }

  /**
   * Обработчик для вычисления Фибоначчи
   */
  public async handleFibonacci(req: Request, res: Response): Promise<void> {
    try {
      const startTime = process.hrtime();
      
      const n = FIBONACCI_INPUT;
      const result = fibonacci(n);
      
      const endTime = process.hrtime(startTime);
      const executionTimeMs = (endTime[0] * 1000 + endTime[1] / 1000000).toFixed(2);
      logger.info(`Fibonacci. Execution time: ${executionTimeMs} ms`)
      
      res.json({
        success: true,
        algorithm: 'fibonacci',
        // input: n,
        // result: result,
        executionTime: `${executionTimeMs} ms`,
        performance: 'measured'
      });
      
    } catch (error) {
      logger.error('Error in handleFibonacci:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error during fibonacci calculation'
      });
    }
  }

  /**
   * Обработчик для генерации перестановок
   */
  public async handlePermutations(req: Request, res: Response): Promise<void> {
    try {
      const startTime = process.hrtime();
      
      const n = PERMUTATIONS_INPUT;
      const result = generateNumberPermutations(n);
      
      const endTime = process.hrtime(startTime);
      const executionTimeMs = (endTime[0] * 1000 + endTime[1] / 1000000).toFixed(2);
      logger.info(`Permutations. Execution time: ${executionTimeMs} ms`)
      
      res.json({
        success: true,
        algorithm: 'permutations',
        // input: n,
        resultCount: result.length,
        // sample: result.slice(0, 5),
        executionTime: `${executionTimeMs} ms`,
        performance: 'measured'
      });
      
    } catch (error) {
      logger.error('Error in handlePermutations:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error during permutations generation'
      });
    }
  }

  /**
   * Дополнительный метод для тестирования производительности с большими данными
   */
  public async handlePerformanceTest(req: Request, res: Response): Promise<void> {
    try {
      const { algorithm } = req.body;
      const startTime = process.hrtime();
      
      let result: any;
      
      switch (algorithm) {
        case 'bubble-sort':
          result = {
            algorithm: 'bubble-sort',
            inputLength: PERFORMANCE_TEST_DATA.LARGE_ARRAY.length,
            result: 'sorted array (truncated in response)'
          };
          bubbleSort(PERFORMANCE_TEST_DATA.LARGE_ARRAY);
          break;
          
        case 'fibonacci':
          const fibResult = fibonacci(PERFORMANCE_TEST_DATA.LARGE_FIBONACCI);
          result = {
            algorithm: 'fibonacci',
            input: PERFORMANCE_TEST_DATA.LARGE_FIBONACCI,
            result: fibResult
          };
          break;
          
        case 'permutations':
          const permResult = generateNumberPermutations(PERFORMANCE_TEST_DATA.LARGE_PERMUTATIONS);
          result = {
            algorithm: 'permutations',
            input: PERFORMANCE_TEST_DATA.LARGE_PERMUTATIONS,
            resultCount: permResult.length
          };
          break;
          
        default:
          throw new Error(`Unknown algorithm: ${algorithm}`);
      }
      
      const endTime = process.hrtime(startTime);
      const executionTimeMs = (endTime[0] * 1000 + endTime[1] / 1000000).toFixed(2);
      logger.info(`Performance test. Execution time: ${executionTimeMs} ms`)
      
      res.json({
        success: true,
        ...result,
        executionTime: `${executionTimeMs} ms`,
        performance: 'high-load test completed'
      });
      
    } catch (error) {
      logger.error('Error in handlePerformanceTest:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error during performance test'
      });
    }
  }
}

export default new ServerSideController();