import { Router } from 'express';
import clientSideController from '../controllers/client-side-controller';

const clientSideRouter = Router();

clientSideRouter.get('/bubble-sort', clientSideController.handleBubbleSort);
clientSideRouter.get('/fibonacci', clientSideController.handleFibonacci);
clientSideRouter.get('/permutations', clientSideController.handlePermutations);

export default clientSideRouter;