import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { dashboardApi, evaluationApi } from '@/services/api';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { KpiCard } from '@/components/ui/KpiCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { formatNumber, formatPercent } from '@/lib/utils';
import {
  BarChart3, Users, Network, FileSearch, Target, TrendingUp,
  AlertTriangle, ArrowRight, Activity,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

/* ── Gradient chart tooltip ─────────────────────────────────────────── */
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-xl px-4 py-3 text-xs shadow-xl"
      style={{
        background: 'var(--glass-bg)',
        border: '1px solid var(--glass-border)',
        backdropFilter: 'blur(12px)',
        color: 'var(--fg)',
      }}
    >
      {label && <div className="font-bold mb-1.5" style={{ color: 'var(--fg-muted)' }}>{label}</div>}
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: p.fill || p.color || 'var(--accent)' }} />
          {p.name ? `${p.name}: ` : ''}
          <strong style={{ color: 'var(--fg)' }}>{p.value}</strong>
        </div>
      ))}
    </div>
  );
}

/* ── Risk level colour map ────────────────────────────────────────────── */
const RISK_COLORS: Record<string, string> = {
  LOW:      '#4ade80',
  MEDIUM:   '#fbbf24',
  HIGH:     '#fb923c',
  CRITICAL: '#f87171',
};

/* ── Metric card for precision/recall ──────────────────────────────────── */
function MetricCard({
  icon: Icon, label, value, desc, delay,
}: {
  icon: React.ComponentType<any>; label: string; value: number; desc: string; delay?: string;
}) {
  const pct = Math.round(value * 100);
  return (
    <div className={`glass-card p-5 animate-fade-up ${delay ?? ''}`}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] mb-1" style={{ color: 'var(--fg-subtle)' }}>{label}</p>
          <div className="text-3xl font-bold kpi-value">{formatPercent(value, 1)}</div>
          <p className="text-xs mt-1" style={{ color: 'var(--fg-subtle)' }}>{desc}</p>
        </div>
        <div
          className="h-10 w-10 rounded-xl flex items-center justify-center"
          style={{ background: 'var(--accent-muted)', border: '1px solid var(--glass-border)' }}
        >
          <Icon className="h-4 w-4" style={{ color: 'var(--accent)' }} />
        </div>
      </div>
      {/* Progress bar */}
      <div className="stat-bar-track">
        <div className="stat-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold"
          style={{ background: 'var(--warning-bg)', color: 'var(--warning)' }}
        >
          <AlertTriangle className="h-2.5 w-2.5" /> SYNTHETIC DATA
        </span>
      </div>
    </div>
  );
}

