import { Router } from 'express';
import dynamicController from '../controllers/dynamic-controller';

const dynamicRouter = Router();

// Эндпоинты для dynamic алгоритмов
dynamicRouter.get('/bubble-sort', dynamicController.handleBubbleSort);
dynamicRouter.get('/fibonacci', dynamicController.handleFibonacci);
dynamicRouter.get('/permutations', dynamicController.handlePermutations);

export default dynamicRouter;