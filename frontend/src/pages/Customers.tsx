import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { customerApi } from '@/services/api';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { PaginationBar } from '@/components/ui/Pagination';
import { formatNumber, formatRelativeTime, formatCurrency } from '@/lib/utils';
import { Search, SlidersHorizontal, Users } from 'lucide-react';

const RISK_LEVELS = ['ALL', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  ACTIVE:    { color: 'var(--success)',       label: 'Active'     },
  FLAGGED:   { color: 'var(--risk-critical)', label: 'Flagged'    },
  SUSPENDED: { color: 'var(--risk-medium)',   label: 'Suspended'  },
};

const RISK_PILL_STYLE: Record<string, React.CSSProperties> = {
  ALL:      {},
  LOW:      { background: 'var(--risk-low-bg)',      color: 'var(--risk-low)'      },
  MEDIUM:   { background: 'var(--risk-medium-bg)',   color: 'var(--risk-medium)'   },
  HIGH:     { background: 'var(--risk-high-bg)',     color: 'var(--risk-high)'     },
  CRITICAL: { background: 'var(--risk-critical-bg)', color: 'var(--risk-critical)' },
};

/** Inline refund-rate bar */
function RefundBar({ rate }: { rate: number }) {
  const color = rate > 20 ? 'var(--risk-critical)' : rate > 10 ? 'var(--risk-high)' : 'var(--success)';
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm tabular-nums font-medium" style={{ color, minWidth: 36 }}>
        {rate.toFixed(1)}%
      </span>
      <div className="stat-bar-track w-16">
        <div
          className="stat-bar-fill"
          style={{
            width: `${Math.min(rate * 2, 100)}%`,
            background: `linear-gradient(90deg, ${color}, ${color}99)`,
          }}
        />
      </div>
    </div>
  );
}

/** Customer initials avatar */
function Avatar({ name }: { name: string }) {
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const hue = (name.charCodeAt(0) * 37 + name.charCodeAt(1) * 13) % 360;
  return (
    <div
      className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 select-none"
      style={{
        background: `hsl(${hue} 60% 50% / 0.15)`,
        color: `hsl(${hue} 60% 55%)`,
        border: `1.5px solid hsl(${hue} 60% 50% / 0.2)`,
      }}
    >
      {initials}
    </div>
  );
}

export function Customers() {
  const [search, setSearch]   = useState('');
  const [riskFilter, setRisk] = useState('ALL');
  const [page, setPage]       = useState(1);
  const PAGE_SIZE = 20;

  const { data, isLoading } = useQuery({
    queryKey: ['customers', { search, riskLevel: riskFilter, page }],
    queryFn:  () => customerApi.getCustomers({ search, riskLevel: riskFilter, page, pageSize: PAGE_SIZE }),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Users}
        title="Customers"
        subtitle="Monitor customer behaviour, risk scores, and signal activity."
      />

      {/* Filter toolbar */}
      <div className="glass-card px-4 py-3 animate-fade-up-d1">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none" style={{ color: 'var(--fg-subtle)' }} />
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
                    : lvl !== 'ALL' && !active
                    ? { ...RISK_PILL_STYLE[lvl], opacity: 0.7 }
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

      {/* Table card */}
      <Card variant="elevated" className="animate-fade-up-d2">
        <CardContent className="px-0 py-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-52 gap-3" style={{ color: 'var(--fg-subtle)' }}>
              <span className="h-5 w-5 border-2 border-current/20 border-t-current rounded-full animate-spin" />
              Loading customers…
            </div>
          ) : !data?.data?.length ? (
            <div className="flex flex-col items-center justify-center h-52 gap-3">
              <div className="h-14 w-14 rounded-2xl flex items-center justify-center" style={{ background: 'var(--surface-2)' }}>
                <Users className="h-7 w-7" style={{ color: 'var(--fg-subtle)' }} />
              </div>
              <p className="text-sm font-medium" style={{ color: 'var(--fg-muted)' }}>No customers found</p>
              <p className="text-xs" style={{ color: 'var(--fg-subtle)' }}>Try adjusting your search or filters.</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Customer</TableHead>
                    <TableHead>ID</TableHead>
                    <TableHead>Txns</TableHead>
                    <TableHead>Total</TableHead>
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
                  {(data?.data ?? []).map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell className="pl-6">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={customer.name} />
                          <Link
                            to={`/customers/${customer.customerId}`}
                            className="font-semibold text-sm hover:underline"
                            style={{ color: 'var(--accent)' }}
                          >
                            {customer.name}
                          </Link>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--surface-2)', color: 'var(--fg-muted)' }}>
                          {customer.customerId}
                        </span>
                      </TableCell>
                      <TableCell style={{ color: 'var(--fg)' }}>{formatNumber(customer.transactionCount)}</TableCell>
                      <TableCell style={{ color: 'var(--fg)', fontWeight: 600 }}>{formatCurrency(customer.totalAmount)}</TableCell>
                      <TableCell><RefundBar rate={customer.refundRate} /></TableCell>
                      <TableCell style={{ color: 'var(--fg)' }}>{customer.deviceCount}</TableCell>
                      <TableCell style={{ color: 'var(--fg)' }}>{customer.ipCount}</TableCell>
                      <TableCell>
                        <span
                          className="font-bold tabular-nums text-sm"
                          style={{
                            color: customer.riskScore >= 80 ? 'var(--risk-critical)'
                              : customer.riskScore >= 65 ? 'var(--risk-high)'
                              : customer.riskScore >= 40 ? 'var(--risk-medium)'
                              : 'var(--fg-muted)',
                          }}
                        >
                          {customer.riskScore}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="risk" riskLevel={customer.riskLevel} dot>{customer.riskLevel}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span
                            className="h-2 w-2 rounded-full inline-block pulse-dot"
                            style={{ color: STATUS_CONFIG[customer.status]?.color ?? 'var(--fg-subtle)' }}
                          />
                          <span className="text-xs">{STATUS_CONFIG[customer.status]?.label ?? customer.status}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs" style={{ color: 'var(--fg-subtle)' }}>
                        {formatRelativeTime(customer.lastActivity)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <PaginationBar
                page={page} pageSize={PAGE_SIZE} total={data.total}
                onPrev={() => setPage(p => Math.max(1, p - 1))}
                onNext={() => setPage(p => p + 1)}
                label="customers"
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