/* ── Component ────────────────────────────────────────────────────────── */
export function Dashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => dashboardApi.getStats(),
  });

  const { data: modelMetrics } = useQuery({
    queryKey: ['model-metrics'],
    queryFn: () => evaluationApi.getModelMetrics(),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="h-6 w-6 border-2 border-[var(--border-strong)] border-t-[var(--accent)] rounded-full animate-spin" />
      </div>
    );
  }

  const riskDistData = stats?.riskDistribution
    ? Object.entries(stats.riskDistribution).map(([name, value]) => ({
        name,
        value: value as number,
        color: RISK_COLORS[name] ?? '#94a3b8',
      }))
    : [];

  const signalDistData = stats?.topSignals
    ? stats.topSignals.map((s) => ({
        name: s.signalType.replace(/_/g, ' ').toLowerCase(),
        count: s.count,
      }))
    : [];

  const precision = stats?.precision ?? null;
  const recall    = stats?.recall    ?? null;

  return (
    <div className="space-y-7">
      {/* Header */}
      <PageHeader
        icon={Activity}
        title="Risk Operations"
        subtitle="Monitor merchant activity, investigate suspicious behaviour, and measure detector performance."
      />

      {/* Disclaimer */}
      {stats?.dataDisclaimer && (
        <div
          className="flex items-start gap-3 px-4 py-3 rounded-xl text-xs animate-fade-up"
          style={{
            background: 'var(--warning-bg)',
            border: '1px solid rgba(251,191,36,0.3)',
            color: 'var(--warning)',
          }}
        >
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{stats.dataDisclaimer}</span>
        </div>
      )}

      {/* ── IEEE-CIS Model Benchmark — clearly separated from live data ── */}
      <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-bold" style={{ color: 'var(--fg)' }}>XGBoost Model · IEEE-CIS Benchmark</span>
          <span className="text-xs px-2 py-0.5 rounded font-semibold ml-auto"
            style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}>
            HELD-OUT TEST SET — NOT PRODUCTION
          </span>
        </div>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          {[
            { label: 'Precision', value: modelMetrics ? (modelMetrics.precision * 100).toFixed(1) + '%' : '61.6%' },
            { label: 'Recall',    value: modelMetrics ? (modelMetrics.recall   * 100).toFixed(1) + '%' : '48.1%' },
            { label: 'F1',        value: modelMetrics ? (modelMetrics.f1       * 100).toFixed(1) + '%' : '54.0%' },
            { label: 'AUPRC',     value: modelMetrics ? modelMetrics.auprc.toFixed(2)                  : '0.56'  },
            { label: 'ROC-AUC',   value: modelMetrics ? (modelMetrics.rocAuc   * 100).toFixed(1) + '%' : '90.3%' },
            { label: 'FP Rate',   value: modelMetrics ? (modelMetrics.fpr      * 100).toFixed(2) + '%' : '1.1%'  },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-lg p-2 text-center" style={{ background: 'var(--surface)' }}>
              <div className="text-xs uppercase tracking-wider mb-1"
                style={{ color: 'var(--fg-subtle)', fontSize: '9px' }}>{label}</div>
              <div className="text-lg font-bold" style={{ color: 'var(--accent)' }}>{value}</div>
            </div>
          ))}
        </div>
        <p className="text-xs" style={{ color: 'var(--fg-subtle)' }}>
          Measured on IEEE-CIS held-out test set ({modelMetrics ? modelMetrics.nTest.toLocaleString() : '~22,500'} transactions).
          Threshold frozen on validation data. These metrics do not represent Razorpay production performance.
        </p>
      </div>

      {/* ── LIVE OPERATIONS ── */}
      {/* KPI row */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={BarChart3}
          label="Transactions Analyzed"
          value={formatNumber(stats?.transactionsAnalyzed ?? 0)}
          sub="Current dataset"
          delay="animate-fade-up-d1"
        />
        <KpiCard
          icon={Users}
          label="High-Risk Customers"
          value={formatNumber(stats?.highRiskCustomers ?? 0)}
          sub="Requires review"
          accent="danger"
          delay="animate-fade-up-d2"
        />
        <KpiCard
          icon={Network}
          label="Suspicious Clusters"
          value={formatNumber(stats?.suspiciousClusters ?? 0)}
          sub="Active"
          accent="danger"
          delay="animate-fade-up-d3"
        />
        <KpiCard
          icon={FileSearch}
          label="Open Investigations"
          value={formatNumber(stats?.openInvestigations ?? 0)}
          sub="Pending review"
          delay="animate-fade-up-d4"
        />
      </div>

      {/* Precision / Recall */}
      {(precision !== null || recall !== null) && (
        <div className="grid gap-4 md:grid-cols-2">
          {[
            { icon: Target,     label: 'Synthetic Eval Precision', val: precision ?? 0, desc: 'On synthetic ground-truth labels', delay: 'animate-fade-up-d1' },
            { icon: TrendingUp, label: 'Synthetic Eval Recall',    val: recall    ?? 0, desc: 'On synthetic ground-truth labels',  delay: 'animate-fade-up-d2' },
          ].map(({ icon, label, val, desc, delay }) => (
            <MetricCard key={label} icon={icon} label={label} value={val} desc={desc} delay={delay} />
          ))}
        </div>
      )}

      {/* Charts row */}
      <div className="grid gap-4 md:grid-cols-2 animate-fade-up-d2">
        {/* Risk distribution */}
        <div className="glass-card p-6">
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--fg)' }}>Risk Distribution</h3>
          {riskDistData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={riskDistData}
                  cx="50%" cy="50%"
                  outerRadius={80}
                  innerRadius={48}
                  dataKey="value"
                  nameKey="name"
                  paddingAngle={3}
                  stroke="none"
                >
                  {riskDistData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Legend
                  iconType="circle"
                  iconSize={8}
                  formatter={(value) => (
                    <span style={{ color: 'var(--fg-muted)', fontSize: 11 }}>{value}</span>
                  )}
                />
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[220px] text-sm" style={{ color: 'var(--fg-subtle)' }}>
              No risk data — run risk analysis first.
            </div>
          )}
        </div>

        {/* Signal distribution */}
        <div className="glass-card p-6">
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--fg)' }}>Top Risk Signals</h3>
          {signalDistData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={signalDistData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.4} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: 'var(--fg-subtle)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--fg-subtle)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--row-hover-bg)' }} />
                <Bar dataKey="count" fill="url(#barGrad)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[220px] text-sm" style={{ color: 'var(--fg-subtle)' }}>
              No signal data — run risk analysis first.
            </div>
          )}
        </div>
      </div>

      {/* Tables row */}
      <div className="grid gap-4 md:grid-cols-2 animate-fade-up-d3">
        {/* Suspicious clusters */}
        <Card variant="elevated">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Suspicious Clusters</CardTitle>
              <Link
                to="/clusters"
                className="text-xs flex items-center gap-1 font-medium transition-colors hover:underline"
                style={{ color: 'var(--accent)' }}
              >
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
                        <Link to={`/clusters/${c.id}`} className="font-mono text-xs font-semibold hover:underline" style={{ color: 'var(--accent)' }}>
                          {c.id.slice(0, 8)}…
                        </Link>
                      </TableCell>
                      <TableCell style={{ color: 'var(--fg)' }}>{c.memberCount}</TableCell>
                      <TableCell>
                        <span className="font-bold tabular-nums" style={{ color: 'var(--fg)' }}>{c.riskScore}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="risk" riskLevel={c.riskLevel as any} dot>{c.riskLevel}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="px-6 py-10 text-sm text-center" style={{ color: 'var(--fg-subtle)' }}>
                No clusters detected yet. Run cluster detection first.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Investigation queue */}
        <Card variant="elevated">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Investigation Queue</CardTitle>
              <Link
                to="/investigations"
                className="text-xs flex items-center gap-1 font-medium transition-colors hover:underline"
                style={{ color: 'var(--accent)' }}
              >
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
                        <Link to={`/investigations/${inv.id}`} className="font-mono text-xs font-semibold hover:underline" style={{ color: 'var(--accent)' }}>
                          {inv.id.slice(0, 8)}…
                        </Link>
                      </TableCell>
                      <TableCell className="text-xs font-medium" style={{ color: 'var(--fg)' }}>{inv.subjectType}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{inv.status}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="risk" riskLevel={inv.riskLevel as any} dot>{inv.riskLevel}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="px-6 py-10 text-sm text-center" style={{ color: 'var(--fg-subtle)' }}>
                No open investigations.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
