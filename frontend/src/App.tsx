import React, { useState } from 'react';
import './App.css';
import { api } from '../api/index';

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
  error?: string;
}

const App: React.FC = () => {
  const [loading, setLoading] = useState<{ [key: string]: boolean }>({});
  const [results, setResults] = useState<{ [key: string]: ApiResult }>({});

  // Функция для выполнения кода на клиенте
  const executeCodeOnClient = (functionSource: string, inputData: number | number[]): { result: number | number[] | number[][]; executionTime: string } => {
    try {
      const startTime = performance.now();
      
      // Создаем функцию из исходного кода
      const fn = new Function('return ' + functionSource)();
      
      // Вызываем функцию с входными данными
      const result = fn(inputData);
      
      const endTime = performance.now();
      
      return {
        result,
        executionTime: `${(endTime - startTime).toFixed(2)} ms`
      };
    } catch (error) {
      throw new Error(`Execution error: ${error}`);
    }
  };

  // Общий handler для Server-Side и Dynamic
  const handleApiCall = async (apiCall: () => Promise<ServerSideResult>, key: string) => {
    setLoading(prev => ({ ...prev, [key]: true }));
    
    try {
      const result = await apiCall();
      setResults(prev => ({ ...prev, [key]: result }));
      console.log(`API Response for ${key}:`, result);
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
      // 1. Получаем исходный код функции и данные с сервера
      const response = await apiCall();

      console.log("RESPONSE", response);
      
      
      // 2. Выполняем функцию на клиенте
      const clientResult = executeCodeOnClient(response.functionSource, response.inputData);
      
      // 3. Сохраняем результаты
      setResults(prev => ({ 
        ...prev, 
        [key]: {
          ...response,
          clientExecutionTime: clientResult.executionTime,
          clientResult: clientResult.result
        }
      }));
      
      console.log(`Client execution for ${key}:`, clientResult);
      
    } catch (error) {
      console.error(`Client execution error for ${key}:`, error);
      setResults(prev => ({ 
        ...prev, 
        [key]: { error: `Failed: ${error instanceof Error ? error.message : error}` } 
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
  // const handleDynamicBubbleSort = () => 
  //   handleApiCall(() => api.dynamic.bubbleSort(), 'dynamic-bubble-sort');
  
  // const handleDynamicFibonacci = () => 
  //   handleApiCall(() => api.dynamic.fibonacci(), 'dynamic-fibonacci');
  
  // const handleDynamicPermutations = () => 
  //   handleApiCall(() => api.dynamic.permutations(), 'dynamic-permutations');

  // Render функция для Server-Side и Dynamic кнопок
  const renderServerButton = (
    onClick: () => void, 
    label: string, 
    loadingKey: string,
    resultKey: string
  ) => (
    <div className="button-wrapper">
      <button 
        className="button" 
        onClick={onClick}
        disabled={loading[loadingKey]}
      >
        {loading[loadingKey] ? 'Loading...' : label}
      </button>
      {results[resultKey] && (
        <div className="result">
          {results[resultKey].error ? (
            <span className="error">Error: {results[resultKey].error}</span>
          ) : (
            <div className="success-info">
              <div>Success!</div>
              <div className="execution-time">
                Time: {results[resultKey].executionTime}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  // Render функция для Client-Side кнопок
  const renderClientButton = (
    onClick: () => void, 
    label: string, 
    loadingKey: string,
    resultKey: string
  ) => (
    <div className="button-wrapper">
      <button 
        className="button" 
        onClick={onClick}
        disabled={loading[loadingKey]}
      >
        {loading[loadingKey] ? 'Loading...' : label}
      </button>
      {results[resultKey] && (
        <div className="result">
          {results[resultKey].error ? (
            <span className="error">Error: {results[resultKey].error}</span>
          ) : (
            <div className="success-info">
              <div>Client Execution</div>
              <div className="execution-time">
                Time: {results[resultKey].clientExecutionTime}
              </div>
              {/* {results[resultKey].clientResult && (
                <div className="result-preview">
                  Result: {typeof results[resultKey].clientResult === 'number' 
                    ? results[resultKey].clientResult 
                    : Array.isArray(results[resultKey].clientResult)
                    ? `Array[${(results[resultKey].clientResult as number[] | number[][]).length}]`
                    : 'Calculated'
                  }
                </div>
              )} */}
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="app">
      <h1 className="main-title">Load-Balancer</h1>
      
      <div className="blocks-container">
        {/* Server-Side Block */}
        <div className="block">
          <h2 className="block-title">Server-Side</h2>
          <div className="buttons-container">
            {renderServerButton(handleServerBubbleSort, 'Bubble Sort', 'server-bubble-sort', 'server-bubble-sort')}
            {renderServerButton(handleServerFibonacci, 'Fibonacci', 'server-fibonacci', 'server-fibonacci')}
            {renderServerButton(handleServerPermutations, 'Permutations', 'server-permutations', 'server-permutations')}
          </div>
        </div>

        {/* Client-Side Block */}
        <div className="block">
          <h2 className="block-title">Client-Side</h2>
          <div className="buttons-container">
            {renderClientButton(handleClientBubbleSort, 'Bubble Sort', 'client-bubble-sort', 'client-bubble-sort')}
            {renderClientButton(handleClientFibonacci, 'Fibonacci', 'client-fibonacci', 'client-fibonacci')}
            {renderClientButton(handleClientPermutations, 'Permutations', 'client-permutations', 'client-permutations')}
          </div>
        </div>

        {/* Dynamic Block */}
        <div className="block">
          <h2 className="block-title">Dynamic</h2>
          <div className="buttons-container">
            {/* {renderServerButton(handleDynamicBubbleSort, 'Bubble Sort', 'dynamic-bubble-sort', 'dynamic-bubble-sort')}
            {renderServerButton(handleDynamicFibonacci, 'Fibonacci', 'dynamic-fibonacci', 'dynamic-fibonacci')}
            {renderServerButton(handleDynamicPermutations, 'Permutations', 'dynamic-permutations', 'dynamic-permutations')} */}
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;