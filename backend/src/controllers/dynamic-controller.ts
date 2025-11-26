import { Request, Response } from 'express';
import loadBalancer from '../load-balancer';
import { bubbleSort, fibonacci, generatePermutations } from '../utils/algorithms';
import { 
  BUBBLE_SORT_INPUT, 
  FIBONACCI_INPUT, 
  PERMUTATIONS_INPUT 
} from '../consts';

export class DynamicController {
  /**
   * Динамическая обработка пузырьковой сортировки
   */
  public async handleBubbleSort(req: Request, res: Response): Promise<void> {
    try {
      loadBalancer.startRequest();
      
      if (loadBalancer.canHandleRequest()) {
        // Server-side выполнение
        console.log('🟢 Server-side execution: Bubble Sort');
        const startTime = process.hrtime();
        const result = bubbleSort(BUBBLE_SORT_INPUT);
        const endTime = process.hrtime(startTime);
        const executionTimeMs = (endTime[0] * 1000 + endTime[1] / 1000000).toFixed(2);
        
        res.json({
          success: true,
          algorithm: 'bubble-sort',
          executedOn: 'server',
          executionTime: `${executionTimeMs} ms`,
          result: result,
          inputLength: BUBBLE_SORT_INPUT.length,
          loadInfo: loadBalancer.getLoadInfo()
        });
      } else {
        // Client-side выполнение
        console.log('🟡 Client-side execution: Bubble Sort');
        const functionSource = bubbleSort.toString();
        
        res.json({
          success: true,
          algorithm: 'bubble-sort',
          executedOn: 'client',
          functionSource: functionSource,
          inputData: BUBBLE_SORT_INPUT,
          instructions: 'Execute this function on client with inputData',
          loadInfo: loadBalancer.getLoadInfo()
        });
      }
    } catch (error) {
      console.error('Error in handleBubbleSort:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    } finally {
      loadBalancer.completeRequest();
    }
  }

  /**
   * Динамическая обработка Фибоначчи
   */
  public async handleFibonacci(req: Request, res: Response): Promise<void> {
    try {
      loadBalancer.startRequest();
      
      if (loadBalancer.canHandleRequest()) {
        // Server-side выполнение
        console.log('🟢 Server-side execution: Fibonacci');
        const startTime = process.hrtime();
        const result = fibonacci(FIBONACCI_INPUT);
        const endTime = process.hrtime(startTime);
        const executionTimeMs = (endTime[0] * 1000 + endTime[1] / 1000000).toFixed(2);
        
        res.json({
          success: true,
          algorithm: 'fibonacci',
          executedOn: 'server',
          executionTime: `${executionTimeMs} ms`,
          result: result,
          input: FIBONACCI_INPUT,
          loadInfo: loadBalancer.getLoadInfo()
        });
      } else {
        // Client-side выполнение
        console.log('🟡 Client-side execution: Fibonacci');
        const functionSource = fibonacci.toString();
        
        res.json({
          success: true,
          algorithm: 'fibonacci',
          executedOn: 'client',
          functionSource: functionSource,
          inputData: FIBONACCI_INPUT,
          instructions: 'Execute this function on client with inputData',
          loadInfo: loadBalancer.getLoadInfo()
        });
      }
    } catch (error) {
      console.error('Error in handleFibonacci:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    } finally {
      loadBalancer.completeRequest();
    }
  }

  /**
   * Динамическая обработка перестановок
   */
  public async handlePermutations(req: Request, res: Response): Promise<void> {
    try {
      loadBalancer.startRequest();
      
      const inputData = Array.from({ length: PERMUTATIONS_INPUT }, (_, i) => i + 1);
      
      if (loadBalancer.canHandleRequest()) {
        // Server-side выполнение
        console.log('🟢 Server-side execution: Permutations');
        const startTime = process.hrtime();
        const result = generatePermutations(inputData);
        const endTime = process.hrtime(startTime);
        const executionTimeMs = (endTime[0] * 1000 + endTime[1] / 1000000).toFixed(2);
        
        res.json({
          success: true,
          algorithm: 'permutations',
          executedOn: 'server',
          executionTime: `${executionTimeMs} ms`,
          resultCount: result.length,
          sample: result.slice(0, 3),
          loadInfo: loadBalancer.getLoadInfo()
        });
      } else {
        // Client-side выполнение
        console.log('🟡 Client-side execution: Permutations');
        const functionSource = generatePermutations.toString();
        
        res.json({
          success: true,
          algorithm: 'permutations',
          executedOn: 'client',
          functionSource: functionSource,
          inputData: inputData,
          instructions: 'Execute this function on client with inputData',
          loadInfo: loadBalancer.getLoadInfo()
        });
      }
    } catch (error) {
      console.error('Error in handlePermutations:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    } finally {
      loadBalancer.completeRequest();
    }
  }
}

export default new DynamicController();