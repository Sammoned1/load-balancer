import { Request, Response } from 'express';
import { bubbleSort, fibonacci, generatePermutations } from '../utils/algorithms';
import { 
  FIBONACCI_INPUT, 
  PERMUTATIONS_INPUT,
  BUBBLE_SORT_INPUT 
} from '../consts';

export class ClientSideController {
  /**
   * Отправляем код пузырьковой сортировки для выполнения на клиенте
   */
  public async handleBubbleSort(req: Request, res: Response): Promise<void> {
    try {
      const functionSource = bubbleSort.toString();
      const inputData = BUBBLE_SORT_INPUT;
      
      res.json({
        success: true,
        algorithm: 'bubble-sort',
        functionSource: functionSource,
        inputData: inputData,
        instructions: `Execute this function on client with input data`
      });
      
    } catch (error) {
      console.error('Error in handleBubbleSort:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * Отправляем код Фибоначчи для выполнения на клиенте
   */
  public async handleFibonacci(req: Request, res: Response): Promise<void> {
    try {
      const functionSource = fibonacci.toString();
      const inputData = FIBONACCI_INPUT;
      
      res.json({
        success: true,
        algorithm: 'fibonacci',
        functionSource: functionSource,
        inputData: inputData,
        instructions: `Execute this function on client with input data`
      });
      
    } catch (error) {
      console.error('Error in handleFibonacci:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * Отправляем код генерации перестановок для выполнения на клиенте
   */
  public async handlePermutations(req: Request, res: Response): Promise<void> {
    try {
      const functionSource = generatePermutations.toString();
      const inputData = Array.from({ length: PERMUTATIONS_INPUT }, (_, i) => i + 1);
      
      res.json({
        success: true,
        algorithm: 'permutations',
        functionSource: functionSource,
        inputData: inputData,
        instructions: `Execute this function on client with input data`
      });
      
    } catch (error) {
      console.error('Error in handlePermutations:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
}

export default new ClientSideController();