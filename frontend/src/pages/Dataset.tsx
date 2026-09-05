import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { datasetApi, riskApi } from '@/services/api';
import type { DatasetRun } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { formatNumber, formatDateTime } from '@/lib/utils';
import {
  Database, Play, CheckCircle, Loader2, AlertCircle, RefreshCw, XCircle,
} from 'lucide-react';

const RECORD_OPTIONS = [50, 100, 500, 1000, 2500];

// The five stages of the full pipeline — used to render progress
const PIPELINE_STEPS: { name: string; icon: React.ComponentType<any> }[] = [
  { name: 'Synthetic data generated',  icon: Database    },
  { name: 'Risk signals calculated',   icon: AlertCircle },
  { name: 'Relationships analysed',    icon: RefreshCw   },
  { name: 'Clusters detected',         icon: CheckCircle },
  { name: 'Pipeline complete',         icon: CheckCircle },
];

// ─── Pipeline status card ────────────────────────────────────────────────────

function PipelineSteps({ run, analysisRunning }: { run: DatasetRun; analysisRunning: boolean }) {
  const timestamp = run.startedAt ?? run.createdAt;

  // Map the coarse run status to per-step display states
  const steps = PIPELINE_STEPS.map((s, i) => {
    let status: 'COMPLETED' | 'IN_PROGRESS' | 'PENDING' | 'FAILED';
    if (run.status === 'FAILED') {
      status = i === 0 ? 'FAILED' : 'PENDING';
    } else if (run.status === 'COMPLETED' && !analysisRunning) {
      status = 'COMPLETED';
    } else if (run.status === 'COMPLETED' && analysisRunning) {
      // Data is done, analysis running
      status = i === 0 ? 'COMPLETED' : i === 1 ? 'IN_PROGRESS' : 'PENDING';
    } else {
      // Still generating
      status = i === 0 ? 'IN_PROGRESS' : 'PENDING';
    }
    return { ...s, status, completedAt: run.generatedAt };
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-4 text-xs" style={{ color: 'var(--fg-subtle)' }}>
        <span>
          {formatNumber(run.recordCount)} records
          {timestamp && ` · ${formatDateTime(timestamp)}`}
        </span>
        <span className="px-2 py-0.5 rounded font-semibold"
          style={{
            background: run.status === 'COMPLETED' && !analysisRunning ? 'var(--success-bg)'
              : run.status === 'FAILED' ? 'var(--danger-bg)'
              : 'var(--warning-bg)',
            color: run.status === 'COMPLETED' && !analysisRunning ? 'var(--success)'
              : run.status === 'FAILED' ? 'var(--danger)'
              : 'var(--warning)',
          }}>
          {run.status === 'COMPLETED' && !analysisRunning ? 'COMPLETED'
            : run.status === 'FAILED' ? 'FAILED'
            : 'RUNNING…'}
        </span>
      </div>

      {steps.map((step, idx) => {
        const StepIcon = step.icon;
        const isDone = step.status === 'COMPLETED';
        const isFail = step.status === 'FAILED';
        const isRun  = step.status === 'IN_PROGRESS';

        return (
          <div key={idx} className="flex items-center gap-3">
            <div className="flex flex-col items-center">
              <div className="h-8 w-8 rounded-full flex items-center justify-center shrink-0"
                style={{
                  background: isDone ? 'var(--success-bg)' : isFail ? 'var(--danger-bg)'
                    : isRun ? 'var(--warning-bg)' : 'var(--surface-2)',
                  border: `1.5px solid ${isDone ? 'var(--success)' : isFail ? 'var(--danger)'
                    : isRun ? 'var(--warning)' : 'var(--border)'}`,
                }}>
                {isRun ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: 'var(--warning)' }} />
                ) : isFail ? (
                  <XCircle className="h-3.5 w-3.5" style={{ color: 'var(--danger)' }} />
                ) : (
                  <StepIcon className="h-3.5 w-3.5"
                    style={{ color: isDone ? 'var(--success)' : 'var(--fg-subtle)' }} />
                )}
              </div>
              {idx < steps.length - 1 && (
                <div className="w-px h-4 mt-0.5"
                  style={{ background: isDone ? 'var(--success)' : 'var(--border)' }} />
              )}
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium"
                style={{ color: isDone ? 'var(--fg)' : 'var(--fg-muted)' }}>
                {step.name}
              </div>
              {isDone && step.completedAt && (
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
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export function Dataset() {
  const [recordCount, setRecordCount] = useState(1000);
  const queryClient = useQueryClient();

  // ── Current dataset run ────────────────────────────────────────────────────
  const { data: current } = useQuery({
    queryKey: ['dataset-current'],
    queryFn:  () => datasetApi.getCurrentRun(),
  });

  // ── Full pipeline: generate → risk analysis → cluster detection ───────────
  const {
    mutate: generate,
    isPending: isGenerating,
  } = useMutation({
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

  // ── Analysis-only pipeline (for existing datasets with no risk data) ───────
  const {
    mutate: runAnalysis,
    isPending: isAnalysing,
  } = useMutation({
    mutationFn: async () => {
      await riskApi.analyzeAll();
      await riskApi.detectClusters();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['clusters'] });
    },
  });

  // ── Auto-trigger analysis on existing datasets that have no risk data ───────
  // Checks sessionStorage so it only fires once per session per dataset ID.
  // This covers datasets generated before the pipeline was wired up automatically.
  useEffect(() => {
    if (
      current?.status === 'COMPLETED' &&
      !isAnalysing &&
      !isGenerating
    ) {
      const key = `analysis-triggered-${current.id}`;
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, '1');
        runAnalysis();
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, current?.status]);

  const isPipeline = isGenerating || isAnalysing;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Database}
        title="Dataset"
        subtitle="Generate synthetic test data and run the full analysis pipeline automatically."
      />

      {/* Synthetic data warning */}
      <div className="flex items-start gap-3 px-4 py-3 rounded-xl text-sm"
        style={{ background: 'var(--warning-bg)', border: '1px solid var(--warning)', color: 'var(--warning)' }}>
        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
        <span>
          <strong>SYNTHETIC TEST DATA —</strong> All records generated here are artificial and
          do not represent real transactions or customers. Risk analysis and cluster detection
          run automatically after generation.
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
                    disabled={isPipeline}
                    className="px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    style={recordCount === n
                      ? { background: 'var(--accent)', color: 'var(--accent-fg)' }
                      : { background: 'var(--surface-2)', color: 'var(--fg-muted)', border: '1px solid var(--border)' }
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
              disabled={isPipeline}
              className="w-full h-11 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-60"
              style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}
            >
              {isGenerating ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Generating data…</>
              ) : isAnalysing ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Running risk analysis…</>
              ) : (
                <><Play className="h-4 w-4" />Generate &amp; Analyse</>
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
                  Click "Generate &amp; Analyse" to run the full pipeline.
                </p>
              </div>
            ) : (
              <PipelineSteps run={current} analysisRunning={isAnalysing} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Current dataset stats */}
      {current && (
        <Card>
          <CardHeader><CardTitle>Current Dataset</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Total Records', val: formatNumber(current.recordCount) },
                { label: 'Est. Fraud',    val: `~${formatNumber(Math.floor(current.recordCount * 0.15))}` },
                { label: 'Est. Legit',    val: `~${formatNumber(Math.floor(current.recordCount * 0.85))}` },
                { label: 'Ground Truth',  val: current.status === 'COMPLETED' ? '✓ Available' : 'Pending' },
              ].map((s) => (
                <div key={s.label} className="rounded-xl p-4" style={{ background: 'var(--surface-2)' }}>
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
