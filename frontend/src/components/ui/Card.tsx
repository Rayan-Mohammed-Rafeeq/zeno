import { cn } from '@/lib/utils';
import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 'default' = solid surface  |  'glass' = glassmorphism  |  'elevated' = deeper shadow */
  variant?: 'default' | 'glass' | 'elevated';
}

export function Card({ className, style, variant = 'default', children, ...props }: CardProps) {
  if (variant === 'glass') {
    return (
      <div
        className={cn('glass-card', className)}
        style={style}
        {...props}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      className={cn('rounded-xl border', className)}
      style={{
        background: 'var(--surface)',
        borderColor: 'var(--border)',
        boxShadow: variant === 'elevated' ? 'var(--shadow)' : 'var(--shadow-sm)',
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex flex-col space-y-1.5 px-6 pt-6 pb-4', className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn('text-sm font-semibold tracking-tight', className)}
      style={{ color: 'var(--fg)' }}
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardContent({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('px-6 pb-6', className)} {...props}>
      {children}
    </div>
  );
}
