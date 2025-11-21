// consts.ts

/**
 * Начальные данные для алгоритмов
 */

// Данные для пузырьковой сортировки
export const BUBBLE_SORT_INPUT = Array.from({ length: 8000 }, () => 
  Math.floor(Math.random() * 100000)
);

// Данные для чисел Фибоначчи
export const FIBONACCI_INPUT = 35; // Достаточно большое число для демонстрации медленной работы

// Данные для генерации перестановок
export const PERMUTATIONS_INPUT = 8; // Для n=8 будет 40320 перестановок - достаточно для нагрузки

/**
 * Большие наборы данных для тестирования производительности
 */
export const PERFORMANCE_TEST_DATA = {
  // Большой массив для сортировки
  LARGE_ARRAY: Array.from({ length: 10000 }, () => Math.floor(Math.random() * 100000)),
  
  // Большое число для Фибоначчи
  LARGE_FIBONACCI: 42,
  
  // Большое число для перестановок (осторожно - очень ресурсоемко!)
  LARGE_PERMUTATIONS: 10 // 10! = 3,628,800 перестановок
};

export default {
  BUBBLE_SORT_INPUT,
  FIBONACCI_INPUT,
  PERMUTATIONS_INPUT,
  PERFORMANCE_TEST_DATA
};