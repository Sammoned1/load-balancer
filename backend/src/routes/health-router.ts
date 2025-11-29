import { Router } from 'express';
import loadBalancer from '../load-balancer';

const healthRouter = Router();

healthRouter.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    loadBalancer: {
      activeRequests: (loadBalancer as any).activeRequests
    }
  });
});

healthRouter.get('/stats', (req, res) => {
  const stats = loadBalancer.getStats();
  res.json({
    success: true,
    data: stats
  });
});

healthRouter.post('/reset-stats', (req, res) => {
  loadBalancer.resetStats();
  res.json({
    success: true,
    message: 'Statistics reset'
  });
});

healthRouter.get('/metrics', async (req, res) => {
  try {
    // Эндпоинт для сбора метрик Prometheus
    const metrics = await (loadBalancer as any).getContainerMetrics();
    res.json({
      status: 'OK',
      metrics: metrics
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      error
    });
  }
});

export default healthRouter;