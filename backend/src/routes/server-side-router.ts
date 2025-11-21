import { Router } from 'express';
import serverSideController from '../controllers/server-side-controller';

const serverSideRouter = Router();

serverSideRouter.post('/bubble-sort', serverSideController.handleBubbleSort);
serverSideRouter.post('/fibonacci', serverSideController.handleFibonacci);
serverSideRouter.post('/permutations', serverSideController.handlePermutations);
serverSideRouter.post('/performance-test', serverSideController.handlePerformanceTest);

export default serverSideRouter;