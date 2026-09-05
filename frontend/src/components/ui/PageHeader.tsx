import React from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  icon: React.ComponentType<any>;
  title: string;
  subtitle?: string;
  /** Optional right-side slot for action buttons */
  actions?: React.ReactNode;
  className?: string;
  /** Delay class for stagger animation */
  delay?: string;
}

/**
 * Premium page header used across all authenticated pages.
 * Features a gradient left-edge accent bar, animated icon box,
 * bold title, and optional subtitle + right-side action slot.
 */
export function PageHeader({
  icon: Icon,
  title,
  subtitle,
  actions,
  className,
  delay = '',
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        'relative flex items-center justify-between gap-4 pb-6 animate-fade-up',
        delay,
        className,
      )}
    >
      {/* Left accent bar */}
      <span
        className="absolute left-0 top-0 bottom-0 w-[3px] rounded-full"
        style={{
          background: 'linear-gradient(to bottom, var(--accent), transparent)',
          marginLeft: -20,
        }}
        aria-hidden
      />

      <div className="flex items-center gap-4 min-w-0">
        {/* Icon box */}
        <div
          className="relative h-11 w-11 rounded-xl flex items-center justify-center shrink-0 overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, var(--accent-muted) 0%, var(--surface-2) 100%)',
            border: '1px solid var(--glass-border)',
            boxShadow: '0 0 0 4px var(--accent-muted)',
          }}
        >
          {/* shimmer sweep */}
          <span
            className="pointer-events-none absolute inset-0"
            style={{
              background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.14) 50%, transparent 60%)',
              animation: 'shimmer-sweep 3s ease infinite',
            }}
            aria-hidden
          />
          <Icon className="h-5 w-5 relative z-10" style={{ color: 'var(--accent)' }} />
        </div>

        {/* Text */}
        <div className="min-w-0">
          <h1
            className="text-2xl font-bold tracking-tight leading-tight truncate"
            style={{ color: 'var(--fg)' }}
          >
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm mt-0.5 truncate" style={{ color: 'var(--fg-muted)' }}>
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {/* Actions slot */}
      {actions && (
        <div className="flex items-center gap-2 shrink-0">{actions}</div>
      )}
    </div>
  );
}
