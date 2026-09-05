import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { clusterApi } from '@/services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { KpiCard } from '@/components/ui/KpiCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { formatNumber, formatCurrency, formatRelativeTime } from '@/lib/utils';
import { Network, ArrowRight, DollarSign, ShieldAlert, Microscope } from 'lucide-react';

const STATUS_VARIANT: Record<string, string> = {
  DETECTED:       'info',
  INVESTIGATING:  'warning',
  CONFIRMED:      'danger',
  FALSE_POSITIVE: 'success',
};

export function Clusters() {
  const { data, isLoading } = useQuery({
    queryKey: ['clusters', { page: 1, pageSize: 20 }],
    queryFn:  () => clusterApi.getClusters({ page: 1, pageSize: 20 }),
  });

  const clusters = data?.data ?? [];
  const highCritical = clusters.filter(c => ['HIGH','CRITICAL'].includes(c.riskLevel)).length;
  const investigating = clusters.filter(c => c.status === 'INVESTIGATING').length;
  const totalExposure = clusters.reduce((a, c) => a + c.totalExposure, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Network}
        title="Risk Clusters"
        subtitle="Suspicious groups detected through shared devices, IPs, and transaction patterns."
      />

      {/* KPI row */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <KpiCard icon={Network}     label="Total Clusters"       value={formatNumber(data?.total ?? 0)}           delay="animate-fade-up-d1" />
        <KpiCard icon={ShieldAlert} label="High / Critical"      value={formatNumber(highCritical)}               accent="danger"   delay="animate-fade-up-d2" />
        <KpiCard icon={Microscope}  label="Under Investigation"  value={formatNumber(investigating)}              accent="warning"  delay="animate-fade-up-d3" />
        <KpiCard icon={DollarSign}  label="Total Exposure"       value={formatCurrency(totalExposure)}            delay="animate-fade-up-d4" />
      </div>

      {/* Table */}
      <Card variant="elevated" className="animate-fade-up-d3">
        <CardHeader>
          <CardTitle>All Clusters</CardTitle>
        </CardHeader>
        <CardContent className="px-0 py-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-52 gap-3" style={{ color: 'var(--fg-subtle)' }}>
              <span className="h-5 w-5 border-2 border-current/20 border-t-current rounded-full animate-spin" />
              Loading clusters…
            </div>
          ) : !clusters.length ? (
            <div className="flex flex-col items-center justify-center h-52 gap-3">
              <div className="h-14 w-14 rounded-2xl flex items-center justify-center" style={{ background: 'var(--surface-2)' }}>
                <Network className="h-7 w-7" style={{ color: 'var(--fg-subtle)' }} />
              </div>
              <p className="text-sm font-medium" style={{ color: 'var(--fg-muted)' }}>No suspicious clusters detected</p>
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
                {clusters.map((cluster) => (
                  <TableRow key={cluster.id}>
                    <TableCell className="pl-6">
                      <span className="font-mono text-xs font-bold px-1.5 py-0.5 rounded"
                        style={{ background: 'var(--surface-2)', color: 'var(--fg)' }}>
                        {cluster.clusterId}
                      </span>
                    </TableCell>
                    <TableCell style={{ color: 'var(--fg)', fontWeight: 600 }}>{cluster.customerCount}</TableCell>
                    <TableCell>{cluster.deviceCount}</TableCell>
                    <TableCell>{cluster.ipCount}</TableCell>
                    <TableCell style={{ color: 'var(--fg)' }}>{formatNumber(cluster.transactionCount)}</TableCell>
                    <TableCell>
                      <span style={{ color: cluster.refundCount > 10 ? 'var(--risk-high)' : 'var(--fg-muted)', fontWeight: cluster.refundCount > 10 ? 600 : 400 }}>
                        {cluster.refundCount}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="risk" riskLevel={cluster.riskLevel} dot>{cluster.riskLevel}</Badge>
                    </TableCell>
                    <TableCell>
                      <span className="font-bold tabular-nums text-sm" style={{ color: 'var(--fg)' }}>
                        {formatCurrency(cluster.totalExposure)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--surface-2)', color: 'var(--fg-muted)' }}>
                        {cluster.primarySignal}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[cluster.status] as any ?? 'default'}>
                        {cluster.status.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs" style={{ color: 'var(--fg-subtle)' }}>
                      {formatRelativeTime(cluster.detectedAt)}
                    </TableCell>
                    <TableCell>
                      <Link to={`/clusters/${cluster.clusterId}`}
                        className="inline-flex items-center gap-1 text-xs font-medium hover:underline"
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
