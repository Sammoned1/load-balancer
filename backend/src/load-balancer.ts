import os from 'os';
import process from 'process';
import { logger } from '.';
import fs from 'fs/promises';

export interface ContainerMetrics {
  cpuUsage: number;          // % использования CPU от лимита контейнера
  memoryUsage: number;       // % использования памяти
  activeRequests: number;    // количество активных запросов
}

interface LoadBalancerStats {
  totalRequests: number;
  serverOperations: number;
  clientOperations: number;
  serverPercentage: number;
  clientPercentage: number;
  rejectionReasons: {
    cpu: number;
    memory: number;
    activeRequests: number;
    circuitBreaker: number;
  };
}

export class ContainerLoadBalancer {
  private activeRequests: number = 0;
  private lastCpuMeasurement: { time: number; usage: number } | null = null;
  
  // Статистика
  private totalRequests: number = 0;
  private serverOperations: number = 0;
  private clientOperations: number = 0;
  private rejectionReasons = {
    cpu: 0,
    memory: 0,
    activeRequests: 0,
    circuitBreaker: 0
  };

  // Пороги
  private readonly thresholds = {
    cpu: 0.75,
    memory: 0.60,
    activeRequests: 12
  };

  // Лимиты контейнера (0.1 CPU, 128MB)
  private containerCpuLimit: number = os.cpus().length; // по умолчанию
  private containerMemoryLimit: number = os.totalmem(); // по умолчанию

  private circuitBreakerState: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private circuitBreakerLastFailure: number = 0;
  private readonly circuitBreakerThreshold = 5;
  private readonly circuitBreakerTimeout = 30000;

  constructor() {
    // Инициализируем первое измерение CPU
    this.loadContainerLimits();
    this.startStatsLogging();
  }

  private startStatsLogging(): void {
    setInterval(() => {
      this.logStats();
    }, 30000);
  }

  private async loadContainerLimits(): Promise<void> {
    try {
      let cpuLimit = os.cpus().length;
      let memoryLimit = os.totalmem();

      // CPU limits для cgroups v2
      try {
        const cpuMax = await fs.readFile('/sys/fs/cgroup/cpu.max', 'utf8');
        const [quotaStr, periodStr] = cpuMax.trim().split(' ');
        const period = parseInt(periodStr);
        
        if (quotaStr !== 'max' && period > 0) {
          const quota = parseInt(quotaStr);
          if (quota > 0) {
            cpuLimit = quota / period;
          }
        }
      } catch (error) {
        // Пробуем cgroups v1 как fallback
        try {
          const cpuQuota = await fs.readFile('/sys/fs/cgroup/cpu/cpu.cfs_quota_us', 'utf8');
          const cpuPeriod = await fs.readFile('/sys/fs/cgroup/cpu/cpu.cfs_period_us', 'utf8');
          
          const quota = parseInt(cpuQuota.trim());
          const period = parseInt(cpuPeriod.trim());
          
          if (quota > 0 && period > 0) {
            cpuLimit = quota / period;
          }
        } catch (error) {
          console.log('⚠️ Using default CPU limit');
        }
      }

      // Memory limits для cgroups v2
      try {
        const memoryMax = await fs.readFile('/sys/fs/cgroup/memory.max', 'utf8');
        const maxStr = memoryMax.trim();
        
        if (maxStr !== 'max') {
          const max = parseInt(maxStr);
          if (max > 0 && max < Number.MAX_SAFE_INTEGER) {
            memoryLimit = max;
          }
        }
      } catch (error) {
        // Пробуем cgroups v1 как fallback
        try {
          const memoryLimitFile = await fs.readFile('/sys/fs/cgroup/memory/memory.limit_in_bytes', 'utf8');
          const limit = parseInt(memoryLimitFile.trim());
          
          if (limit > 0 && limit < Number.MAX_SAFE_INTEGER) {
            memoryLimit = limit;
          }
        } catch (error) {
          console.log('⚠️ Using default memory limit');
        }
      }

      this.containerCpuLimit = cpuLimit;
      this.containerMemoryLimit = memoryLimit;
      
      console.log('📦 Container limits loaded:', {
        cpu: this.containerCpuLimit,
        memory: `${Math.round(this.containerMemoryLimit / 1024 / 1024)}MB`
      });
      
    } catch (error) {
      console.log('⚠️ Using default limits (not in container or cannot read cgroups)');
      this.containerCpuLimit = os.cpus().length;
      this.containerMemoryLimit = os.totalmem();
    }
  }

