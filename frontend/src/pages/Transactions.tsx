import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { transactionApi } from '@/services/api';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/PageHeader';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { PaginationBar } from '@/components/ui/Pagination';
import { formatCurrency, formatRelativeTime } from '@/lib/utils';
import { Search, SlidersHorizontal, Receipt, Zap } from 'lucide-react';

const RISK_LEVELS = ['ALL', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

const STATUS_CONFIG: Record<string, { color: string; bg: string }> = {
  COMPLETED: { color: 'var(--success)',       bg: 'var(--success-bg)'       },
  REFUNDED:  { color: 'var(--risk-medium)',   bg: 'var(--risk-medium-bg)'   },
  PENDING:   { color: 'var(--info)',          bg: 'var(--info-bg)'          },
  FAILED:    { color: 'var(--risk-critical)', bg: 'var(--risk-critical-bg)' },
};

const RISK_PILL: Record<string, React.CSSProperties> = {
  LOW:      { background: 'var(--risk-low-bg)',      color: 'var(--risk-low)'      },
  MEDIUM:   { background: 'var(--risk-medium-bg)',   color: 'var(--risk-medium)'   },
  HIGH:     { background: 'var(--risk-high-bg)',     color: 'var(--risk-high)'     },
  CRITICAL: { background: 'var(--risk-critical-bg)', color: 'var(--risk-critical)' },
};

export function Transactions() {
  const [search, setSearch]   = useState('');
  const [riskFilter, setRisk] = useState('ALL');
  const [page, setPage]       = useState(1);
  const PAGE_SIZE = 20;

  const { data, isLoading } = useQuery({
    queryKey: ['transactions', { search, riskLevel: riskFilter, page }],
    queryFn:  () => transactionApi.getTransactions({ search, riskLevel: riskFilter, page, pageSize: PAGE_SIZE }),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Receipt}
        title="Transactions"
        subtitle="Analyse transaction risk, refunds, and payment patterns."
      />

      {/* Filter toolbar */}
      <div className="glass-card px-4 py-3 animate-fade-up-d1">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none" style={{ color: 'var(--fg-subtle)' }} />
            <input
              placeholder="Search by transaction ID or customer…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-3 rounded-lg text-sm outline-none transition-all"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--fg)' }}
              onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
              onBlur={(e)  => (e.target.style.borderColor = 'var(--border)')}
            />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <SlidersHorizontal className="h-3.5 w-3.5 mr-0.5" style={{ color: 'var(--fg-subtle)' }} />
            {RISK_LEVELS.map((lvl) => {
              const active = riskFilter === lvl;
              return (
                <button
                  key={lvl}
                  onClick={() => { setRisk(lvl); setPage(1); }}
                  className="px-3 h-7 rounded-full text-xs font-semibold transition-all"
                  style={active
                    ? { background: 'var(--accent)', color: '#fff', boxShadow: '0 2px 8px rgba(133,136,230,0.35)' }
                    : lvl !== 'ALL'
                    ? { ...RISK_PILL[lvl], opacity: active ? 1 : 0.7 }
                    : { background: 'var(--surface-2)', color: 'var(--fg-muted)' }
                  }
                >
                  {lvl === 'ALL' ? 'All' : lvl}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Table */}
      <Card variant="elevated" className="animate-fade-up-d2">
        <CardContent className="px-0 py-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-52 gap-3" style={{ color: 'var(--fg-subtle)' }}>
              <span className="h-5 w-5 border-2 border-current/20 border-t-current rounded-full animate-spin" />
              Loading transactions…
            </div>
          ) : !data?.data?.length ? (
            <div className="flex flex-col items-center justify-center h-52 gap-3">
              <div className="h-14 w-14 rounded-2xl flex items-center justify-center" style={{ background: 'var(--surface-2)' }}>
                <Receipt className="h-7 w-7" style={{ color: 'var(--fg-subtle)' }} />
              </div>
              <p className="text-sm font-medium" style={{ color: 'var(--fg-muted)' }}>No transactions found</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Transaction ID</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Refund</TableHead>
                    <TableHead>Risk</TableHead>
                    <TableHead>Signals</TableHead>
                    <TableHead>Timestamp</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.data ?? []).map((txn) => {
                    const sc = STATUS_CONFIG[txn.status];
                    return (
                      <TableRow key={txn.id}>
                        <TableCell className="pl-6">
                          <Link to={`/transactions/${txn.transactionId}`}
                            className="font-mono text-xs font-semibold hover:underline"
                            style={{ color: 'var(--accent)' }}>
                            {txn.transactionId}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Link to={`/customers/${txn.customerId}`}
                            className="text-sm font-medium hover:underline"
                            style={{ color: 'var(--accent)' }}>
                            {txn.customerName}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <span className="font-bold tabular-nums text-sm" style={{ color: 'var(--fg)' }}>
                            {formatCurrency(txn.amount)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--surface-2)', color: 'var(--fg-muted)' }}>
                            {txn.paymentMethod}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span
                            className="inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-md"
                            style={{ background: sc?.bg, color: sc?.color }}
                          >
                            <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'currentColor' }} />
                            {txn.status}
                          </span>
                        </TableCell>
                        <TableCell>
                          {txn.isRefunded ? (
                            <span className="text-xs font-semibold" style={{ color: 'var(--risk-medium)' }}>
                              {txn.refundAmount ? formatCurrency(txn.refundAmount) : 'Yes'}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--fg-subtle)' }}>—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="risk" riskLevel={txn.riskLevel} dot>{txn.riskLevel}</Badge>
                        </TableCell>
                        <TableCell>
                          {txn.signalCount > 0 ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md"
                              style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}>
                              <Zap className="h-2.5 w-2.5" />
                              {txn.signalCount}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--fg-subtle)' }}>—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs" style={{ color: 'var(--fg-subtle)' }}>
                          {formatRelativeTime(txn.timestamp)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <PaginationBar
                page={page} pageSize={PAGE_SIZE} total={data.total}
                onPrev={() => setPage(p => Math.max(1, p - 1))}
                onNext={() => setPage(p => p + 1)}
                label="transactions"
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
