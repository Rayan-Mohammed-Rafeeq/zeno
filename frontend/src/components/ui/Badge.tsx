import { cn } from '@/lib/utils';
import type { RiskLevel } from '@/types';
import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'risk' | 'outline';
  riskLevel?: RiskLevel;
  className?: string;
}

export function Badge({ children, variant = 'default', riskLevel, className }: BadgeProps) {
  if (variant === 'risk' && riskLevel) {
    const styles: Record<RiskLevel, React.CSSProperties> = {
      LOW:      { background: 'var(--risk-low-bg)',      color: 'var(--risk-low)'      },
      MEDIUM:   { background: 'var(--risk-medium-bg)',   color: 'var(--risk-medium)'   },
      HIGH:     { background: 'var(--risk-high-bg)',     color: 'var(--risk-high)'     },
      CRITICAL: { background: 'var(--risk-critical-bg)', color: 'var(--risk-critical)' },
    };
    return (
      <span
        className={cn('inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold', className)}
        style={styles[riskLevel]}
      >
        {children}
      </span>
    );
  }

  if (variant === 'outline') {
    return (
      <span
        className={cn('inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold', className)}
        style={{ borderColor: 'var(--border-strong)', color: 'var(--fg-muted)' }}
      >
        {children}
      </span>
    );
  }

  return (
    <span
      className={cn('inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold', className)}
      style={{ background: 'var(--surface-2)', color: 'var(--fg-muted)' }}
    >
      {children}
    </span>
  );
}
