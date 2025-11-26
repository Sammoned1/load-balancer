import os from 'os';
import process from 'process';

export interface ContainerMetrics {
  cpuUsage: number;          // % использования CPU
  cpuLimit: number;          // абсолютный лимит CPU (ядра)
  memoryUsage: number;       // % использования памяти
  memoryLimit: number;       // абсолютный лимит памяти в байтах
  eventLoopDelay: number;    // задержка event loop в ms
  activeRequests: number;    // количество активных запросов
}

export class ContainerLoadBalancer {
  private activeRequests: number = 0;
  private readonly thresholds = {
    cpu: 0.70,              // 70% от лимита контейнера
    memory: 0.75,           // 75% от лимита памяти
    eventLoopDelay: 30,     // 30ms задержка
    activeRequests: 15      // 15 одновременных запросов
  };

  private circuitBreakerState: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private circuitBreakerLastFailure: number = 0;
  private readonly circuitBreakerThreshold = 5; // 5 ошибок подряд
  private readonly circuitBreakerTimeout = 30000; // 30 секунд

  public startRequest(): void {
    this.activeRequests++;
  }

  public completeRequest(): void {
    this.activeRequests = Math.max(0, this.activeRequests - 1);
  }

  public async canHandleOnServer(): Promise<boolean> {
    // 1. Проверяем circuit breaker
    if (this.isCircuitOpen()) {
      return false;
    }

    try {
      // 2. Получаем метрики контейнера и приложения
      const [containerMetrics, appMetrics] = await Promise.all([
        this.getContainerMetrics(),
        this.getAppMetrics()
      ]);

      // 3. Проверяем здоровье системы
      const isHealthy = this.isSystemHealthy(containerMetrics, appMetrics);

      // 4. Обновляем circuit breaker
      this.updateCircuitBreaker(isHealthy);

      return isHealthy;
    } catch (error) {
      // В случае ошибки при сборе метрик - открываем circuit breaker
      this.recordCircuitBreakerFailure();
      return false;
    }
  }

  private async getContainerMetrics(): Promise<ContainerMetrics> {
    // Базовые метрики системы
    const cpuUsage = await this.getCpuUsage();
    const memoryUsage = process.memoryUsage();
    
    // Получаем лимиты контейнера (будут использоваться реальные лимиты Docker)
    const containerLimits = this.getContainerLimits();

    return {
      cpuUsage,
      memoryUsage: memoryUsage.heapUsed / containerLimits.memoryLimit,
      memoryLimit: containerLimits.memoryLimit,
      cpuLimit: containerLimits.cpuLimit,
      eventLoopDelay: await this.getEventLoopDelay(),
      activeRequests: this.activeRequests
    };
  }

  private async getCpuUsage(): Promise<number> {
    return new Promise((resolve) => {
      const startUsage = process.cpuUsage();
      const startTime = process.hrtime();

      setTimeout(() => {
        const endUsage = process.cpuUsage(startUsage);
        const endTime = process.hrtime(startTime);
        
        const elapsedTime = (endTime[0] * 1e9 + endTime[1]) / 1e6; // ms
        const elapsedUsage = (endUsage.user + endUsage.system) / 1000; // microseconds to ms
        
        // CPU usage in percentage
        const cpuPercent = (elapsedUsage / elapsedTime) * 100;
        resolve(cpuPercent);
      }, 100);
    });
  }

  private async getEventLoopDelay(): Promise<number> {
    return new Promise((resolve) => {
      const start = process.hrtime();
      setImmediate(() => {
        const end = process.hrtime(start);
        const delay = (end[0] * 1000) + (end[1] / 1000000); // convert to ms
        resolve(delay);
      });
    });
  }

  private getContainerLimits(): { memoryLimit: number; cpuLimit: number } {
    // В контейнере Docker мы можем получить реальные лимиты
    // По умолчанию используем системные значения, но в Docker они будут переопределены
    return {
      memoryLimit: os.totalmem(), // Будет ограничено Docker --memory
      cpuLimit: os.cpus().length  // Будет ограничено Docker --cpus
    };
  }

  private getAppMetrics() {
    return {
      responseTime: 0, // Можно добавить отслеживание времени ответа
      errorRate: 0     // Можно добавить отслеживание ошибок
    };
  }

  private isSystemHealthy(
    container: ContainerMetrics,
    app: any
  ): boolean {
    return container.cpuUsage < this.thresholds.cpu &&
           container.memoryUsage < this.thresholds.memory &&
           container.eventLoopDelay < this.thresholds.eventLoopDelay &&
           container.activeRequests < this.thresholds.activeRequests;
  }

  private isCircuitOpen(): boolean {
    if (this.circuitBreakerState === 'OPEN') {
      // Проверяем, не истек ли таймаут
      if (Date.now() - this.circuitBreakerLastFailure > this.circuitBreakerTimeout) {
        this.circuitBreakerState = 'HALF_OPEN';
        return false;
      }
      return true;
    }
    return false;
  }

  private updateCircuitBreaker(success: boolean): void {
    if (success) {
      this.circuitBreakerState = 'CLOSED';
      this.circuitBreakerLastFailure = 0;
    } else {
      this.recordCircuitBreakerFailure();
    }
  }

  private recordCircuitBreakerFailure(): void {
    this.circuitBreakerLastFailure = Date.now();
    // Здесь можно добавить логику для подсчета последовательных ошибок
    // и открытия circuit breaker при достижении порога
  }
}

export default new ContainerLoadBalancer();