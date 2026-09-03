import React from 'react';
import { cn } from '@/lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  children: React.ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  const sizes = {
    sm: 'h-8 px-3 text-xs',
    md: 'h-10 px-4 text-sm',
    lg: 'h-11 px-6 text-base',
  };

  const variantStyles: Record<string, React.CSSProperties> = {
    primary:   { background: 'var(--accent)',    color: 'var(--accent-fg)' },
    secondary: { background: 'var(--surface-2)', color: 'var(--fg-muted)'  },
    ghost:     { background: 'transparent',      color: 'var(--fg-muted)'  },
    danger:    { background: 'var(--danger-bg)',  color: 'var(--danger)'    },
    outline:   { background: 'transparent',      color: 'var(--fg-muted)', border: '1px solid var(--border)' },
  };

  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-all',
        'focus-visible:outline-none focus-visible:ring-2',
        'disabled:opacity-50 disabled:pointer-events-none',
        sizes[size],
        className,
      )}
      style={variantStyles[variant]}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && (
        <span className="h-3.5 w-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
      )}
      {children}
    </button>
  );
}
