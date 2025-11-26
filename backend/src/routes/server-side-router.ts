import { Router } from 'express';
import serverSideController from '../controllers/server-side-controller';

const serverSideRouter = Router();

serverSideRouter.get('/bubble-sort', serverSideController.handleBubbleSort);
serverSideRouter.get('/fibonacci', serverSideController.handleFibonacci);
serverSideRouter.get('/permutations', serverSideController.handlePermutations);
serverSideRouter.post('/performance-test', serverSideController.handlePerformanceTest);

export default serverSideRouter;