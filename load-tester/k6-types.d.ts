// Типы для k6 окружения
declare module "k6" {
  export function sleep(seconds: number): void;
  
  export interface Options {
    stages?: Array<{
      duration: string;
      target: number;
    }>;
    thresholds?: {
      [key: string]: string[];
    };
  }
  
  export function check<T>(
    val: T,
    sets: { [key: string]: (val: T) => boolean },
    tags?: object
  ): boolean;
}

declare module "k6/http" {
  export interface Response {
    status: number;
    body: string;
    json(): any;
    timings: {
      duration: number;
    };
  }
  
  export function post(
    url: string, 
    body?: string | null, 
    params?: object
  ): Response;
}