  public startRequest(): void {
    this.activeRequests++;
    this.totalRequests++;
  }

  public completeRequest(): void {
    this.activeRequests = Math.max(0, this.activeRequests - 1);
  }

  public async canHandleOnServer(): Promise<boolean> {
    if (this.isCircuitOpen()) {
      console.log('🔴 Circuit breaker OPEN - forcing client-side');
      this.clientOperations++;
      this.rejectionReasons.circuitBreaker++;
      return false;
    }

    try {
      const containerMetrics = await this.getContainerMetrics();

      // Логируем метрики для диагностики
      console.log('📊 Load Balancer Metrics:', {
        cpu: `${(containerMetrics.cpuUsage * 100).toFixed(1)}%`,
        memory: `${(containerMetrics.memoryUsage * 100).toFixed(1)}%`,
        activeRequests: containerMetrics.activeRequests,
        thresholds: this.thresholds
      });

      const healthCheck = this.isSystemHealthy(containerMetrics);
      const isHealthy = healthCheck.healthy;
      
      if (isHealthy) {
        this.serverOperations++;
        logger.info(`✅ Processing on SERVER - ${healthCheck.reason}`);
      } else {
        this.clientOperations++;
        this.rejectionReasons[healthCheck.reason as keyof typeof this.rejectionReasons]++;
        logger.info(`🔄 Redirecting to CLIENT - ${healthCheck.details}`);
      }
      
      this.updateCircuitBreaker(isHealthy);
      return isHealthy;

    } catch (error) {
      logger.error('❌ Error in load balancer:', error);
      this.recordCircuitBreakerFailure();
      this.clientOperations++;
      this.rejectionReasons.circuitBreaker++;
      return false;
    }
  }

  private async getContainerMetrics(): Promise<ContainerMetrics> {
    const memoryUsage = process.memoryUsage().heapUsed / this.containerMemoryLimit;
    
    // Измеряем CPU usage для этого конкретного запроса
    const cpuUsage = await this.measureCurrentCpuUsage();

    return {
      cpuUsage,
      memoryUsage,
      activeRequests: this.activeRequests
    };
  }

  private async measureCurrentCpuUsage(): Promise<number> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const startUsage = process.cpuUsage();
      
