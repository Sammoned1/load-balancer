import axios from 'axios';
import serverSideApi from './server-side-api';
import clientSideApi from './client-side-api';
import dynamicApi from './dynamic-api';

// Базовый URL для API (Vite использует import.meta.env)
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

// Создаем экземпляр axios с базовой конфигурацией
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 секунд таймаут для долгих операций
  headers: {
    'Content-Type': 'application/json',
  },
});

// Интерцептор для обработки ошибок
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

// Экспортируем объединенный API объект
export const api = {
  serverSide: serverSideApi(apiClient),
  clientSide: clientSideApi(apiClient),
  dynamic: dynamicApi(apiClient),
};

export default api;