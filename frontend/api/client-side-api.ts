import { type AxiosInstance } from 'axios';

export interface ClientSideResponse {
  success: boolean;
  algorithm: string;
  functionSource: string;
  inputData: number | number[];
  instructions: string;
}

const clientSideApi = (apiClient: AxiosInstance) => ({
  bubbleSort: async (): Promise<ClientSideResponse> => {
    const response = await apiClient.get<ClientSideResponse>('/client-side/bubble-sort');
    return response.data;
  },

  fibonacci: async (): Promise<ClientSideResponse> => {
    const response = await apiClient.get<ClientSideResponse>('/client-side/fibonacci');
    return response.data;
  },

  permutations: async (): Promise<ClientSideResponse> => {
    const response = await apiClient.get<ClientSideResponse>('/client-side/permutations');
    return response.data;
  },
});

export default clientSideApi;