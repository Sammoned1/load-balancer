import React from 'react';
import { type PerformanceChartProps, type ChartData } from '../types/performance';

const PerformanceChart: React.FC<PerformanceChartProps> = ({ algorithm, data }) => {
  // Фильтруем данные по алгоритму
  const algorithmData = data.filter(point => point.algorithm === algorithm);
  
  if (algorithmData.length === 0) {
    return (
      <div className="performance-chart">
        <h3 className="chart-title">{algorithm} - Performance History</h3>
        <div className="no-data">No data available</div>
      </div>
    );
  }

  // Преобразуем данные для графика
  const chartData: ChartData = {
    server: algorithmData
      .filter(point => point.executedOn === 'server')
      .map(point => ({
        x: new Date(point.timestamp),
        y: point.executionTime
      })),
    client: algorithmData
      .filter(point => point.executedOn === 'client')
      .map(point => ({
        x: new Date(point.timestamp),
        y: point.executionTime
      }))
  };

  // Улучшенное масштабирование - используем динамический диапазон
  const allTimes = [...chartData.server.map(d => d.y), ...chartData.client.map(d => d.y)];
  const minTime = Math.min(...allTimes);
  const maxTime = Math.max(...allTimes);
  
  // Добавляем отступы для лучшего отображения
  const timeRange = maxTime - minTime;
  const padding = timeRange * 0.1; // 10% от диапазона
  const displayMin = Math.max(0, minTime - padding);
  const displayMax = maxTime + padding;

  const chartHeight = 200;
  const chartWidth = 400;
  const paddingPx = 40;

  const formatTime = (ms: number): string => {
    return `${ms.toFixed(0)}ms`;
  };

  // Функции для преобразования координат
  const scaleX = (date: Date): number => {
    const dates = [...chartData.server.map(d => d.x), ...chartData.client.map(d => d.x)];
    const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
    const timeRange = maxDate.getTime() - minDate.getTime() || 1;
    
    return paddingPx + ((date.getTime() - minDate.getTime()) / timeRange) * (chartWidth - paddingPx * 2);
  };

  const scaleY = (value: number): number => {
    return chartHeight - paddingPx - ((value - displayMin) / (displayMax - displayMin)) * (chartHeight - paddingPx * 2);
  };

  // Создаем SVG path для линии
  const createPath = (points: { x: Date; y: number }[]): string => {
    if (points.length === 0) return '';
    
    return points.map((point, index) => {
      const x = scaleX(point.x);
      const y = scaleY(point.y);
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');
  };

  // Генерируем метки для оси Y
  const generateYLabels = (): { position: number; label: string }[] => {
    const steps = 5;
    const labels = [];
    
    for (let i = 0; i <= steps; i++) {
      const value = displayMin + (i / steps) * (displayMax - displayMin);
      const position = scaleY(value);
      labels.push({
        position,
        label: formatTime(value)
      });
    }
    
    return labels;
  };

  return (
    <div className="performance-chart">
      <h3 className="chart-title">{algorithm} - Performance History</h3>
      <svg width={chartWidth} height={chartHeight} className="chart-svg">
        {/* Сетка */}
        <defs>
          <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
            <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#e9ecef" strokeWidth="1"/>
          </pattern>
        </defs>
        
        <rect width={chartWidth} height={chartHeight} fill="#f8f9fa" />
        
        {/* Ось Y с метками */}
        {generateYLabels().map((label, index) => (
          <g key={index}>
            <line 
              x1={paddingPx} y1={label.position} 
              x2={chartWidth - paddingPx} y2={label.position} 
              stroke="#dee2e6" strokeWidth="1" strokeDasharray="2,2"
            />
            <text 
              x={paddingPx - 5} 
              y={label.position} 
              textAnchor="end" 
              fill="#6c757d"
              fontSize="10"
              dy="0.3em"
            >
              {label.label}
            </text>
          </g>
        ))}
        
        {/* Оси */}
        <line 
          x1={paddingPx} y1={paddingPx} 
          x2={paddingPx} y2={chartHeight - paddingPx} 
          stroke="#dee2e6" strokeWidth="2" 
        />
        <line 
          x1={paddingPx} y1={chartHeight - paddingPx} 
          x2={chartWidth - paddingPx} y2={chartHeight - paddingPx} 
          stroke="#dee2e6" strokeWidth="2" 
        />
        
        {/* Линия сервера */}
        {chartData.server.length > 0 && (
          <path
            d={createPath(chartData.server)}
            fill="none"
            stroke="#4CAF50"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        
        {/* Линия клиента */}
        {chartData.client.length > 0 && (
          <path
            d={createPath(chartData.client)}
            fill="none"
            stroke="#FF9800"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        
        {/* Точки сервера */}
        {chartData.server.map((point, index) => (
          <circle
            key={index}
            cx={scaleX(point.x)}
            cy={scaleY(point.y)}
            r="5"
            fill="#4CAF50"
            stroke="#fff"
            strokeWidth="2"
          />
        ))}
        
        {/* Точки клиента */}
        {chartData.client.map((point, index) => (
          <circle
            key={index}
            cx={scaleX(point.x)}
            cy={scaleY(point.y)}
            r="5"
            fill="#FF9800"
            stroke="#fff"
            strokeWidth="2"
          />
        ))}
        
        {/* Легенда */}
        <g transform={`translate(${chartWidth - 120}, 20)`}>
          <rect x="0" y="0" width="100" height="40" fill="#ffffff" stroke="#dee2e6" rx="4" />
          <circle cx="10" cy="12" r="4" fill="#4CAF50" />
          <text x="20" y="15" fill="#333" fontSize="12">Server</text>
          <circle cx="10" cy="27" r="4" fill="#FF9800" />
          <text x="20" y="30" fill="#333" fontSize="12">Client</text>
        </g>
      </svg>
      
      {/* Статистика */}
      <div className="chart-stats">
        <div className="stat">
          <span className="stat-label">Time Range:</span>
          <span className="stat-value">{formatTime(displayMin)} - {formatTime(displayMax)}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Server Executions:</span>
          <span className="stat-value">{chartData.server.length}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Client Executions:</span>
          <span className="stat-value">{chartData.client.length}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Data Points:</span>
          <span className="stat-value">{algorithmData.length}</span>
        </div>
      </div>
    </div>
  );
};

export default PerformanceChart;