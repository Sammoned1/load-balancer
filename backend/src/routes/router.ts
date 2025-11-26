import { Router } from 'express';
import serverSideRouter from './server-side-router';
import clientSideRouter from './client-side-router';
import dynamicRouter from './dynamic-router';
import healthRouter from './health-router';

const router = Router();

// Health checks должны быть первыми
router.use(healthRouter);

// Общий маршрут /api
router.use('/server-side', serverSideRouter);
router.use('/client-side', clientSideRouter);
router.use('/dynamic', dynamicRouter);

export default router;