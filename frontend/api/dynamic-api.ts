import { type AxiosInstance } from 'axios';

export interface LoadInfo {
  activeRequests: number;
  maxRequests: number;
  cpuUsage: number;
}

export interface ServerSideDynamicResponse {
  success: true;
  algorithm: string;
  executedOn: 'server';
  executionTime: string;
  result?: number | number[] | number[][];
  input?: number | number[];
  inputLength?: number;
  resultCount?: number;
  sample?: number[][];
  loadInfo: LoadInfo;
}

export interface ClientSideDynamicResponse {
  success: true;
  algorithm: string;
  executedOn: 'client';
  functionSource: string;
  inputData: number | number[];
  instructions: string;
  loadInfo: LoadInfo;
}

export type DynamicResponse = ServerSideDynamicResponse | ClientSideDynamicResponse;

const dynamicApi = (apiClient: AxiosInstance) => ({
  bubbleSort: async (): Promise<DynamicResponse> => {
    const response = await apiClient.post<DynamicResponse>('/dynamic/bubble-sort');
    return response.data;
  },

  fibonacci: async (): Promise<DynamicResponse> => {
    const response = await apiClient.post<DynamicResponse>('/dynamic/fibonacci');
    return response.data;
  },

  permutations: async (): Promise<DynamicResponse> => {
    const response = await apiClient.post<DynamicResponse>('/dynamic/permutations');
    return response.data;
  },
});

export default dynamicApi;