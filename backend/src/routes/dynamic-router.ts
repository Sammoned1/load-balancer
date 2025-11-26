import { Router } from 'express';
import dynamicController from '../controllers/dynamic-controller';

const dynamicRouter = Router();

// Эндпоинты для dynamic алгоритмов
dynamicRouter.post('/bubble-sort', dynamicController.handleBubbleSort);
dynamicRouter.post('/fibonacci', dynamicController.handleFibonacci);
dynamicRouter.post('/permutations', dynamicController.handlePermutations);

export default dynamicRouter;