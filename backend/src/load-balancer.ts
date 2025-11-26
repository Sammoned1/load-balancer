// load-balancer.ts

class LoadBalancer {
  private activeRequests: number = 0;
  private readonly maxConcurrentRequests: number = 3; // Максимум одновременных запросов
  private readonly cpuThreshold: number = 60; // Порог загрузки CPU в %
  
  /**
   * Регистрируем начало обработки запроса
   */
  public startRequest(): void {
    this.activeRequests++;
    console.log(`Active requests: ${this.activeRequests}`);
  }
  
  /**
   * Регистрируем завершение обработки запроса
   */
  public completeRequest(): void {
    this.activeRequests = Math.max(0, this.activeRequests - 1);
    console.log(`Active requests: ${this.activeRequests}`);
  }
  
  /**
   * Проверяем, может ли сервер принять новую задачу
   */
  public canHandleRequest(): boolean {
    const isUnderRequestLimit = this.activeRequests < this.maxConcurrentRequests;
    const isCpuUnderThreshold = this.getCpuUsage() < this.cpuThreshold;
    
    return isUnderRequestLimit && isCpuUnderThreshold;
  }
  
  /**
   * Получаем текущую загрузку CPU (упрощённо)
   */
  private getCpuUsage(): number {
    // В реальной системе здесь был бы мониторинг CPU
    // Для демо используем случайное значение или фиксированный порог
    return Math.random() * 100;
  }
  
  /**
   * Получаем текущую нагрузку сервера
   */
  public getLoadInfo(): { activeRequests: number; maxRequests: number; cpuUsage: number } {
    return {
      activeRequests: this.activeRequests,
      maxRequests: this.maxConcurrentRequests,
      cpuUsage: this.getCpuUsage()
    };
  }
}

export default new LoadBalancer();