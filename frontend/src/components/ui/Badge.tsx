import { cn } from '@/lib/utils';
import type { RiskLevel } from '@/types';
import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'risk' | 'outline' | 'success' | 'warning' | 'danger' | 'info';
  riskLevel?: RiskLevel;
  dot?: boolean;        // show animated pulsing dot
  className?: string;
}

const RISK_STYLE: Record<RiskLevel, React.CSSProperties> = {
  LOW:      { background: 'var(--risk-low-bg)',      color: 'var(--risk-low)',      border: '1px solid rgba(74,222,128,0.25)'  },
  MEDIUM:   { background: 'var(--risk-medium-bg)',   color: 'var(--risk-medium)',   border: '1px solid rgba(251,191,36,0.25)'  },
  HIGH:     { background: 'var(--risk-high-bg)',     color: 'var(--risk-high)',     border: '1px solid rgba(251,146,60,0.25)'  },
  CRITICAL: { background: 'var(--risk-critical-bg)', color: 'var(--risk-critical)', border: '1px solid rgba(248,113,113,0.25)' },
};

const VARIANT_STYLE: Record<string, React.CSSProperties> = {
  default: { background: 'var(--surface-2)', color: 'var(--fg-muted)' },
  outline: { border: '1px solid var(--border-strong)', color: 'var(--fg-muted)' },
  success: { background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid rgba(74,222,128,0.25)' },
  warning: { background: 'var(--warning-bg)', color: 'var(--warning)', border: '1px solid rgba(251,191,36,0.25)' },
  danger:  { background: 'var(--danger-bg)',  color: 'var(--danger)',  border: '1px solid rgba(248,113,113,0.25)' },
  info:    { background: 'var(--info-bg)',    color: 'var(--info)',    border: '1px solid rgba(56,189,248,0.25)' },
};

export function Badge({ children, variant = 'default', riskLevel, dot, className }: BadgeProps) {
  const style = variant === 'risk' && riskLevel
    ? RISK_STYLE[riskLevel]
    : VARIANT_STYLE[variant] ?? VARIANT_STYLE.default;

  const isCritical = riskLevel === 'CRITICAL';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-semibold',
        className,
      )}
      style={style}
    >
      {(dot || variant === 'risk') && (
        <span
          className={cn('h-1.5 w-1.5 rounded-full shrink-0 inline-block', isCritical && 'pulse-dot')}
          style={{ background: 'currentColor' }}
        />
      )}
      {children}
    </span>
  );
}
