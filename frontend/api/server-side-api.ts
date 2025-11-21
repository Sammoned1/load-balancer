import { type AxiosInstance } from 'axios';

export interface BubbleSortResponse {
  success: boolean;
  algorithm: string;
  input: number[];
  result: number[];
  inputLength: number;
  executionTime: string;
  performance: string;
}

export interface FibonacciResponse {
  success: boolean;
  algorithm: string;
  input: number;
  result: number;
  executionTime: string;
  performance: string;
}

export interface PermutationsResponse {
  success: boolean;
  algorithm: string;
  input: number;
  resultCount: number;
  sample: number[][];
  executionTime: string;
  performance: string;
}

export interface PerformanceTestResponse {
  success: boolean;
  algorithm: string;
  inputLength?: number;
  input?: number;
  resultCount?: number;
  result?: number | string;
}

const serverSideApi = (apiClient: AxiosInstance) => ({
  /**
   * Вызов пузырьковой сортировки на сервере
   */
  bubbleSort: async (): Promise<BubbleSortResponse> => {
    const response = await apiClient.post<BubbleSortResponse>('/server-side/bubble-sort');
    return response.data;
  },

  /**
   * Вызов вычисления чисел Фибоначчи на сервере
   */
  fibonacci: async (): Promise<FibonacciResponse> => {
    const response = await apiClient.post<FibonacciResponse>('/server-side/fibonacci');
    return response.data;
  },

  /**
   * Вызов генерации перестановок на сервере
   */
  permutations: async (): Promise<PermutationsResponse> => {
    const response = await apiClient.post<PermutationsResponse>('/server-side/permutations');
    return response.data;
  },

  /**
   * Тест производительности с большими данными
   */
  performanceTest: async (algorithm: string): Promise<PerformanceTestResponse> => {
    const response = await apiClient.post<PerformanceTestResponse>('/server-side/performance-test', {
      algorithm
    });
    return response.data;
  },
});

export default serverSideApi;