import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { investigationApi } from '@/services/api';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { KpiCard } from '@/components/ui/KpiCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { PaginationBar } from '@/components/ui/Pagination';
import { formatRelativeTime } from '@/lib/utils';
import { FileSearch, ArrowRight, AlertOctagon, Eye, ShieldCheck, Clock } from 'lucide-react';

const STATUSES = ['ALL', 'OPEN', 'REVIEWING', 'ESCALATED', 'RESOLVED'] as const;

const STATUS_VARIANT: Record<string, 'info' | 'warning' | 'danger' | 'success' | 'default'> = {
  OPEN:       'info',
  REVIEWING:  'warning',
  ESCALATED:  'danger',
  RESOLVED:   'success',
};

const STATUS_ICONS: Record<string, React.ComponentType<any>> = {
  OPEN:       Clock,
  REVIEWING:  Eye,
  ESCALATED:  AlertOctagon,
  RESOLVED:   ShieldCheck,
};

export function Investigations() {
  const [status, setStatus] = useState('ALL');
  const [page, setPage]     = useState(1);
  const PAGE_SIZE = 20;

  const handleStatusChange = (s: string) => { setStatus(s); setPage(1); };

  const { data, isLoading } = useQuery({
    queryKey: ['investigations', { status, page }],
    queryFn:  () => investigationApi.getInvestigations({ status, page, pageSize: PAGE_SIZE }),
  });

  const all = data?.data ?? [];

  const counts: Record<string, number> = {
    OPEN:      all.filter(i => i.status === 'OPEN').length,
    REVIEWING: all.filter(i => i.status === 'REVIEWING').length,
    ESCALATED: all.filter(i => i.status === 'ESCALATED').length,
    RESOLVED:  all.filter(i => i.status === 'RESOLVED').length,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={FileSearch}
        title="Investigations"
        subtitle="Manage and track active fraud investigation cases."
      />

      {/* Status KPI strip */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <KpiCard icon={Clock}        label="Open"      value={counts.OPEN}      delay="animate-fade-up-d1" />
        <KpiCard icon={Eye}          label="Reviewing" value={counts.REVIEWING} accent="warning" delay="animate-fade-up-d2" />
        <KpiCard icon={AlertOctagon} label="Escalated" value={counts.ESCALATED} accent="danger"  delay="animate-fade-up-d3" />
        <KpiCard icon={ShieldCheck}  label="Resolved"  value={counts.RESOLVED}  accent="success" delay="animate-fade-up-d4" />
      </div>

      {/* Filter pills */}
      <div className="flex items-center gap-2 flex-wrap animate-fade-up-d2">
        {STATUSES.map((s) => {
          const active = status === s;
          const Icon   = STATUS_ICONS[s];
          return (
            <button
              key={s}
              onClick={() => handleStatusChange(s)}
              className="inline-flex items-center gap-1.5 px-3 h-8 rounded-full text-xs font-semibold transition-all"
              style={active
                ? { background: 'var(--accent)', color: '#fff', boxShadow: '0 2px 8px rgba(133,136,230,0.35)' }
                : { background: 'var(--surface-2)', color: 'var(--fg-muted)' }
              }
            >
              {Icon && <Icon className="h-3 w-3" />}
              {s === 'ALL' ? 'All statuses' : s}
            </button>
          );
        })}
      </div>

      {/* Table */}
      <Card variant="elevated" className="animate-fade-up-d3">
        <CardContent className="px-0 py-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-52 gap-3" style={{ color: 'var(--fg-subtle)' }}>
              <span className="h-5 w-5 border-2 border-current/20 border-t-current rounded-full animate-spin" />
              Loading investigations…
            </div>
          ) : !all.length ? (
            <div className="flex flex-col items-center justify-center h-52 gap-3">
              <div className="h-14 w-14 rounded-2xl flex items-center justify-center" style={{ background: 'var(--surface-2)' }}>
                <FileSearch className="h-7 w-7" style={{ color: 'var(--fg-subtle)' }} />
              </div>
              <p className="text-sm font-medium" style={{ color: 'var(--fg-muted)' }}>No investigations require review</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">ID</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Risk</TableHead>
                    <TableHead>Assigned</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {all.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="pl-6">
                        <span className="font-mono text-xs font-bold px-1.5 py-0.5 rounded"
                          style={{ background: 'var(--surface-2)', color: 'var(--fg)' }}>
                          {inv.investigationId}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-sm" style={{ color: 'var(--fg)' }}>{inv.subject}</div>
                        <div className="text-xs mt-0.5" style={{ color: 'var(--fg-subtle)' }}>
                          {inv.subjectType} · {inv.subjectId}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--surface-2)', color: 'var(--fg-muted)' }}>
                          {inv.type.replace(/_/g, ' ')}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="risk" riskLevel={inv.riskLevel} dot>{inv.riskLevel}</Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm" style={{ color: 'var(--fg-muted)' }}>
                          {inv.assignedToName ?? '—'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[inv.status] ?? 'default'}>
                          {inv.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs" style={{ color: 'var(--fg-subtle)' }}>
                        {formatRelativeTime(inv.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Link to={`/investigations/${inv.investigationId}`}
                          className="inline-flex items-center gap-1 text-xs font-medium hover:underline"
                          style={{ color: 'var(--accent)' }}>
                          View <ArrowRight className="h-3 w-3" />
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <PaginationBar
                page={page} pageSize={PAGE_SIZE} total={data?.total ?? all.length}
                onPrev={() => setPage(p => Math.max(1, p - 1))}
                onNext={() => setPage(p => p + 1)}
                label="investigations"
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
