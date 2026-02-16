import React, { useCallback, useEffect, useRef, useState } from 'react';
import './App.css';
import { api } from '../api/index';
import type { PerformanceDataPoint } from './types/performance';
import PerformanceChart from './components/PerformanceChart';

interface LoadInfo {
  activeRequests: number;
  maxRequests: number;
  cpuUsage: number;
}

interface ServerSideResult {
  success: boolean;
  algorithm: string;
  executionTime: string;
  result?: number | number[] | number[][];
  input?: number | number[];
  inputLength?: number;
  resultCount?: number;
  sample?: number[][];
  performance: string;
}

interface ClientSideResponse {
  success: boolean;
  algorithm: string;
  functionSource: string;
  inputData: number | number[];
  instructions: string;
}

interface ServerDynamicResponse {
  success: boolean;
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

interface ClientDynamicResponse {
  success: boolean;
  algorithm: string;
  executedOn: 'client';
  functionSource: string;
  inputData: number | number[];
  instructions: string;
  loadInfo: LoadInfo;
}

type DynamicResponse = ServerDynamicResponse | ClientDynamicResponse;

interface ApiResult {
  success?: boolean;
  algorithm?: string;
  // Server-Side fields
  executionTime?: string;
  result?: number | number[] | number[][];
  input?: number | number[];
  inputLength?: number;
  resultCount?: number;
  sample?: number[][];
  performance?: string;
  // Client-Side fields
  functionSource?: string;
  inputData?: number | number[];
  instructions?: string;
  clientExecutionTime?: string;
  clientResult?: number | number[] | number[][];
  // Dynamic fields
  executedOn?: 'server' | 'client';
  loadInfo?: LoadInfo;
  error?: string;
}

const App: React.FC = () => {
  const [loading, setLoading] = useState<{ [key: string]: boolean }>({});
  const [results, setResults] = useState<{ [key: string]: ApiResult }>({});
  const [performanceData, setPerformanceData] = useState<PerformanceDataPoint[]>([]);
  const [lastUpdate, setLastUpdate] = useState<number>(Date.now());

  // useRef для хранения данных, которые не вызывают ререндер
  const performanceDataRef = useRef<PerformanceDataPoint[]>([]);

  // Функция для добавления точки данных в график
  const addPerformanceData = useCallback((dataPoint: Omit<PerformanceDataPoint, 'timestamp'>) => {
    const newDataPoint: PerformanceDataPoint = {
      ...dataPoint,
      timestamp: Date.now()
    };
    
    performanceDataRef.current = [...performanceDataRef.current, newDataPoint].slice(-100); // храним последние 100 точек
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (performanceDataRef.current.length > 0) {
        setPerformanceData(performanceDataRef.current);
        setLastUpdate(Date.now());
        console.log('Charts updated with', performanceDataRef.current.length, 'data points');
      }
    }, 5000); // Обновляем каждые 5 секунд

    return () => clearInterval(interval);
  }, []);

  // Функция для выполнения кода на клиенте
  const executeCodeOnClient = (functionSource: string, inputData: number | number[]): { result: number | number[] | number[][]; executionTime: string } => {
    try {
      const startTime = performance.now();
      
      // Создаем функцию из исходного кода
      const fn = new Function('return ' + functionSource)();
      
      // Вызываем функцию с входными данными
      const result = fn(inputData);
      
      const endTime = performance.now();
      const executionTime = `${(endTime - startTime).toFixed(2)} ms`;
      
      console.log(`Client execution completed in ${executionTime}`);
      
      return {
        result,
        executionTime: executionTime
      };
    } catch (error) {
      console.error('Client execution error:', error);
      throw new Error(`Execution error: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  // Общий handler для Server-Side и Dynamic
  const handleApiCall = async (apiCall: () => Promise<ServerSideResult>, key: string) => {
    setLoading(prev => ({ ...prev, [key]: true }));
    
    try {
      const result = await apiCall();
      setResults(prev => ({ ...prev, [key]: result }));
    } catch (error) {
      console.error(`API Error for ${key}:`, error);
      setResults(prev => ({ 
        ...prev, 
        [key]: { error: 'Failed to execute operation' } 
      }));
    } finally {
      setLoading(prev => ({ ...prev, [key]: false }));
    }
  };

  // Специальный handler для Client-Side вызовов
  const handleClientApiCall = async (apiCall: () => Promise<ClientSideResponse>, key: string) => {
    setLoading(prev => ({ ...prev, [key]: true }));
    
    try {
      const response = await apiCall();
      const clientResult = executeCodeOnClient(response.functionSource, response.inputData);
      
      setResults(prev => ({ 
        ...prev, 
        [key]: {
          ...response,
          clientExecutionTime: clientResult.executionTime,
          clientResult: clientResult.result
        }
      }));
    } catch (error) {
      console.error(`Client execution error for ${key}:`, error);
      setResults(prev => ({ 
        ...prev, 
        [key]: { error: `Failed: ${error instanceof Error ? error.message : String(error)}` } 
      }));
    } finally {
      setLoading(prev => ({ ...prev, [key]: false }));
    }
  };

  const handleDynamicApiCall = async (apiCall: () => Promise<DynamicResponse>, key: string, algorithm: string) => {
    setLoading(prev => ({ ...prev, [key]: true }));
    
    try {
      const response = await apiCall();
      
      if (response.executedOn === 'server') {
        // Добавляем данные серверного выполнения
        const executionTimeMs = parseFloat(response.executionTime.replace(' ms', ''));
        addPerformanceData({
          algorithm: algorithm,
          executionTime: executionTimeMs,
          executedOn: 'server',
          loadInfo: response.loadInfo
        });
        
        setResults(prev => ({ ...prev, [key]: response }));
      } else {
        // Client-side выполнение
        const clientResult = executeCodeOnClient(response.functionSource, response.inputData);
        const executionTimeMs = parseFloat(clientResult.executionTime.replace(' ms', ''));
        
        // Добавляем данные клиентского выполнения
        addPerformanceData({
          algorithm: algorithm,
          executionTime: executionTimeMs,
          executedOn: 'client',
          loadInfo: response.loadInfo
        });
        
        setResults(prev => ({ 
          ...prev, 
          [key]: {
            ...response,
            clientExecutionTime: clientResult.executionTime,
            clientResult: clientResult.result
          }
        }));
      }
    } catch (error) {
      console.error(`Dynamic execution error for ${key}:`, error);
      setResults(prev => ({ 
        ...prev, 
        [key]: { error: `Failed: ${error instanceof Error ? error.message : String(error)}` } 
      }));
    } finally {
      setLoading(prev => ({ ...prev, [key]: false }));
    }
  };

  // Server-Side handlers
  const handleServerBubbleSort = () => 
    handleApiCall(() => api.serverSide.bubbleSort(), 'server-bubble-sort');
  
  const handleServerFibonacci = () => 
    handleApiCall(() => api.serverSide.fibonacci(), 'server-fibonacci');
  
  const handleServerPermutations = () => 
    handleApiCall(() => api.serverSide.permutations(), 'server-permutations');

  // Client-Side handlers
  const handleClientBubbleSort = () => 
    handleClientApiCall(() => api.clientSide.bubbleSort(), 'client-bubble-sort');
  
  const handleClientFibonacci = () => 
    handleClientApiCall(() => api.clientSide.fibonacci(), 'client-fibonacci');
  
  const handleClientPermutations = () => 
    handleClientApiCall(() => api.clientSide.permutations(), 'client-permutations');

  // Dynamic handlers
  const handleDynamicBubbleSort = () => 
    handleDynamicApiCall(() => api.dynamic.bubbleSort(), 'dynamic-bubble-sort', 'bubble-sort');

  const handleDynamicFibonacci = () => 
    handleDynamicApiCall(() => api.dynamic.fibonacci(), 'dynamic-fibonacci', 'fibonacci');

  const handleDynamicPermutations = () => 
    handleDynamicApiCall(() => api.dynamic.permutations(), 'dynamic-permutations', 'permutations');

  // Render функция для Server-Side и Dynamic кнопок
  const renderServerRow = (
    onClick: () => void, 
    label: string, 
    loadingKey: string,
    resultKey: string
  ) => (
    <div className="button-row">
      <button 
        className="button" 
        onClick={onClick}
        disabled={loading[loadingKey]}
      >
        {loading[loadingKey] ? 'Loading...' : label}
      </button>
      <div className="result-display">
        {results[resultKey] ? (
          results[resultKey].error ? (
            <div className="status error">❌ Error</div>
          ) : (
            <>
              <div className="status success">✅ Success</div>
              <div className="execution-info">
                <span className="execution-time">Time: {results[resultKey].executionTime}</span>
              </div>
            </>
          )
        ) : (
          <div className="status">⏳ Ready</div>
        )}
      </div>
    </div>
  );

  // Render функция для Client-Side кнопок
  const renderClientRow = (
    onClick: () => void, 
    label: string, 
    loadingKey: string,
    resultKey: string
  ) => (
    <div className="button-row">
      <button 
        className="button" 
        onClick={onClick}
        disabled={loading[loadingKey]}
      >
        {loading[loadingKey] ? 'Loading...' : label}
      </button>
      <div className="result-display">
        {results[resultKey] ? (
          results[resultKey].error ? (
            <div className="status error">❌ Error</div>
          ) : (
            <>
              <div className="status success">✅ Success</div>
              <div className="execution-info">
                <span className="execution-time">Time: {results[resultKey].clientExecutionTime || 'Calculating...'}</span>
              </div>
            </>
          )
        ) : (
          <div className="status">⏳ Ready</div>
        )}
      </div>
    </div>
  );

  const renderDynamicRow = (
    onClick: () => void, 
    label: string, 
    loadingKey: string,
    resultKey: string
  ) => (
    <div className="button-row">
      <button 
        className="button" 
        onClick={onClick}
        disabled={loading[loadingKey]}
      >
        {loading[loadingKey] ? 'Loading...' : label}
      </button>
      <div className="result-display">
        {results[resultKey] ? (
          results[resultKey].error ? (
            <div className="status error">❌ Error</div>
          ) : (
            <>
              <div className="status success">✅ Success</div>
              <div className="execution-info">
                <span className={`execution-location ${results[resultKey].executedOn}`}>
                  {results[resultKey].executedOn === 'server' ? '🟢 Server' : '🟡 Client'}
                </span>
                <span className="execution-time">
                  Time: {results[resultKey].executedOn === 'server' 
                    ? results[resultKey].executionTime 
                    : results[resultKey].clientExecutionTime || 'Calculating...'
                  }
                </span>
              </div>
            </>
          )
        ) : (
          <div className="status">⏳ Ready</div>
        )}
      </div>
    </div>
  );

  return (
    <div className="app">
      <h1 className="main-title">Load-Balancer</h1>
      
      {/* Индикатор обновления */}
      {/* <div className="update-indicator">
        Last update: {new Date(lastUpdate).toLocaleTimeString()}
        {performanceData.length > 0 && ` | Data points: ${performanceData.length}`}
      </div> */}
      
      {/* Графики производительности */}
      <div className="charts-container">
        <PerformanceChart algorithm="bubble-sort" data={performanceData} />
        <PerformanceChart algorithm="fibonacci" data={performanceData} />
        <PerformanceChart algorithm="permutations" data={performanceData} />
      </div>

      {/* Блоки с операциями */}
      <div className="blocks-container">
        {/* Server-Side Block */}
        <div className="block">
          <h2 className="block-title">Server-Side</h2>
          <div className="buttons-container">
            {renderServerRow(handleServerBubbleSort, 'Bubble Sort', 'server-bubble-sort', 'server-bubble-sort')}
            {renderServerRow(handleServerFibonacci, 'Fibonacci', 'server-fibonacci', 'server-fibonacci')}
            {renderServerRow(handleServerPermutations, 'Permutations', 'server-permutations', 'server-permutations')}
          </div>
        </div>

        {/* Client-Side Block */}
        <div className="block">
          <h2 className="block-title">Client-Side</h2>
          <div className="buttons-container">
            {renderClientRow(handleClientBubbleSort, 'Bubble Sort', 'client-bubble-sort', 'client-bubble-sort')}
            {renderClientRow(handleClientFibonacci, 'Fibonacci', 'client-fibonacci', 'client-fibonacci')}
            {renderClientRow(handleClientPermutations, 'Permutations', 'client-permutations', 'client-permutations')}
          </div>
        </div>

        {/* Dynamic Block */}
        <div className="block">
          <h2 className="block-title">Dynamic</h2>
          <div className="buttons-container">
            {renderDynamicRow(handleDynamicBubbleSort, 'Bubble Sort', 'dynamic-bubble-sort', 'dynamic-bubble-sort')}
            {renderDynamicRow(handleDynamicFibonacci, 'Fibonacci', 'dynamic-fibonacci', 'dynamic-fibonacci')}
            {renderDynamicRow(handleDynamicPermutations, 'Permutations', 'dynamic-permutations', 'dynamic-permutations')}
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;