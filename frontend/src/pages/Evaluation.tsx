import { useQuery } from '@tanstack/react-query';
import { evaluationApi, monitoringApi } from '@/services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { formatNumber, formatPercent, formatCurrency } from '@/lib/utils';
import { AlertTriangle, Target, TrendingUp, BarChart3, Activity, CheckCircle, XCircle } from 'lucide-react';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg px-3 py-2 text-xs shadow-lg"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--fg)' }}>
      {label && <div className="font-semibold mb-1" style={{ color: 'var(--fg-muted)' }}>{label}</div>}
      {payload.map((p: any, i: number) => (
        <div key={i}>{p.name}: <strong>{typeof p.value === 'number' && p.value < 2 ? formatPercent(p.value) : p.value}</strong></div>
      ))}
    </div>
  );
}

function MetricCard({
  label, value, sub, icon: Icon, color,
}: { label: string; value: string; sub?: string; icon: React.ComponentType<any>; color?: string }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--fg-subtle)' }}>{label}</div>
            <div className="text-3xl font-bold" style={{ color: color ?? 'var(--accent)' }}>{value}</div>
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

export function Evaluation() {
  const { data: metrics }  = useQuery({ queryKey: ['evaluation-metrics'],  queryFn: evaluationApi.getMetrics });
  const { data: signals }  = useQuery({ queryKey: ['signal-performance'],  queryFn: evaluationApi.getSignalPerformance });
  const { data: fps }      = useQuery({ queryKey: ['false-positives'],     queryFn: evaluationApi.getFalsePositives });
  const { data: monitoring } = useQuery({
    queryKey: ['monitoring-health'],
    queryFn:  monitoringApi.getHealth,
    refetchInterval: 30_000,  // refresh every 30 s
  });

  const radarData = signals?.map((s) => ({
    signal:    s.signalType.split(' ')[0],
    Precision: +(s.precision * 100).toFixed(1),
    Recall:    +(s.recall    * 100).toFixed(1),
  })) ?? [];

  const barData = signals?.map((s) => ({
    name: s.signalType.split(' ')[0],
    FPs:  s.falsePositives,
    Contribution: s.contribution,
  })) ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--fg)' }}>Detector Evaluation</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--fg-muted)' }}>
          Measure performance against held-out synthetic ground truth.
        </p>
      </div>

      {/* Limitations banner */}
      <div className="flex items-start gap-3 px-5 py-4 rounded-xl"
        style={{ background: 'var(--warning-bg)', border: '1px solid var(--warning)' }}>
        <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" style={{ color: 'var(--warning)' }} />
        <div>
          <div className="text-sm font-bold mb-1" style={{ color: 'var(--warning)' }}>Honest Limitations</div>
          <p className="text-sm" style={{ color: 'var(--warning)' }}>
            This evaluation uses <strong>synthetic data generated for the prototype</strong>.
            Results should not be interpreted as production fraud-detection performance.
            Real-world accuracy will vary based on merchant characteristics, transaction patterns,
            and evolving fraud tactics.
          </p>
        </div>
      </div>

      {/* Dataset summary */}
      <div className="grid gap-3 grid-cols-3">
        {[
          { label: 'Dataset Size',    val: formatNumber(metrics?.datasetSize ?? 0),     color: undefined },
          { label: 'Positive Cases',  val: formatNumber(metrics?.positiveCases ?? 0),   color: 'var(--risk-high)' },
          { label: 'Negative Cases',  val: formatNumber(metrics?.negativeCases ?? 0),   color: 'var(--success)'   },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-5 pb-4">
              <div className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--fg-subtle)' }}>{s.label}</div>
              <div className="text-2xl font-bold" style={{ color: s.color ?? 'var(--fg)' }}>{s.val}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Core metrics */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <MetricCard label="Precision"     icon={Target}   value={formatPercent(metrics?.precision ?? 0)}    sub="True positives / Total flagged"       />
        <MetricCard label="Recall"        icon={TrendingUp} value={formatPercent(metrics?.recall ?? 0)}    sub="True positives / Actual fraud"         />
        <MetricCard label="F1 Score"      icon={BarChart3} value={formatPercent(metrics?.f1Score ?? 0)}    sub="Harmonic mean of P & R"                />
        <MetricCard label="FP Rate"       icon={AlertTriangle} value={formatPercent(metrics?.falsePositiveRate ?? 0)} sub="False positives / Legitimate" color="var(--risk-high)" />
      </div>

      {/* FP cost */}
      <Card>
        <CardContent className="pt-5 pb-5">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--fg-subtle)' }}>
                False Positive Cost (Estimated)
              </div>
              <div className="text-3xl font-bold" style={{ color: 'var(--risk-high)' }}>
                {formatCurrency(metrics?.falsePositiveCost ?? 0)}
              </div>
              <div className="text-xs mt-1" style={{ color: 'var(--fg-subtle)' }}>
                Based on {formatNumber(metrics?.falsePositives ?? 0)} false positives ×
                estimated manual review cost per case
              </div>
            </div>
            <div className="text-xs max-w-sm p-3 rounded-lg"
              style={{ background: 'var(--surface-2)', color: 'var(--fg-subtle)' }}>
              This cost estimate is illustrative only and uses synthetic data.
              Real costs depend on analyst time, merchant volume, and operational factors.
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Confusion matrix + radar side by side */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Confusion matrix */}
        <Card>
          <CardHeader><CardTitle>Confusion Matrix</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2 text-center">
              {/* Headers */}
              <div />
              <div className="text-xs font-semibold py-2 rounded-lg"
                style={{ background: 'var(--surface-2)', color: 'var(--fg-subtle)' }}>
                Predicted Risk
              </div>
              <div className="text-xs font-semibold py-2 rounded-lg"
                style={{ background: 'var(--surface-2)', color: 'var(--fg-subtle)' }}>
                Predicted Normal
              </div>

              {/* Row 1 */}
              <div className="text-xs font-semibold flex items-center justify-end pr-2"
                style={{ color: 'var(--fg-subtle)' }}>
                Actual Risk
              </div>
              <div className="rounded-xl p-4" style={{ background: 'var(--success-bg)', border: '2px solid var(--success)' }}>
                <div className="text-2xl font-bold" style={{ color: 'var(--success)' }}>
                  {formatNumber(metrics?.truePositives ?? 0)}
                </div>
                <div className="text-xs mt-1" style={{ color: 'var(--success)' }}>True Positives</div>
              </div>
              <div className="rounded-xl p-4" style={{ background: 'var(--danger-bg)', border: '2px solid var(--danger)' }}>
                <div className="text-2xl font-bold" style={{ color: 'var(--danger)' }}>
                  {formatNumber(metrics?.falseNegatives ?? 0)}
                </div>
                <div className="text-xs mt-1" style={{ color: 'var(--danger)' }}>False Negatives</div>
              </div>

              {/* Row 2 */}
              <div className="text-xs font-semibold flex items-center justify-end pr-2"
                style={{ color: 'var(--fg-subtle)' }}>
                Actual Normal
              </div>
              <div className="rounded-xl p-4" style={{ background: 'var(--risk-high-bg)', border: '2px solid var(--risk-high)' }}>
                <div className="text-2xl font-bold" style={{ color: 'var(--risk-high)' }}>
                  {formatNumber(metrics?.falsePositives ?? 0)}
                </div>
                <div className="text-xs mt-1" style={{ color: 'var(--risk-high)' }}>False Positives</div>
              </div>
              <div className="rounded-xl p-4" style={{ background: 'var(--success-bg)', border: '2px solid var(--success)' }}>
                <div className="text-2xl font-bold" style={{ color: 'var(--success)' }}>
                  {formatNumber(metrics?.trueNegatives ?? 0)}
                </div>
                <div className="text-xs mt-1" style={{ color: 'var(--success)' }}>True Negatives</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Radar */}
        <Card>
          <CardHeader><CardTitle>Signal Precision vs Recall</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="var(--border)" />
                <PolarAngleAxis dataKey="signal" tick={{ fill: 'var(--fg-subtle)', fontSize: 10 }} />
                <Radar name="Precision" dataKey="Precision" stroke="var(--accent)"    fill="var(--accent)"    fillOpacity={0.25} />
                <Radar name="Recall"    dataKey="Recall"    stroke="var(--risk-high)"  fill="var(--risk-high)" fillOpacity={0.15} />
                <Tooltip content={<ChartTooltip />} />
              </RadarChart>
            </ResponsiveContainer>
            <div className="flex items-center justify-center gap-6 mt-2">
              {[{ color: 'var(--accent)', label: 'Precision' }, { color: 'var(--risk-high)', label: 'Recall' }].map((l) => (
                <div key={l.label} className="flex items-center gap-2 text-xs" style={{ color: 'var(--fg-muted)' }}>
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: l.color }} />{l.label}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Signal performance bar */}
      <Card>
        <CardHeader><CardTitle>False Positives by Signal</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={barData} margin={{ left: -20, right: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: 'var(--fg-subtle)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--fg-subtle)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="FPs" name="False Positives" fill="var(--risk-high)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Signal performance table */}
      <Card>
        <CardHeader><CardTitle>Signal Performance Breakdown</CardTitle></CardHeader>
        <CardContent className="px-0 py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Signal</TableHead>
                <TableHead>Precision</TableHead>
                <TableHead>Recall</TableHead>
                <TableHead>False Positives</TableHead>
                <TableHead>Contribution</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {signals?.map((s, idx) => (
                <TableRow key={idx}>
                  <TableCell className="pl-6 font-medium" style={{ color: 'var(--fg)' }}>{s.signalType}</TableCell>
                  <TableCell>
                    <span style={{ color: s.precision >= 0.8 ? 'var(--success)' : s.precision >= 0.65 ? 'var(--warning)' : 'var(--danger)' }}
                      className="font-semibold">
                      {formatPercent(s.precision)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span style={{ color: s.recall >= 0.8 ? 'var(--success)' : s.recall >= 0.65 ? 'var(--warning)' : 'var(--danger)' }}
                      className="font-semibold">
                      {formatPercent(s.recall)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span style={{ color: s.falsePositives > 20 ? 'var(--risk-high)' : 'var(--fg-muted)' }}>
                      {s.falsePositives}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 rounded-full" style={{
                        width: `${s.contribution * 2.5}px`,
                        background: 'var(--accent)',
                      }} />
                      <span className="font-semibold" style={{ color: 'var(--fg)' }}>{s.contribution}%</span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* False positive examples */}
      <Card>
        <CardHeader><CardTitle>False Positive Examples</CardTitle></CardHeader>
        <CardContent className="px-0 py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Customer ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Predicted</TableHead>
                <TableHead>Actual</TableHead>
                <TableHead>Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fps?.map((fp) => (
                <TableRow key={fp.id}>
                  <TableCell className="pl-6 font-mono text-xs">{fp.customerId}</TableCell>
                  <TableCell style={{ color: 'var(--fg)' }}>{fp.customerName}</TableCell>
                  <TableCell>
                    <span className="font-bold" style={{ color: 'var(--risk-high)' }}>{fp.riskScore}</span>
                  </TableCell>
                  <TableCell><Badge variant="risk" riskLevel={fp.predictedRisk}>{fp.predictedRisk}</Badge></TableCell>
                  <TableCell>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-md"
                      style={{ background: 'var(--success-bg)', color: 'var(--success)' }}>
                      LEGITIMATE
                    </span>
                  </TableCell>
                  <TableCell className="text-sm max-w-xs" style={{ color: 'var(--fg-muted)' }}>{fp.reason}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ── Model Monitoring ──────────────────────────────────────────── */}
      <div>
        <h2 className="text-lg font-bold mb-1" style={{ color: 'var(--fg)' }}>Model Monitoring</h2>
        <p className="text-sm mb-4" style={{ color: 'var(--fg-muted)' }}>
          Live prediction distribution and drift indicators from the ML service.
        </p>
      </div>

      {/* Monitoring disclaimer */}
      {monitoring?.disclaimer && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl text-xs"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--fg-subtle)' }}>
          <Activity className="h-4 w-4 mt-0.5 shrink-0" style={{ color: 'var(--fg-subtle)' }} />
          <span>{monitoring.disclaimer}</span>
        </div>
      )}

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        {/* Overall status */}
        {[
          {
            label: 'Model Health',
            value: monitoring?.overallStatus ?? '—',
            color: monitoring?.overallStatus === 'HEALTHY' ? 'var(--success)'
                 : monitoring?.overallStatus === 'DEGRADED' ? 'var(--warning)'
                 : monitoring?.overallStatus === 'CRITICAL' ? 'var(--risk-critical)'
                 : 'var(--fg-subtle)',
            icon: monitoring?.overallStatus === 'HEALTHY' ? CheckCircle : monitoring?.overallStatus === 'UNAVAILABLE' ? XCircle : AlertTriangle,
          },
          {
            label: 'Prediction Drift',
            value: monitoring?.predictionDriftLevel ?? 'UNKNOWN',
            color: monitoring?.predictionDriftLevel === 'LOW' ? 'var(--success)'
                 : monitoring?.predictionDriftLevel === 'MEDIUM' ? 'var(--warning)'
                 : monitoring?.predictionDriftLevel === 'HIGH' ? 'var(--risk-critical)'
                 : 'var(--fg-subtle)',
            icon: Activity,
          },
          {
            label: 'Data Quality',
            value: monitoring?.dataQuality ?? 'UNKNOWN',
            color: monitoring?.dataQuality === 'GOOD' ? 'var(--success)'
                 : monitoring?.dataQuality === 'DEGRADED' ? 'var(--warning)'
                 : monitoring?.dataQuality === 'POOR' ? 'var(--risk-critical)'
                 : 'var(--fg-subtle)',
            icon: BarChart3,
          },
          {
            label: 'Recent Predictions',
            value: monitoring !== undefined ? formatNumber(monitoring.nRecentPredictions) : '—',
            color: 'var(--fg)',
            icon: Target,
          },
        ].map(({ label, value, color, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="pt-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs uppercase tracking-wider mb-2"
                    style={{ color: 'var(--fg-subtle)' }}>{label}</div>
                  <div className="text-xl font-bold" style={{ color }}>{value}</div>
                </div>
                <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: 'var(--surface-2)' }}>
                  <Icon className="h-4 w-4" style={{ color }} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Prediction distribution stats */}
      {monitoring && monitoring.nRecentPredictions > 0 && (
        <Card>
          <CardHeader><CardTitle>Prediction Distribution (Recent)</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              {[
                { label: 'Mean Fraud Probability', val: monitoring.predMean !== null ? formatPercent(monitoring.predMean) : '—' },
                { label: 'Std Dev',                val: monitoring.predStd  !== null ? monitoring.predStd.toFixed(4) : '—' },
                { label: 'High-Risk Fraction',     val: monitoring.highRiskFraction !== null ? formatPercent(monitoring.highRiskFraction) : '—' },
              ].map(({ label, val }) => (
                <div key={label} className="rounded-xl p-4" style={{ background: 'var(--surface-2)' }}>
                  <div className="text-xs uppercase tracking-wider mb-1"
                    style={{ color: 'var(--fg-subtle)' }}>{label}</div>
                  <div className="text-2xl font-bold" style={{ color: 'var(--fg)' }}>{val}</div>
                </div>
              ))}
            </div>
            <p className="text-xs mt-3 px-3 py-2 rounded-lg"
              style={{ background: 'var(--warning-bg)', color: 'var(--warning)' }}>
              [MODEL ESTIMATE] Distribution tracked in-memory since last service restart.
              These are not calibrated production statistics.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Service status */}
      <Card>
        <CardHeader><CardTitle>ML Service Status</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              { label: 'ML Service Enabled',   val: monitoring?.mlServiceEnabled   ? 'Yes' : 'No',
                color: monitoring?.mlServiceEnabled   ? 'var(--success)' : 'var(--fg-subtle)' },
              { label: 'ML Service Reachable',  val: monitoring?.mlServiceReachable ? 'Yes' : 'No',
                color: monitoring?.mlServiceReachable ? 'var(--success)' : 'var(--risk-high)' },
              { label: 'Model Version',         val: monitoring?.modelVersion  ?? '—', color: 'var(--fg)' },
              { label: 'Feature Version',       val: monitoring?.featureVersion ?? '—', color: 'var(--fg)' },
            ].map(({ label, val, color }) => (
              <div key={label} className="flex items-center justify-between px-3 py-2 rounded-lg"
                style={{ background: 'var(--surface-2)' }}>
                <span style={{ color: 'var(--fg-subtle)' }}>{label}</span>
                <span className="font-semibold" style={{ color }}>{val}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
