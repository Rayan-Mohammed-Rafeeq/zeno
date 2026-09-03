import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { dashboardApi } from '@/services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { formatNumber, formatPercent, formatCurrency } from '@/lib/utils';
import {
  BarChart3, Users, Network, FileSearch, Target, TrendingUp,
  AlertTriangle, ArrowRight, Activity,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';

/* ── Custom tooltip ──────────────────────────────────────────────── */
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

/* ── KPI card ────────────────────────────────────────────────────── */
function KpiCard({ icon: Icon, label, value, sub, accent }: {
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
            <div className="text-xs font-medium uppercase tracking-wider mb-2"
              style={{ color: 'var(--fg-subtle)' }}>
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

/* ── Risk level colour map ───────────────────────────────────────── */
const RISK_COLORS: Record<string, string> = {
  LOW:      '#4ade80',
  MEDIUM:   '#fbbf24',
  HIGH:     '#fb923c',
  CRITICAL: '#f87171',
};

/* ── Component ───────────────────────────────────────────────────── */
export function Dashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => dashboardApi.getStats(),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="h-6 w-6 border-2 border-[var(--border-strong)] border-t-[var(--accent)] rounded-full animate-spin" />
      </div>
    );
  }

  /* ── Derived chart data from live stats ───────────────────────── */
  const riskDistData = stats?.riskDistribution
    ? Object.entries(stats.riskDistribution).map(([name, value]) => ({
        name,
        value: value as number,
        color: RISK_COLORS[name] ?? '#94a3b8',
      }))
    : [];

  const signalDistData = stats?.topSignals
    ? stats.topSignals.map((s) => ({
        name: s.signalType.replace(/_/g, '\n').toLowerCase(),
        count: s.count,
      }))
    : [];

  const precision = stats?.precision ?? null;
  const recall    = stats?.recall    ?? null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--fg)' }}>Risk Operations</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--fg-muted)' }}>
          Monitor merchant activity, investigate suspicious behaviour, and measure detector performance.
        </p>
      </div>

      {/* Disclaimer */}
      {stats?.dataDisclaimer && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl text-xs"
          style={{ background: 'var(--warning-bg)', border: '1px solid var(--warning)', color: 'var(--warning)' }}>
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{stats.dataDisclaimer}</span>
        </div>
      )}

      {/* KPI row */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <KpiCard icon={BarChart3}  label="Transactions Analyzed"
          value={formatNumber(stats?.transactionsAnalyzed ?? 0)} sub="Current dataset" />
        <KpiCard icon={Users}      label="High-Risk Customers"
          value={formatNumber(stats?.highRiskCustomers ?? 0)} sub="Requires review"
          accent="var(--risk-high)" />
        <KpiCard icon={Network}    label="Suspicious Clusters"
          value={formatNumber(stats?.suspiciousClusters ?? 0)} sub="Active"
          accent="var(--risk-critical)" />
        <KpiCard icon={FileSearch} label="Open Investigations"
          value={formatNumber(stats?.openInvestigations ?? 0)} sub="Pending review" />
      </div>

      {/* Precision / Recall — only shown after evaluation run */}
      {(precision !== null || recall !== null) && (
        <div className="grid gap-3 md:grid-cols-2">
          {[
            { icon: Target,     label: 'Detection Precision', val: precision ?? 0, desc: 'Flagged cases that are true positives' },
            { icon: TrendingUp, label: 'Detection Recall',    val: recall    ?? 0, desc: 'Actual fraud cases detected' },
          ].map(({ icon: Icon, label, val, desc }) => (
            <Card key={label}>
              <CardContent className="pt-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wider mb-1"
                      style={{ color: 'var(--fg-subtle)' }}>
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
      )}

      {/* Charts row — live data from backend */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Risk distribution pie */}
        <Card>
          <CardHeader><CardTitle>Risk Distribution</CardTitle></CardHeader>
          <CardContent>
            {riskDistData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={riskDistData} cx="50%" cy="50%" outerRadius={80}
                    dataKey="value" nameKey="name"
                    label={({ name, value }) => value > 0 ? `${name}: ${value}` : ''}
                    labelLine={false}>
                    {riskDistData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[220px] text-sm"
                style={{ color: 'var(--fg-subtle)' }}>
                No risk data — run risk analysis first.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Signal distribution bar — top 5 signals from backend */}
        <Card>
          <CardHeader><CardTitle>Top Risk Signals</CardTitle></CardHeader>
          <CardContent>
            {signalDistData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={signalDistData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: 'var(--fg-subtle)', fontSize: 10 }}
                    axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--fg-subtle)', fontSize: 10 }}
                    axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="count" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[220px] text-sm"
                style={{ color: 'var(--fg-subtle)' }}>
                No signal data — run risk analysis first.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tables row — live clusters + investigations from backend */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Recent suspicious clusters */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Suspicious Clusters</CardTitle>
              <Link to="/clusters" className="text-xs flex items-center gap-1 hover:underline"
                style={{ color: 'var(--accent)' }}>
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="px-0 pb-2">
            {stats?.recentClusters && stats.recentClusters.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Cluster</TableHead>
                    <TableHead>Members</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Risk</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.recentClusters.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="pl-6">
                        <Link to={`/clusters/${c.id}`}
                          className="font-mono text-xs hover:underline"
                          style={{ color: 'var(--accent)' }}>
                          {c.id.slice(0, 8)}…
                        </Link>
                      </TableCell>
                      <TableCell style={{ color: 'var(--fg)' }}>{c.memberCount}</TableCell>
                      <TableCell style={{ color: 'var(--fg)' }}>{c.riskScore}</TableCell>
                      <TableCell>
                        <Badge variant="risk" riskLevel={c.riskLevel as any}>{c.riskLevel}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="px-6 py-8 text-sm text-center" style={{ color: 'var(--fg-subtle)' }}>
                No clusters detected yet. Run cluster detection first.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent investigations */}
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
            {stats?.recentInvestigations && stats.recentInvestigations.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">ID</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Risk</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.recentInvestigations.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="pl-6">
                        <Link to={`/investigations/${inv.id}`}
                          className="font-mono text-xs hover:underline"
                          style={{ color: 'var(--accent)' }}>
                          {inv.id.slice(0, 8)}…
                        </Link>
                      </TableCell>
                      <TableCell className="text-xs" style={{ color: 'var(--fg)' }}>
                        {inv.subjectType}
                      </TableCell>
                      <TableCell className="text-xs" style={{ color: 'var(--fg-muted)' }}>
                        {inv.status}
                      </TableCell>
                      <TableCell>
                        <Badge variant="risk" riskLevel={inv.riskLevel as any}>{inv.riskLevel}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="px-6 py-8 text-sm text-center" style={{ color: 'var(--fg-subtle)' }}>
                No open investigations.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
