import { Request, Response } from 'express';
import loadBalancer from '../load-balancer';
import { bubbleSort, fibonacci, generatePermutations } from '../utils/algorithms';
import { 
  BUBBLE_SORT_INPUT, 
  FIBONACCI_INPUT, 
  PERMUTATIONS_INPUT 
} from '../consts';
import { logger } from '..';

export class DynamicController {
  // private async getLoadInfo(): Promise<any> {
  //   // Здесь можно вернуть дополнительную информацию о нагрузке
  //   return {
  //     timestamp: new Date().toISOString(),
  //     activeRequests: (loadBalancer as any).activeRequests
  //   };
  // }

  /**
   * Динамическая обработка пузырьковой сортировки
   */
  public async handleBubbleSort(req: Request, res: Response): Promise<void> {
    try {
      loadBalancer.startRequest();
      
      if (await loadBalancer.canHandleOnServer()) {
        // Server-side выполнение
        const startTime = process.hrtime();
        const result = bubbleSort(BUBBLE_SORT_INPUT);
        const endTime = process.hrtime(startTime);
        const executionTimeMs = (endTime[0] * 1000 + endTime[1] / 1000000).toFixed(2);
        logger.info(`🟢 Server-side execution: Bubble Sort.  Time: ${executionTimeMs}`);
        
        res.json({
          success: true,
          algorithm: 'bubble-sort',
          executedOn: 'server',
          executionTime: executionTimeMs,
          // result: result,
          inputLength: BUBBLE_SORT_INPUT.length,
          // loadInfo: await this.getLoadInfo()
        });
      } else {
        // Client-side выполнение
        logger.info('🟡 Client-side execution: Bubble Sort');
        const functionSource = bubbleSort.toString();
        
        res.json({
          success: true,
          algorithm: 'bubble-sort',
          executedOn: 'client',
          functionSource: functionSource,
          inputData: BUBBLE_SORT_INPUT,
          instructions: 'Execute this function on client with inputData',
          // loadInfo: await this.getLoadInfo()
        });
      }
    } catch (error) {
      logger.error('Error in handleBubbleSort:', error);
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
      
      if (await loadBalancer.canHandleOnServer()) {
        // Server-side выполнение
        const startTime = process.hrtime();
        const result = fibonacci(FIBONACCI_INPUT);
        const endTime = process.hrtime(startTime);
        const executionTimeMs = (endTime[0] * 1000 + endTime[1] / 1000000).toFixed(2);
        logger.info(`🟢 Server-side execution: Fibonacci.    Time: ${executionTimeMs}`);
        
        res.json({
          success: true,
          algorithm: 'fibonacci',
          executedOn: 'server',
          executionTime: `${executionTimeMs} ms`,
          // result: result,
          // input: FIBONACCI_INPUT,
          // loadInfo: await this.getLoadInfo()
        });
      } else {
        // Client-side выполнение
        logger.info('🟡 Client-side execution: Fibonacci');
        const functionSource = fibonacci.toString();
        
        res.json({
          success: true,
          algorithm: 'fibonacci',
          executedOn: 'client',
          functionSource: functionSource,
          inputData: FIBONACCI_INPUT,
          instructions: 'Execute this function on client with inputData',
          // loadInfo: await this.getLoadInfo()
        });
      }
    } catch (error) {
      logger.error('Error in handleFibonacci:', error);
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
      
      if (await loadBalancer.canHandleOnServer()) {
        // Server-side выполнение
        const startTime = process.hrtime();
        const result = generatePermutations(inputData);
        const endTime = process.hrtime(startTime);
        const executionTimeMs = (endTime[0] * 1000 + endTime[1] / 1000000).toFixed(2);
        logger.info(`🟢 Server-side execution: Permutations. Time: ${executionTimeMs}`);
        
        res.json({
          success: true,
          algorithm: 'permutations',
          executedOn: 'server',
          executionTime: `${executionTimeMs} ms`,
          resultCount: result.length,
          // sample: result.slice(0, 3),
          // loadInfo: await this.getLoadInfo()
        });
      } else {
        // Client-side выполнение
        logger.info('🟡 Client-side execution: Permutations');
        const functionSource = generatePermutations.toString();
        
        res.json({
          success: true,
          algorithm: 'permutations',
          executedOn: 'client',
          functionSource: functionSource,
          inputData: inputData,
          instructions: 'Execute this function on client with inputData',
          // loadInfo: await this.getLoadInfo()
        });
      }
    } catch (error) {
      logger.error('Error in handlePermutations:', error);
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