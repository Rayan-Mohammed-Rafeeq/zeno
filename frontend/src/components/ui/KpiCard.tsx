import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KpiCardProps {
  icon: React.ComponentType<any>;
  label: string;
  value: string | number;
  sub?: string;
  /** Colour variant for the value text  */
  accent?: 'default' | 'danger' | 'warning' | 'success';
  /** Optional trend: positive / negative / neutral */
  trend?: 'up' | 'down' | 'neutral';
  trendLabel?: string;
  delay?: string;
  className?: string;
}

const ACCENT_VAR: Record<string, string> = {
  default: 'var(--accent)',
  danger:  'var(--risk-critical)',
  warning: 'var(--risk-high)',
  success: 'var(--success)',
};

/**
 * Premium animated KPI card.
 * – Gradient value text with count-up glow animation
 * – Glow icon box with shimmer
 * – Optional trend indicator
 * – Glass-morphism surface
 */
export function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  accent = 'default',
  trend,
  trendLabel,
  delay = '',
  className,
}: KpiCardProps) {
  const accentColor = ACCENT_VAR[accent] ?? ACCENT_VAR.default;

  return (
    <div
      className={cn('glass-card p-5 animate-fade-up', delay, className)}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p
            className="text-[10px] font-bold uppercase tracking-[0.1em] mb-2"
            style={{ color: 'var(--fg-subtle)' }}
          >
            {label}
          </p>

          {/* Gradient value */}
          <div
            className="text-3xl font-bold kpi-value leading-none"
            style={{ '--kpi-gradient': `linear-gradient(135deg, ${accentColor}, ${accentColor}99)` } as React.CSSProperties}
          >
            {value}
          </div>

          {sub && (
            <p className="text-xs mt-1.5" style={{ color: 'var(--fg-subtle)' }}>
              {sub}
            </p>
          )}
        </div>

        {/* Icon box */}
        <div
          className="relative h-10 w-10 rounded-xl flex items-center justify-center shrink-0 overflow-hidden"
          style={{
            background: `linear-gradient(135deg, color-mix(in srgb, ${accentColor} 18%, var(--surface-2)) 0%, var(--surface-3) 100%)`,
            border: '1px solid var(--glass-border)',
          }}
        >
          <span
            className="pointer-events-none absolute inset-0"
            style={{
              background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.12) 50%, transparent 60%)',
              animation: 'shimmer-sweep 4s ease infinite',
            }}
            aria-hidden
          />
          <Icon className="h-4 w-4 relative z-10" style={{ color: accentColor }} />
        </div>
      </div>

      {/* Trend indicator */}
      {trend && trendLabel && (
        <div
          className="mt-3 pt-3 flex items-center gap-1.5 text-xs font-medium"
          style={{
            borderTop: '1px solid var(--border)',
            color: trend === 'up' ? 'var(--success)'
              : trend === 'down' ? 'var(--risk-critical)'
              : 'var(--fg-subtle)',
          }}
        >
          {trend === 'up' && <TrendingUp className="h-3.5 w-3.5" />}
          {trend === 'down' && <TrendingDown className="h-3.5 w-3.5" />}
          {trend === 'neutral' && <Minus className="h-3.5 w-3.5" />}
          <span>{trendLabel}</span>
        </div>
      )}
    </div>
  );
}
