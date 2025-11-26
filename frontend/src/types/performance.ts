// types/performance.ts

export interface PerformanceDataPoint {
  timestamp: number;
  algorithm: string;
  executionTime: number; // время в ms
  executedOn: 'server' | 'client';
  loadInfo?: {
    activeRequests: number;
    maxRequests: number;
    cpuUsage: number;
  };
}

export interface PerformanceChartProps {
  algorithm: string;
  data: PerformanceDataPoint[];
}

export type ChartData = {
  server: { x: Date; y: number }[];
  client: { x: Date; y: number }[];
};