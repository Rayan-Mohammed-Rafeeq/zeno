import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { RiskLevel } from '@/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num);
}

export function formatPercent(value: number, decimals: number = 1): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(date: string): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatRelativeTime(date: string): string {
  const now = new Date();
  const then = new Date(date);
  const diffInSeconds = Math.floor((now.getTime() - then.getTime()) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  
  return formatDate(date);
}

export function getRiskColor(level: RiskLevel): string {
  const colors: Record<RiskLevel, string> = {
    LOW: 'text-green-600 dark:text-green-500',
    MEDIUM: 'text-amber-600 dark:text-amber-500',
    HIGH: 'text-orange-600 dark:text-orange-500',
    CRITICAL: 'text-red-600 dark:text-red-500',
  };
  return colors[level];
}

export function getRiskBgColor(level: RiskLevel): string {
  const colors: Record<RiskLevel, string> = {
    LOW: 'bg-green-100 dark:bg-green-950',
    MEDIUM: 'bg-amber-100 dark:bg-amber-950',
    HIGH: 'bg-orange-100 dark:bg-orange-950',
    CRITICAL: 'bg-red-100 dark:bg-red-950',
  };
  return colors[level];
}

export function getRiskBorderColor(level: RiskLevel): string {
  const colors: Record<RiskLevel, string> = {
    LOW: 'border-green-300 dark:border-green-800',
    MEDIUM: 'border-amber-300 dark:border-amber-800',
    HIGH: 'border-orange-300 dark:border-orange-800',
    CRITICAL: 'border-red-300 dark:border-red-800',
  };
  return colors[level];
}
