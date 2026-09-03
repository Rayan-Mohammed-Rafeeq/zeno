import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { investigationApi } from '@/services/api';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { formatRelativeTime } from '@/lib/utils';
import { FileSearch, ArrowRight } from 'lucide-react';

const STATUSES = ['ALL', 'OPEN', 'REVIEWING', 'ESCALATED', 'RESOLVED'] as const;
const STATUS_STYLE: Record<string, React.CSSProperties> = {
  OPEN:       { background: 'var(--accent-muted)',     color: 'var(--accent)'        },
  REVIEWING:  { background: 'var(--warning-bg)',       color: 'var(--warning)'       },
  ESCALATED:  { background: 'var(--risk-critical-bg)', color: 'var(--risk-critical)' },
  RESOLVED:   { background: 'var(--success-bg)',       color: 'var(--success)'       },
};

export function Investigations() {
  const [status, setStatus] = useState('ALL');

  const { data, isLoading } = useQuery({
    queryKey: ['investigations', { status }],
    queryFn:  () => investigationApi.getInvestigations({ status }),
  });

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--fg)' }}>Investigations</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--fg-muted)' }}>
            Manage and track active fraud investigation cases.
          </p>
        </div>
        <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: 'var(--accent-muted)' }}>
          <FileSearch className="h-4 w-4" style={{ color: 'var(--accent)' }} />
        </div>
      </div>

      {/* Status summary */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        {['OPEN', 'REVIEWING', 'ESCALATED', 'RESOLVED'].map((s) => {
          const count = data?.data.filter((i) => i.status === s).length ?? 0;
          return (
            <button key={s} onClick={() => setStatus(s === status ? 'ALL' : s)}
              className="text-left rounded-xl p-4 border transition-all"
              style={{
                background: status === s ? 'var(--accent-muted)' : 'var(--surface)',
                borderColor: status === s ? 'var(--accent)' : 'var(--border)',
                boxShadow: 'var(--shadow-sm)',
              }}>
              <div className="text-2xl font-bold mb-1" style={{ color: STATUS_STYLE[s]?.color ?? 'var(--fg)' }}>
                {count}
              </div>
              <div className="text-xs font-semibold"
                style={{ color: status === s ? 'var(--accent)' : 'var(--fg-subtle)' }}>
                {s}
              </div>
            </button>
          );
        })}
      </div>

      {/* Filter pills */}
      <div className="flex items-center gap-2 flex-wrap">
        {STATUSES.map((s) => (
          <button key={s} onClick={() => setStatus(s)}
            className="px-3 h-8 rounded-lg text-xs font-semibold transition-all"
            style={status === s
              ? { background: 'var(--accent)', color: 'var(--accent-fg)' }
              : { background: 'var(--surface-2)', color: 'var(--fg-muted)' }}>
            {s === 'ALL' ? 'All statuses' : s}
          </button>
        ))}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="px-0 py-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-48 gap-3" style={{ color: 'var(--fg-subtle)' }}>
              <span className="h-5 w-5 border-2 border-current/20 border-t-current rounded-full animate-spin" />
              Loading investigations…
            </div>
          ) : !data?.data.length ? (
            <div className="flex flex-col items-center justify-center h-48 gap-2">
              <FileSearch className="h-10 w-10" style={{ color: 'var(--fg-subtle)' }} />
              <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>No investigations currently require review</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Investigation ID</TableHead>
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
                {data.data.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="pl-6">
                      <span className="font-mono text-xs font-semibold" style={{ color: 'var(--fg)' }}>
                        {inv.investigationId}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div style={{ color: 'var(--fg)' }} className="font-medium text-sm">{inv.subject}</div>
                      <div className="text-xs mt-0.5" style={{ color: 'var(--fg-subtle)' }}>
                        {inv.subjectType} · {inv.subjectId}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs" style={{ color: 'var(--fg-muted)' }}>
                        {inv.type.replace(/_/g, ' ')}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="risk" riskLevel={inv.riskLevel}>{inv.riskLevel}</Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm" style={{ color: 'var(--fg-muted)' }}>
                        {inv.assignedToName ?? '—'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-md"
                        style={STATUS_STYLE[inv.status] ?? {}}>
                        {inv.status}
                      </span>
                    </TableCell>
                    <TableCell>{formatRelativeTime(inv.createdAt)}</TableCell>
                    <TableCell>
                      <Link to={`/investigations/${inv.investigationId}`}
                        className="flex items-center gap-1 text-xs hover:underline"
                        style={{ color: 'var(--accent)' }}>
                        View <ArrowRight className="h-3 w-3" />
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
