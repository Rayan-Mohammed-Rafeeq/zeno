import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { datasetApi } from '@/services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { formatNumber, formatDateTime } from '@/lib/utils';
import {
  Database, Play, CheckCircle, Loader2, AlertCircle, RefreshCw,
} from 'lucide-react';

const RECORD_OPTIONS = [50, 100, 500, 1000, 2500];

const STEP_ICONS: Record<string, React.ComponentType<any>> = {
  'Dataset generated':       Database,
  'Risk signals calculated': AlertCircle,
  'Relationships analyzed':  RefreshCw,
  'Clusters detected':       CheckCircle,
  'Evaluation completed':    CheckCircle,
};

export function Dataset() {
  const [recordCount, setRecordCount] = useState(1000);
  const queryClient = useQueryClient();

  const { data: current } = useQuery({
    queryKey: ['dataset-current'],
    queryFn:  () => datasetApi.getCurrentRun(),
  });

  const { mutate: generate, isPending } = useMutation({
    mutationFn: () => datasetApi.generateDataset(recordCount),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dataset-current'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['clusters'] });
      queryClient.invalidateQueries({ queryKey: ['evaluation-metrics'] });
    },
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--fg)' }}>Dataset</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--fg-muted)' }}>
            Generate synthetic test data and run the full analysis pipeline.
          </p>
        </div>
        <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: 'var(--accent-muted)' }}>
          <Database className="h-4 w-4" style={{ color: 'var(--accent)' }} />
        </div>
      </div>

      {/* Synthetic data warning */}
      <div className="flex items-start gap-3 px-4 py-3 rounded-xl text-sm"
        style={{ background: 'var(--warning-bg)', border: '1px solid var(--warning)', color: 'var(--warning)' }}>
        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
        <span>
          <strong>SYNTHETIC TEST DATA —</strong> All records generated here are
          artificial and do not represent real transactions or customers.
        </span>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Generate panel */}
        <Card>
          <CardHeader><CardTitle>Generate Synthetic Dataset</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-3" style={{ color: 'var(--fg)' }}>
                Record count
              </label>
              <div className="flex flex-wrap gap-2">
                {RECORD_OPTIONS.map((n) => (
                  <button
                    key={n}
                    onClick={() => setRecordCount(n)}
                    className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
                    style={recordCount === n
                      ? { background: 'var(--accent)', color: 'var(--accent-fg)' }
                      : { background: 'var(--surface-2)', color: 'var(--fg-muted)',
                          border: '1px solid var(--border)' }
                    }
                  >
                    {formatNumber(n)}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl p-4 space-y-2"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              <div className="flex justify-between text-sm">
                <span style={{ color: 'var(--fg-muted)' }}>Records</span>
                <span className="font-semibold" style={{ color: 'var(--fg)' }}>{formatNumber(recordCount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span style={{ color: 'var(--fg-muted)' }}>Est. fraud cases (~15%)</span>
                <span className="font-semibold" style={{ color: 'var(--risk-high)' }}>
                  ~{formatNumber(Math.floor(recordCount * 0.15))}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span style={{ color: 'var(--fg-muted)' }}>Est. legitimate (~85%)</span>
                <span className="font-semibold" style={{ color: 'var(--success)' }}>
                  ~{formatNumber(Math.floor(recordCount * 0.85))}
                </span>
              </div>
            </div>

            <button
              onClick={() => generate()}
              disabled={isPending}
              className="w-full h-11 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-60"
              style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Running pipeline…
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Generate &amp; Analyse
                </>
              )}
            </button>
          </CardContent>
        </Card>

        {/* Pipeline status */}
        <Card>
          <CardHeader><CardTitle>Pipeline Status</CardTitle></CardHeader>
          <CardContent>
            {!current ? (
              <div className="flex flex-col items-center justify-center h-40 gap-2">
                <Database className="h-10 w-10" style={{ color: 'var(--fg-subtle)' }} />
                <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>No dataset runs yet</p>
                <p className="text-xs" style={{ color: 'var(--fg-subtle)' }}>
                  Generate a dataset to see pipeline status.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Run header */}
                <div className="flex items-center justify-between mb-4 text-xs"
                  style={{ color: 'var(--fg-subtle)' }}>
                  <span>
                    {formatNumber(current.recordCount)} records ·{' '}
                    {current.startedAt && formatDateTime(current.startedAt)}
                  </span>
                  <span className="px-2 py-0.5 rounded font-semibold"
                    style={{
                      background: current.status === 'COMPLETED' ? 'var(--success-bg)'
                        : current.status === 'FAILED' ? 'var(--danger-bg)'
                        : 'var(--warning-bg)',
                      color: current.status === 'COMPLETED' ? 'var(--success)'
                        : current.status === 'FAILED' ? 'var(--danger)'
                        : 'var(--warning)',
                    }}>
                    {current.status}
                  </span>
                </div>

                {/* Steps */}
                {current.steps.map((step, idx) => {
                  const StepIcon = STEP_ICONS[step.name] ?? CheckCircle;
                  const isDone = step.status === 'COMPLETED';
                  const isFail = step.status === 'FAILED';
                  const isRun  = step.status === 'IN_PROGRESS';

                  return (
                    <div key={idx} className="flex items-center gap-3">
                      {/* Connector line */}
                      <div className="flex flex-col items-center">
                        <div
                          className="h-8 w-8 rounded-full flex items-center justify-center shrink-0"
                          style={{
                            background: isDone ? 'var(--success-bg)'
                              : isFail ? 'var(--danger-bg)'
                              : isRun  ? 'var(--warning-bg)'
                              : 'var(--surface-2)',
                            border: `1.5px solid ${
                              isDone ? 'var(--success)'
                              : isFail ? 'var(--danger)'
                              : isRun  ? 'var(--warning)'
                              : 'var(--border)'
                            }`,
                          }}
                        >
                          {isRun ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: 'var(--warning)' }} />
                          ) : (
                            <StepIcon className="h-3.5 w-3.5" style={{
                              color: isDone ? 'var(--success)'
                                : isFail ? 'var(--danger)'
                                : 'var(--fg-subtle)',
                            }} />
                          )}
                        </div>
                        {idx < current.steps.length - 1 && (
                          <div className="w-px h-4 mt-0.5"
                            style={{ background: isDone ? 'var(--success)' : 'var(--border)' }} />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium" style={{
                          color: isDone ? 'var(--fg)' : 'var(--fg-muted)',
                        }}>
                          {step.name}
                        </div>
                        {step.completedAt && (
                          <div className="text-xs" style={{ color: 'var(--fg-subtle)' }}>
                            {formatDateTime(step.completedAt)}
                          </div>
                        )}
                      </div>
                      {isDone && <CheckCircle className="h-4 w-4 shrink-0" style={{ color: 'var(--success)' }} />}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Current dataset info */}
      {current && (
        <Card>
          <CardHeader><CardTitle>Current Dataset</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Total Records',  val: formatNumber(current.recordCount) },
                { label: 'Est. Fraud',     val: `~${formatNumber(Math.floor(current.recordCount * 0.15))}` },
                { label: 'Est. Legit',     val: `~${formatNumber(Math.floor(current.recordCount * 0.85))}` },
                { label: 'Ground Truth',   val: current.status === 'COMPLETED' ? '✓ Available' : 'Pending' },
              ].map((s) => (
                <div key={s.label} className="rounded-xl p-4"
                  style={{ background: 'var(--surface-2)' }}>
                  <div className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--fg-subtle)' }}>
                    {s.label}
                  </div>
                  <div className="text-xl font-bold" style={{ color: 'var(--fg)' }}>{s.val}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
