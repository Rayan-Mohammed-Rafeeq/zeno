import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { clusterApi } from '@/services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { formatNumber, formatCurrency, formatRelativeTime } from '@/lib/utils';
import { Network, ArrowRight } from 'lucide-react';

const STATUS_STYLE: Record<string, React.CSSProperties> = {
  DETECTED:      { background: 'var(--accent-muted)',     color: 'var(--accent)'        },
  INVESTIGATING: { background: 'var(--warning-bg)',       color: 'var(--warning)'       },
  CONFIRMED:     { background: 'var(--risk-critical-bg)', color: 'var(--risk-critical)' },
  FALSE_POSITIVE:{ background: 'var(--success-bg)',       color: 'var(--success)'       },
};

export function Clusters() {
  const { data, isLoading } = useQuery({
    queryKey: ['clusters', { page: 1, pageSize: 20 }],
    queryFn:  () => clusterApi.getClusters({ page: 1, pageSize: 20 }),
  });

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--fg)' }}>Risk Clusters</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--fg-muted)' }}>
            Suspicious groups detected through shared devices, IPs, and transaction patterns.
          </p>
        </div>
        <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: 'var(--accent-muted)' }}>
          <Network className="h-4 w-4" style={{ color: 'var(--accent)' }} />
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        {[
          { label: 'Total Clusters',    value: data?.total ?? 0,                       color: undefined },
          { label: 'High / Critical',   value: data?.data.filter(c => ['HIGH','CRITICAL'].includes(c.riskLevel)).length ?? 0, color: 'var(--risk-high)' },
          { label: 'Under Investigation', value: data?.data.filter(c => c.status === 'INVESTIGATING').length ?? 0,            color: 'var(--warning)'  },
          { label: 'Total Exposure',    value: `$${formatNumber(data?.data.reduce((a, c) => a + c.totalExposure, 0) ?? 0)}`, color: undefined },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-5 pb-4">
              <div className="text-xs uppercase tracking-wider mb-1.5" style={{ color: 'var(--fg-subtle)' }}>{s.label}</div>
              <div className="text-2xl font-bold" style={{ color: s.color ?? 'var(--fg)' }}>
                {typeof s.value === 'number' ? formatNumber(s.value) : s.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Clusters</CardTitle>
        </CardHeader>
        <CardContent className="px-0 py-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-48 gap-3" style={{ color: 'var(--fg-subtle)' }}>
              <span className="h-5 w-5 border-2 border-current/20 border-t-current rounded-full animate-spin" />
              Loading clusters…
            </div>
          ) : !data?.data.length ? (
            <div className="flex flex-col items-center justify-center h-48 gap-2">
              <Network className="h-10 w-10" style={{ color: 'var(--fg-subtle)' }} />
              <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>No suspicious clusters detected</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Cluster ID</TableHead>
                  <TableHead>Customers</TableHead>
                  <TableHead>Devices</TableHead>
                  <TableHead>IPs</TableHead>
                  <TableHead>Transactions</TableHead>
                  <TableHead>Refunds</TableHead>
                  <TableHead>Risk</TableHead>
                  <TableHead>Exposure</TableHead>
                  <TableHead>Primary Signal</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Detected</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((cluster) => (
                  <TableRow key={cluster.id}>
                    <TableCell className="pl-6">
                      <span className="font-mono text-xs font-semibold" style={{ color: 'var(--fg)' }}>
                        {cluster.clusterId}
                      </span>
                    </TableCell>
                    <TableCell style={{ color: 'var(--fg)' }}>{cluster.customerCount}</TableCell>
                    <TableCell>{cluster.deviceCount}</TableCell>
                    <TableCell>{cluster.ipCount}</TableCell>
                    <TableCell style={{ color: 'var(--fg)' }}>{formatNumber(cluster.transactionCount)}</TableCell>
                    <TableCell>
                      <span style={{ color: cluster.refundCount > 10 ? 'var(--risk-high)' : 'var(--fg-muted)', fontWeight: cluster.refundCount > 10 ? 600 : 400 }}>
                        {cluster.refundCount}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="risk" riskLevel={cluster.riskLevel}>{cluster.riskLevel}</Badge>
                    </TableCell>
                    <TableCell>
                      <span className="font-semibold tabular-nums" style={{ color: 'var(--fg)' }}>
                        {formatCurrency(cluster.totalExposure)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs" style={{ color: 'var(--fg-muted)' }}>{cluster.primarySignal}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-md"
                        style={STATUS_STYLE[cluster.status] ?? {}}>
                        {cluster.status.replace('_', ' ')}
                      </span>
                    </TableCell>
                    <TableCell>{formatRelativeTime(cluster.detectedAt)}</TableCell>
                    <TableCell>
                      <Link to={`/clusters/${cluster.clusterId}`}
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
