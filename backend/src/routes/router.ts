import { Router } from 'express';
import serverSideRouter from './server-side-router';
import clientSideRouter from './client-side-router';
import dynamicRouter from './dynamic-router';

const router = Router();

// Общий маршрут /api
router.use('/server-side', serverSideRouter);
router.use('/client-side', clientSideRouter);
router.use('/dynamic', dynamicRouter);

export default router;