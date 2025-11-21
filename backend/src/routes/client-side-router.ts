import { Router } from 'express';
import clientSideController from '../controllers/client-side-controller';

const clientSideRouter = Router();

clientSideRouter.post('/bubble-sort', clientSideController.handleBubbleSort);
clientSideRouter.post('/fibonacci', clientSideController.handleFibonacci);
clientSideRouter.post('/permutations', clientSideController.handlePermutations);

export default clientSideRouter;