import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { dashboardApi, clusterApi, investigationApi } from '@/services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { formatNumber, formatPercent, formatRelativeTime, formatCurrency } from '@/lib/utils';
import {
  BarChart3, Users, Network, FileSearch, Target, TrendingUp,
  AlertTriangle, ArrowRight,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';

/* ── Custom tooltip ────────────────────────────────────────────── */
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg px-3 py-2 text-xs shadow-lg"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--fg)' }}>
      {label && <div className="font-semibold mb-1" style={{ color: 'var(--fg-muted)' }}>{label}</div>}
      {payload.map((p: any, i: number) => (
        <div key={i}>{p.name ? `${p.name}: ` : ''}<strong>{p.value}</strong></div>
      ))}
    </div>
  );
}

/* ── KPI card ──────────────────────────────────────────────────── */
function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ComponentType<any>;
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: 'var(--fg-subtle)' }}>
              {label}
            </div>
            <div className="text-2xl font-bold" style={{ color: accent || 'var(--fg)' }}>
              {value}
            </div>
            {sub && <div className="text-xs mt-1" style={{ color: 'var(--fg-subtle)' }}>{sub}</div>}
          </div>
          <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'var(--accent-muted)' }}>
            <Icon className="h-4 w-4" style={{ color: 'var(--accent)' }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Risk distribution data ────────────────────────────────────── */
const riskDist = [
  { name: 'Low',      value: 850, color: '#4ade80' },
  { name: 'Medium',   value: 320, color: '#fbbf24' },
  { name: 'High',     value: 120, color: '#fb923c' },
  { name: 'Critical', value: 23,  color: '#f87171' },
];

const signalDist = [
  { name: 'Refund\nVelocity',  count: 45 },
  { name: 'Device\nReuse',     count: 38 },
  { name: 'Txn\nVelocity',     count: 32 },
  { name: 'IP\nReuse',         count: 28 },
  { name: 'Amt\nSimilarity',   count: 24 },
  { name: 'Coordinated',       count: 18 },
];

/* ── component ─────────────────────────────────────────────────── */
export function Dashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => dashboardApi.getStats(),
  });
  const { data: clustersData } = useQuery({
    queryKey: ['clusters', { page: 1, pageSize: 5 }],
    queryFn: () => clusterApi.getClusters({ page: 1, pageSize: 5 }),
  });
  const { data: investigationsData } = useQuery({
    queryKey: ['investigations', { page: 1, pageSize: 5 }],
    queryFn: () => investigationApi.getInvestigations({ page: 1, pageSize: 5 }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="h-6 w-6 border-2 border-[var(--border-strong)] border-t-[var(--accent)] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--fg)' }}>Risk Operations</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--fg-muted)' }}>
          Monitor merchant activity, investigate suspicious behaviour, and measure detector performance.
        </p>
      </div>

      {/* KPI row */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <KpiCard icon={BarChart3} label="Transactions Analyzed"
          value={formatNumber(stats?.transactionsAnalyzed ?? 0)} sub="Last 30 days" />
        <KpiCard icon={Users}     label="High-Risk Customers"
          value={formatNumber(stats?.highRiskCustomers ?? 0)}    sub="Requires review"
          accent="var(--risk-high)" />
        <KpiCard icon={Network}   label="Suspicious Clusters"
          value={formatNumber(stats?.suspiciousClusters ?? 0)}   sub="Active"
          accent="var(--risk-critical)" />
        <KpiCard icon={FileSearch} label="Open Investigations"
          value={formatNumber(stats?.openInvestigations ?? 0)}   sub="Pending review" />
      </div>

      {/* Precision / Recall */}
      <div className="grid gap-3 md:grid-cols-2">
        {[
          { icon: Target,   label: 'Detection Precision', val: stats?.detectionPrecision ?? 0, desc: 'Flagged cases that are true positives' },
          { icon: TrendingUp, label: 'Detection Recall',   val: stats?.detectionRecall   ?? 0, desc: 'Actual fraud cases detected'          },
        ].map(({ icon: Icon, label, val, desc }) => (
          <Card key={label}>
            <CardContent className="pt-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: 'var(--fg-subtle)' }}>
                    {label}
                  </div>
                  <div className="text-3xl font-bold" style={{ color: 'var(--accent)' }}>
                    {formatPercent(val, 1)}
                  </div>
                  <div className="text-xs mt-1" style={{ color: 'var(--fg-subtle)' }}>{desc}</div>
                </div>
                <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: 'var(--accent-muted)' }}>
                  <Icon className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium w-fit"
                style={{ background: 'var(--warning-bg)', color: 'var(--warning)' }}>
                <AlertTriangle className="h-3.5 w-3.5" />
                SYNTHETIC EVALUATION DATA
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Risk distribution pie */}
        <Card>
          <CardHeader><CardTitle>Risk Distribution</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={riskDist} cx="50%" cy="50%" outerRadius={80}
                  dataKey="value" nameKey="name" label={({ name, value }) => `${name}: ${value}`}
                  labelLine={false}>
                  {riskDist.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Signal distribution bar */}
        <Card>
          <CardHeader><CardTitle>Risk Signal Distribution</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={signalDist} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: 'var(--fg-subtle)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--fg-subtle)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="count" fill="var(--accent)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Tables row */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Suspicious clusters */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Suspicious Clusters</CardTitle>
              <Link to="/clusters" className="text-xs flex items-center gap-1 hover:underline"
                style={{ color: 'var(--accent)' }}>
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="px-0 pb-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cluster</TableHead>
                  <TableHead>Members</TableHead>
                  <TableHead>Risk</TableHead>
                  <TableHead>Exposure</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clustersData?.data.slice(0, 5).map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Link to={`/clusters/${c.clusterId}`}
                        className="font-medium hover:underline" style={{ color: 'var(--accent)' }}>
                        {c.clusterId}
                      </Link>
                    </TableCell>
                    <TableCell>{c.customerCount}</TableCell>
                    <TableCell>
                      <Badge variant="risk" riskLevel={c.riskLevel}>{c.riskLevel}</Badge>
                    </TableCell>
                    <TableCell style={{ color: 'var(--fg)' }}>{formatCurrency(c.totalExposure)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Investigation queue */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Investigation Queue</CardTitle>
              <Link to="/investigations" className="text-xs flex items-center gap-1 hover:underline"
                style={{ color: 'var(--accent)' }}>
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="px-0 pb-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Risk</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {investigationsData?.data.filter((i) => i.status !== 'RESOLVED').slice(0, 5).map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell>
                      <Link to={`/investigations/${inv.investigationId}`}
                        className="font-medium hover:underline" style={{ color: 'var(--accent)' }}>
                        {inv.investigationId}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-[140px] truncate" style={{ color: 'var(--fg)' }}>
                      {inv.subject}
                    </TableCell>
                    <TableCell>
                      <Badge variant="risk" riskLevel={inv.riskLevel}>{inv.riskLevel}</Badge>
                    </TableCell>
                    <TableCell>{formatRelativeTime(inv.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
