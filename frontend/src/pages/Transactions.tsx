import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { transactionApi } from '@/services/api';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { formatCurrency, formatRelativeTime } from '@/lib/utils';
import { Search, Filter, Receipt } from 'lucide-react';

const RISK_LEVELS = ['ALL', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
const STATUS_COLORS: Record<string, string> = {
  COMPLETED: 'var(--success)',
  REFUNDED:  'var(--risk-medium)',
  PENDING:   'var(--info)',
  FAILED:    'var(--risk-critical)',
};

export function Transactions() {
  const [search, setSearch]   = useState('');
  const [riskFilter, setRisk] = useState('ALL');

  const { data, isLoading } = useQuery({
    queryKey: ['transactions', { search, riskLevel: riskFilter }],
    queryFn:  () => transactionApi.getTransactions({ search, riskLevel: riskFilter }),
  });

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--fg)' }}>Transactions</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--fg-muted)' }}>
            Analyse transaction risk, refunds, and payment patterns.
          </p>
        </div>
        <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: 'var(--accent-muted)' }}>
          <Receipt className="h-4 w-4" style={{ color: 'var(--accent)' }} />
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none"
                style={{ color: 'var(--fg-subtle)' }} />
              <input
                placeholder="Search by transaction ID or customer…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-9 pl-9 pr-3 rounded-lg text-sm outline-none"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--fg)' }}
                onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
                onBlur={(e)  => (e.target.style.borderColor = 'var(--border)')}
              />
            </div>
            <div className="flex items-center gap-1">
              <Filter className="h-4 w-4 mr-1" style={{ color: 'var(--fg-subtle)' }} />
              {RISK_LEVELS.map((lvl) => (
                <button key={lvl} onClick={() => setRisk(lvl)}
                  className="px-3 h-9 rounded-lg text-xs font-semibold transition-all"
                  style={riskFilter === lvl
                    ? { background: 'var(--accent)', color: 'var(--accent-fg)' }
                    : { background: 'var(--surface-2)', color: 'var(--fg-muted)' }}>
                  {lvl === 'ALL' ? 'All' : lvl}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="px-0 py-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-48 gap-3" style={{ color: 'var(--fg-subtle)' }}>
              <span className="h-5 w-5 border-2 border-current/20 border-t-current rounded-full animate-spin" />
              Loading transactions…
            </div>
          ) : !data?.data.length ? (
            <div className="flex flex-col items-center justify-center h-48 gap-2">
              <Receipt className="h-10 w-10" style={{ color: 'var(--fg-subtle)' }} />
              <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>No transactions found</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Transaction ID</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Payment Method</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Refund</TableHead>
                    <TableHead>Risk</TableHead>
                    <TableHead>Signals</TableHead>
                    <TableHead>Timestamp</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.data.map((txn) => (
                    <TableRow key={txn.id}>
                      <TableCell className="pl-6">
                        <span className="font-mono text-xs font-medium" style={{ color: 'var(--fg)' }}>
                          {txn.transactionId}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Link to={`/customers/${txn.customerId}`}
                          className="hover:underline text-sm" style={{ color: 'var(--accent)' }}>
                          {txn.customerName}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold tabular-nums" style={{ color: 'var(--fg)' }}>
                          {formatCurrency(txn.amount)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs" style={{ color: 'var(--fg-muted)' }}>{txn.paymentMethod}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full inline-block"
                            style={{ background: STATUS_COLORS[txn.status] ?? 'var(--fg-subtle)' }} />
                          <span className="text-xs">{txn.status}</span>
                        </div>
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
                        <Badge variant="risk" riskLevel={txn.riskLevel}>{txn.riskLevel}</Badge>
                      </TableCell>
                      <TableCell>
                        {txn.signalCount > 0 ? (
                          <span className="text-xs font-semibold px-1.5 py-0.5 rounded"
                            style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}>
                            {txn.signalCount} signal{txn.signalCount > 1 ? 's' : ''}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--fg-subtle)' }}>—</span>
                        )}
                      </TableCell>
                      <TableCell>{formatRelativeTime(txn.timestamp)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="px-6 py-3 border-t flex items-center justify-between text-xs"
                style={{ borderColor: 'var(--border)', color: 'var(--fg-subtle)' }}>
                <span>Showing {data.data.length} of {data.total} transactions</span>
                <span>Page {data.page}</span>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
