import { cn } from '@/lib/utils';
import React from 'react';

export function Table({ className, ...props }: React.HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-auto">
      <table className={cn('w-full caption-bottom text-sm', className)} {...props} />
    </div>
  );
}

export function TableHeader({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn('', className)} style={{ borderBottom: '1px solid var(--border)' }} {...props} />;
}

export function TableBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn('[&_tr:last-child]:border-0', className)} {...props} />;
}

export function TableRow({ className, onClick, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn('transition-colors', onClick ? 'cursor-pointer' : '', className)}
      style={{ borderBottom: '1px solid var(--border)' }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ''; }}
      onClick={onClick}
      {...props}
    />
  );
}

export function TableHead({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn('h-10 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wider', className)}
      style={{ color: 'var(--fg-subtle)' }}
      {...props}
    />
  );
}

export function TableCell({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn('px-4 py-3 align-middle', className)}
      style={{ color: 'var(--fg-muted)' }}
      {...props}
    />
  );
}
