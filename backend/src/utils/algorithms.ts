// algorithms.ts

/**
 * Пузырьковая сортировка (Bubble Sort)
 */
export const bubbleSort = (arr: number[]): number[] => {
  const array = [...arr];
  const n = array.length;
  
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < n - i - 1; j++) {
      if (array[j] > array[j + 1]) {
        [array[j], array[j + 1]] = [array[j + 1], array[j]];
      }
    }
  }
  return array;
};

/**
 * Рекурсивное вычисление чисел Фибоначчи
 * Самодостаточная версия для клиента
 */
export const fibonacci = (n: number): number => {
  const fib = (num: number): number => {
    if (num <= 1) return num;
    return fib(num - 1) + fib(num - 2);
  };
  
  if (n < 0) throw new Error('Fibonacci number must be non-negative');
  return fib(n);
};

/**
 * Генерация всех перестановок (Permutations)
 * Самодостаточная версия для клиента
 */
export const generatePermutations = <T>(arr: T[]): T[][] => {
  const permute = (items: T[]): T[][] => {
    if (items.length === 0) return [[]];
    
    const result: T[][] = [];
    
    for (let i = 0; i < items.length; i++) {
      const current = items[i];
      const remaining = [...items.slice(0, i), ...items.slice(i + 1)];
      const permutations = permute(remaining);
      
      for (const perm of permutations) {
        result.push([current, ...perm]);
      }
    }
    
    return result;
  };
  
  return permute(arr);
};

/**
 * Вспомогательная функция для генерации перестановок чисел
 */
export const generateNumberPermutations = (n: number): number[][] => {
  if (n > 10) {
    throw new Error('For performance reasons, n should not exceed 10');
  }
  
  const arr = Array.from({ length: n }, (_, i) => i + 1);
  return generatePermutations(arr);
};