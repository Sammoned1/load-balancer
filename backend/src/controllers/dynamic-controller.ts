import { Request, Response } from 'express';

export class DynamicController {
  /**
   * Обработчик для пузырьковой сортировки
   */
  public async handleBubbleSort(req: Request, res: Response): Promise<void> {
    // Реализация будет добавлена позже
  }

  /**
   * Обработчик для вычисления Фибоначчи
   */
  public async handleFibonacci(req: Request, res: Response): Promise<void> {
    // Реализация будет добавлена позже
  }

  /**
   * Обработчик для генерации перестановок
   */
  public async handlePermutations(req: Request, res: Response): Promise<void> {
    // Реализация будет добавлена позже
  }
}

export default new DynamicController();