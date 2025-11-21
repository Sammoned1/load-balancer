import { type AxiosInstance } from 'axios';

export interface DynamicResponse {
  success: boolean;
  algorithm: string;
  message?: string;
  input?: number | number[];
  result?: number | number[] | number[][];
  inputLength?: number;
  resultCount?: number;
  sample?: number[][];
  performance?: string;
}

const dynamicApi = (apiClient: AxiosInstance) => ({
  /**
   * Вызов пузырьковой сортировки в динамическом режиме
   */
  bubbleSort: async (): Promise<DynamicResponse> => {
    const response = await apiClient.post<DynamicResponse>('/dynamic/bubble-sort');
    return response.data;
  },

  /**
   * Вызов вычисления чисел Фибоначчи в динамическом режиме
   */
  fibonacci: async (): Promise<DynamicResponse> => {
    const response = await apiClient.post<DynamicResponse>('/dynamic/fibonacci');
    return response.data;
  },

  /**
   * Вызов генерации перестановок в динамическом режиме
   */
  permutations: async (): Promise<DynamicResponse> => {
    const response = await apiClient.post<DynamicResponse>('/dynamic/permutations');
    return response.data;
  },
});

export default dynamicApi;