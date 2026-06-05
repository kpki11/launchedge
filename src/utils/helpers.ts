// src/utils/helpers.ts
import uuid from 'react-native-uuid';

export function generateId(): string {
  return uuid.v4() as string;
}

export function generateShortId(prefix: string = 'REC'): string {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}`;
}

export function parseJSON<T>(json: string | null | undefined, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

export function debounce<T extends (...args: any[]) => void>(fn: T, delay: number): T {
  let timer: ReturnType<typeof setTimeout>;
  return ((...args: any[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  }) as T;
}

export function groupBy<T>(arr: T[], key: keyof T): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const groupKey = String(item[key]);
    if (!acc[groupKey]) acc[groupKey] = [];
    acc[groupKey].push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

export function sortByDate(arr: any[], field: string, desc = true): any[] {
  return [...arr].sort((a, b) => {
    const da = new Date(a[field]).getTime();
    const db = new Date(b[field]).getTime();
    return desc ? db - da : da - db;
  });
}

export function sumField(arr: any[], field: string): number {
  return arr.reduce((sum, item) => sum + (parseFloat(item[field]) || 0), 0);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + '...';
}
