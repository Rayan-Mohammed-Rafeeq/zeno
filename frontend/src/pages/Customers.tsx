import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { customerApi } from '@/services/api';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { PaginationBar } from '@/components/ui/Pagination';
import { formatNumber, formatRelativeTime, formatCurrency } from '@/lib/utils';
import { Search, Filter, Users } from 'lucide-react';

const RISK_LEVELS = ['ALL', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
const STATUS_DOT: Record<string, string> = {
  ACTIVE:    'var(--success)',
  FLAGGED:   'var(--risk-critical)',
  SUSPENDED: 'var(--risk-medium)',
};

export function Customers() {
  const [search, setSearch]       = useState('');
  const [riskFilter, setRisk]     = useState('ALL');
  const [page, setPage]           = useState(1);
  const PAGE_SIZE = 20;

  const { data, isLoading } = useQuery({
    queryKey: ['customers', { search, riskLevel: riskFilter, page }],
    queryFn:  () => customerApi.getCustomers({ search, riskLevel: riskFilter, page, pageSize: PAGE_SIZE }),
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--fg)' }}>Customers</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--fg-muted)' }}>
            Monitor customer behaviour, risk scores, and signal activity.
          </p>
        </div>
        <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: 'var(--accent-muted)' }}>
          <Users className="h-4 w-4" style={{ color: 'var(--accent)' }} />
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none"
                style={{ color: 'var(--fg-subtle)' }} />
              <input
                placeholder="Search by name, ID or email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-9 pl-9 pr-3 rounded-lg text-sm outline-none transition-all"
                style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  color: 'var(--fg)',
                }}
                onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
                onBlur={(e)  => (e.target.style.borderColor = 'var(--border)')}
              />
            </div>

            {/* Risk filter pills */}
            <div className="flex items-center gap-1">
              <Filter className="h-4 w-4 mr-1" style={{ color: 'var(--fg-subtle)' }} />
              {RISK_LEVELS.map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => setRisk(lvl)}
                  className="px-3 h-9 rounded-lg text-xs font-semibold transition-all"
                  style={riskFilter === lvl
                    ? { background: 'var(--accent)', color: 'var(--accent-fg)' }
                    : { background: 'var(--surface-2)', color: 'var(--fg-muted)' }
                  }
                >
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
              Loading customers…
            </div>
          ) : !data?.data.length ? (
            <div className="flex flex-col items-center justify-center h-48 gap-2">
              <Users className="h-10 w-10" style={{ color: 'var(--fg-subtle)' }} />
              <p className="text-sm font-medium" style={{ color: 'var(--fg-muted)' }}>No customers found</p>
              <p className="text-xs" style={{ color: 'var(--fg-subtle)' }}>
                Try adjusting your search or filters.
              </p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Customer</TableHead>
                    <TableHead>ID</TableHead>
                    <TableHead>Transactions</TableHead>
                    <TableHead>Total Amount</TableHead>
                    <TableHead>Refund Rate</TableHead>
                    <TableHead>Devices</TableHead>
                    <TableHead>IPs</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Risk</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Active</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.data.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell className="pl-6">
                        <Link
                          to={`/customers/${customer.customerId}`}
                          className="font-semibold hover:underline"
                          style={{ color: 'var(--accent)' }}
                        >
                          {customer.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-xs">{customer.customerId}</span>
                      </TableCell>
                      <TableCell style={{ color: 'var(--fg)' }}>
                        {formatNumber(customer.transactionCount)}
                      </TableCell>
                      <TableCell style={{ color: 'var(--fg)' }}>
                        {formatCurrency(customer.totalAmount)}
                      </TableCell>
                      <TableCell>
                        <span style={{
                          color: customer.refundRate > 20
                            ? 'var(--risk-critical)'
                            : customer.refundRate > 10
                            ? 'var(--risk-high)'
                            : 'var(--fg-muted)',
                          fontWeight: customer.refundRate > 10 ? 600 : 400,
                        }}>
                          {customer.refundRate.toFixed(1)}%
                        </span>
                      </TableCell>
                      <TableCell>{customer.deviceCount}</TableCell>
                      <TableCell>{customer.ipCount}</TableCell>
                      <TableCell>
                        <span className="font-bold tabular-nums" style={{
                          color: customer.riskScore >= 80 ? 'var(--risk-critical)'
                            : customer.riskScore >= 65 ? 'var(--risk-high)'
                            : customer.riskScore >= 40 ? 'var(--risk-medium)'
                            : 'var(--fg-muted)',
                        }}>
                          {customer.riskScore}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="risk" riskLevel={customer.riskLevel}>
                          {customer.riskLevel}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full inline-block"
                            style={{ background: STATUS_DOT[customer.status] ?? 'var(--fg-subtle)' }} />
                          <span className="text-xs">{customer.status}</span>
                        </div>
                      </TableCell>
                      <TableCell>{formatRelativeTime(customer.lastActivity)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <PaginationBar
                page={page} pageSize={PAGE_SIZE} total={data.total}
                onPrev={() => setPage(p => Math.max(1, p - 1))}
                onNext={() => setPage(p => p + 1)}
                label="customers"
              />            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
