import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatNumber } from '@/lib/utils';

interface PaginationBarProps {
  page:       number;
  pageSize:   number;
  total:      number;
  onPrev:     () => void;
  onNext:     () => void;
  label?:     string;
}

export function PaginationBar({
  page, pageSize, total, onPrev, onNext, label = 'items',
}: PaginationBarProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start      = (page - 1) * pageSize + 1;
  const end        = Math.min(page * pageSize, total);

  return (
    <div className="px-6 py-3 border-t flex items-center justify-between text-xs"
      style={{ borderColor: 'var(--border)', color: 'var(--fg-subtle)' }}>
      <span>
        {total > 0
          ? `Showing ${start}–${end} of ${formatNumber(total)} ${label}`
          : `No ${label} found`}
      </span>
      <div className="flex items-center gap-2">
        <span style={{ color: 'var(--fg-subtle)' }}>
          Page {page} of {totalPages}
        </span>
        <button
          onClick={onPrev}
          disabled={page <= 1}
          className="h-7 w-7 rounded-lg flex items-center justify-center transition-all"
          style={{
            background: page <= 1 ? 'var(--surface-2)' : 'var(--accent-muted)',
            color:      page <= 1 ? 'var(--fg-subtle)' : 'var(--accent)',
            cursor:     page <= 1 ? 'not-allowed' : 'pointer',
          }}>
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          onClick={onNext}
          disabled={page >= totalPages}
          className="h-7 w-7 rounded-lg flex items-center justify-center transition-all"
          style={{
            background: page >= totalPages ? 'var(--surface-2)' : 'var(--accent-muted)',
            color:      page >= totalPages ? 'var(--fg-subtle)' : 'var(--accent)',
            cursor:     page >= totalPages ? 'not-allowed' : 'pointer',
          }}>
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
