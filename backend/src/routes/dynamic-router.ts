import { Router } from 'express';

const dynamicRouter = Router();

// Эндпоинты для dynamic алгоритмов
dynamicRouter.post('/bubble-sort', (req, res) => {
  // Здесь будет логика пузырьковой сортировки
  res.json({ message: 'Bubble sort endpoint' });
});

dynamicRouter.post('/fibonacci', (req, res) => {
  // Здесь будет логика вычисления Фибоначчи
  res.json({ message: 'Fibonacci endpoint' });
});

dynamicRouter.post('/permutations', (req, res) => {
  // Здесь будет логика генерации перестановок
  res.json({ message: 'Permutations endpoint' });
});

export default dynamicRouter;