      // Ждем 100ms для измерения CPU usage
      setTimeout(() => {
        const endTime = Date.now();
        const endUsage = process.cpuUsage();
        
        const timeDiff = endTime - startTime; // в миллисекундах
        const usageDiff = (endUsage.user - startUsage.user) + (endUsage.system - startUsage.system); // в микросекундах
        
        // Максимально возможное использование за timeDiff для контейнера:
        // timeDiff (ms) * 1000 (microseconds/ms) * containerCpuLimit (cores)
        const maxUsage = timeDiff * 1000 * this.containerCpuLimit;
        
        let cpuUsage = 0;
        if (maxUsage > 0) {
          cpuUsage = usageDiff / maxUsage;
        }
        
        // Ограничиваем 100%
        resolve(Math.min(cpuUsage, 1));
      }, 100); // Измеряем за 100ms
    });
  }

  private isSystemHealthy(container: ContainerMetrics): { 
    healthy: boolean; 
    reason: string;
    details: string;
  } {
    const metrics = {
      cpu: container.cpuUsage,
      memory: container.memoryUsage,
      activeRequests: container.activeRequests
    };

    console.log('🔍 Health Check - Current vs Thresholds:', {
      cpu: `${(metrics.cpu * 100).toFixed(1)}% vs ${(this.thresholds.cpu * 100).toFixed(1)}%`,
      memory: `${(metrics.memory * 100).toFixed(1)}% vs ${(this.thresholds.memory * 100).toFixed(1)}%`,
      activeRequests: `${metrics.activeRequests} vs ${this.thresholds.activeRequests}`
    });

    // Проверяем каждый порог отдельно
    if (metrics.cpu >= this.thresholds.cpu) {
      return {
        healthy: false,
        reason: 'cpu',
        details: `CPU usage ${(metrics.cpu * 100).toFixed(1)}% exceeds threshold ${(this.thresholds.cpu * 100).toFixed(1)}%`
      };
    }

    if (metrics.memory >= this.thresholds.memory) {
      return {
        healthy: false,
        reason: 'memory',
        details: `Memory usage ${(metrics.memory * 100).toFixed(1)}% exceeds threshold ${(this.thresholds.memory * 100).toFixed(1)}%`
      };
    }

    if (metrics.activeRequests >= this.thresholds.activeRequests) {
      return {
        healthy: false,
        reason: 'activeRequests',
        details: `Active requests ${metrics.activeRequests} exceeds threshold ${this.thresholds.activeRequests}`
      };
    }

    return {
      healthy: true,
      reason: 'healthy',
      details: 'All metrics within acceptable thresholds'
    };
  }

  private isCircuitOpen(): boolean {
    if (this.circuitBreakerState === 'OPEN') {
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
  }

  public getStats(): LoadBalancerStats {
    const totalProcessed = this.serverOperations + this.clientOperations;
    const serverPercentage = totalProcessed > 0 ? (this.serverOperations / totalProcessed) * 100 : 0;
    const clientPercentage = totalProcessed > 0 ? (this.clientOperations / totalProcessed) * 100 : 0;

    return {
      totalRequests: this.totalRequests,
      serverOperations: this.serverOperations,
      clientOperations: this.clientOperations,
      serverPercentage: Math.round(serverPercentage * 100) / 100,
      clientPercentage: Math.round(clientPercentage * 100) / 100,
      rejectionReasons: { ...this.rejectionReasons }
    };
  }

  public logStats(): void {
    const stats = this.getStats();
    
    console.log('\n📈 ===== LOAD BALANCER STATISTICS =====');
    console.log(`📊 Total Requests: ${stats.totalRequests}`);
    console.log(`🟢 Server Operations: ${stats.serverOperations} (${stats.serverPercentage}%)`);
    console.log(`🟡 Client Operations: ${stats.clientOperations} (${stats.clientPercentage}%)`);
    console.log('🔍 Rejection Reasons:');
    console.log(`   • CPU: ${stats.rejectionReasons.cpu}`);
    console.log(`   • Memory: ${stats.rejectionReasons.memory}`);
    console.log(`   • Active Requests: ${stats.rejectionReasons.activeRequests}`);
    console.log(`   • Circuit Breaker: ${stats.rejectionReasons.circuitBreaker}`);
    console.log('=====================================\n');
  }

  public updateThresholds(newThresholds: Partial<typeof this.thresholds>): void {
    Object.assign(this.thresholds, newThresholds);
    console.log('🔄 Thresholds updated:', this.thresholds);
  }

  public async getCurrentMetrics(): Promise<ContainerMetrics> {
    return this.getContainerMetrics();
  }

  public getCurrentThresholds(): typeof this.thresholds {
    return { ...this.thresholds };
  }

  public resetStats(): void {
    this.totalRequests = 0;
    this.serverOperations = 0;
    this.clientOperations = 0;
    this.rejectionReasons = {
      cpu: 0,
      memory: 0,
      activeRequests: 0,
      circuitBreaker: 0
    };
    console.log('🔄 Statistics reset');
  }
}

export default new ContainerLoadBalancer();