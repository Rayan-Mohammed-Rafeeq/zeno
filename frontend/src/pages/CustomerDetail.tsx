import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customerApi, intelligenceApi } from '@/services/api';
import type { CustomerRiskDetail, ShapContribution } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { PaginationBar } from '@/components/ui/Pagination';
import { formatNumber, formatCurrency, formatRelativeTime } from '@/lib/utils';
import {
  ArrowLeft, AlertTriangle, ShieldAlert, Activity, CreditCard,
  Smartphone, Globe, Receipt, Brain, CheckCircle, XCircle,
  Network, Loader2, ChevronDown, ChevronUp, ClipboardCheck,
} from 'lucide-react';

/* ── helpers ─────────────────────────────────────────────────────────── */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="h-px flex-1" style={{ background: 'var(--border)' }} />
      <span className="text-xs font-semibold uppercase tracking-widest px-2"
        style={{ color: 'var(--fg-subtle)' }}>
        {children}
      </span>
      <div className="h-px flex-1" style={{ background: 'var(--border)' }} />
    </div>
  );
}

function assessmentColor(level: string | undefined) {
  switch (level?.toUpperCase()) {
    case 'HIGH_RISK':   return 'var(--risk-critical)';
    case 'MEDIUM_RISK': return 'var(--risk-high)';
    case 'LOW_RISK':    return 'var(--success)';
    default:            return 'var(--fg-subtle)';
  }
}

function actionBadgeStyle(action: string | undefined) {
  switch (action) {
    case 'MANUAL_REVIEW':             return { background: 'var(--warning-bg)', color: 'var(--warning)' };
    case 'HOLD_FOR_REVIEW':           return { background: 'var(--risk-high-bg)', color: 'var(--risk-high)' };
    case 'PREPARE_CHARGEBACK_EVIDENCE': return { background: 'var(--risk-critical-bg)', color: 'var(--risk-critical)' };
    case 'MONITOR':                   return { background: 'var(--accent-muted)', color: 'var(--accent)' };
    default:                          return { background: 'var(--surface-2)', color: 'var(--fg-muted)' };
  }
}

/* ── SHAP bar ─────────────────────────────────────────────────────────── */
function ShapBar({ contrib }: { contrib: ShapContribution }) {
  const abs = Math.abs(contrib.shapValue);
  const maxBar = 80; // px
  const width = Math.min(maxBar, Math.round(abs * 200));
  const isPositive = contrib.direction === 'POSITIVE';
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="w-5 text-xs font-mono text-right" style={{ color: 'var(--fg-subtle)' }}>
        {contrib.rank}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium truncate" style={{ color: 'var(--fg)' }}>
          {contrib.feature.replace(/_/g, ' ')}
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="rounded-sm h-3" style={{
          width: `${width}px`,
          background: isPositive ? 'var(--risk-high)' : 'var(--success)',
          minWidth: '2px',
        }} />
        <span className="text-xs font-mono w-14 text-right" style={{
          color: isPositive ? 'var(--risk-high)' : 'var(--success)',
        }}>
          {isPositive ? '+' : ''}{contrib.shapValue.toFixed(3)}
        </span>
      </div>
    </div>
  );
}

/* ── AI Assessment panel ─────────────────────────────────────────────── */
function AiPanel({
  customerId, clusterSize, riskDetail, onRefresh,
}: {
  customerId: string;
  clusterSize: number;
  riskDetail: CustomerRiskDetail;
  onRefresh: () => void;
}) {
  const [showChargeback, setShowChargeback] = useState(false);
  const [analystDecision, setAnalystDecision] = useState('');
  const [analystReason, setAnalystReason] = useState('');
  const [decisionSaved, setDecisionSaved] = useState(false);
  const queryClient = useQueryClient();

  const { mutate: generateAssessment, isPending, error: assessError } = useMutation({
    mutationFn: () => intelligenceApi.assessCustomer(customerId, clusterSize),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-risk', customerId] });
      onRefresh();
    },
  });

  const { mutate: generateChargeback, isPending: chargebackPending, data: chargebackData } = useMutation({
    mutationFn: () => intelligenceApi.chargebackEvidence(customerId),
  });

  const { mutate: saveDecision, isPending: savingDecision } = useMutation({
    mutationFn: () => intelligenceApi.recordDecision(customerId, analystDecision, analystReason),
    onSuccess: () => setDecisionSaved(true),
  });

  const ai = riskDetail.aiAssessment;
  const sr = ai?.structuredResult;

  return (
    <div className="space-y-4">
      {/* AI Assessment card */}
      <Card style={{ border: sr ? '1px solid var(--accent)' : '1px solid var(--border)' }}>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5" style={{ color: 'var(--accent)' }} />
              <CardTitle>AI Risk Assessment</CardTitle>
              {sr && (
                <span className="text-xs px-2 py-0.5 rounded font-semibold"
                  style={{
                    background: sr.aiGenerated ? 'var(--accent-muted)' : 'var(--surface-2)',
                    color: sr.aiGenerated ? 'var(--accent)' : 'var(--fg-subtle)',
                  }}>
                  {sr.aiGenerated ? 'AI-GENERATED' : 'DETERMINISTIC FALLBACK'}
                </span>
              )}
            </div>
            <button
              onClick={() => generateAssessment()}
              disabled={isPending}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold transition-opacity disabled:opacity-60"
              style={{ background: 'var(--accent)', color: '#fff' }}>
              {isPending
                ? <><Loader2 className="h-4 w-4 animate-spin" />Generating…</>
                : <><Brain className="h-4 w-4" />{ai ? 'Regenerate' : 'Generate Assessment'}</>}
            </button>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* Error state */}
          {assessError && (
            <div className="flex items-start gap-3 px-4 py-3 rounded-xl"
              style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger)' }}>
              <XCircle className="h-4 w-4 mt-0.5 shrink-0" style={{ color: 'var(--danger)' }} />
              <div>
                <div className="text-sm font-semibold" style={{ color: 'var(--danger)' }}>AI Assessment Failed</div>
                <p className="text-xs mt-0.5" style={{ color: 'var(--danger)' }}>
                  The AI provider was unavailable. The deterministic rule-based assessment is still shown below.
                  Underlying risk signals are unaffected.
                </p>
              </div>
            </div>
          )}

          {/* Not yet generated */}
          {!ai && !isPending && (
            <div className="flex flex-col items-center justify-center py-8 gap-3"
              style={{ color: 'var(--fg-subtle)' }}>
              <Brain className="h-10 w-10 opacity-30" />
              <p className="text-sm text-center max-w-sm">
                No AI assessment generated yet. Click <strong>Generate Assessment</strong> to have the AI
                synthesize evidence from risk signals, ML predictions, SHAP values, and graph data.
              </p>
            </div>
          )}

          {isPending && (
            <div className="flex flex-col items-center justify-center py-8 gap-3"
              style={{ color: 'var(--fg-subtle)' }}>
              <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--accent)' }} />
              <p className="text-sm">Sending evidence bundle to AI…</p>
              <p className="text-xs">Risk signals · ML probability · SHAP values · Graph evidence</p>
            </div>
          )}

          {/* Structured result */}
          {sr && !isPending && (
            <>
              {/* Assessment + Confidence */}
              <div className="grid sm:grid-cols-3 gap-3">
                <div className="rounded-xl p-4 text-center"
                  style={{ background: 'var(--surface-2)', border: `1px solid ${assessmentColor(sr.assessment)}` }}>
                  <div className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--fg-subtle)' }}>Assessment</div>
                  <div className="text-xl font-bold" style={{ color: assessmentColor(sr.assessment) }}>
                    {sr.assessment?.replace(/_/g, ' ')}
                  </div>
                </div>
                <div className="rounded-xl p-4 text-center" style={{ background: 'var(--surface-2)' }}>
                  <div className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--fg-subtle)' }}>Confidence</div>
                  <div className="text-xl font-bold" style={{ color: 'var(--fg)' }}>{sr.confidence}%</div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--fg-subtle)' }}>Model estimate</div>
                </div>
                <div className="rounded-xl p-4 text-center" style={{ background: 'var(--surface-2)' }}>
                  <div className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--fg-subtle)' }}>Recommended Action</div>
                  <span className="text-sm font-semibold px-2 py-1 rounded-lg"
                    style={actionBadgeStyle(sr.recommendedAction)}>
                    {sr.recommendedAction?.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>

              {/* Summary */}
              {sr.summary && (
                <div className="rounded-xl p-4" style={{ background: 'var(--accent-muted)', border: '1px solid var(--border)' }}>
                  <p className="text-sm" style={{ color: 'var(--fg)' }}>{sr.summary}</p>
                </div>
              )}

              {/* Evidence-grounded reasons */}
              {sr.reasons?.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--fg)' }}>Evidence Breakdown</h4>
                  <div className="space-y-2">
                    {sr.reasons.map((r, i) => (
                      <div key={i} className="rounded-xl p-3"
                        style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: 'var(--accent)' }} />
                          <span className="text-sm font-semibold" style={{ color: 'var(--fg)' }}>{r.signal}</span>
                        </div>
                        <div className="grid sm:grid-cols-2 gap-2 mb-2">
                          <div className="rounded-lg px-3 py-1.5" style={{ background: 'var(--surface)' }}>
                            <div className="text-xs" style={{ color: 'var(--fg-subtle)' }}>Observed</div>
                            <div className="text-sm font-semibold" style={{ color: 'var(--risk-high)' }}>{r.observed}</div>
                          </div>
                          <div className="rounded-lg px-3 py-1.5" style={{ background: 'var(--surface)' }}>
                            <div className="text-xs" style={{ color: 'var(--fg-subtle)' }}>Baseline</div>
                            <div className="text-sm font-semibold" style={{ color: 'var(--fg-muted)' }}>{r.baseline}</div>
                          </div>
                        </div>
                        <p className="text-xs" style={{ color: 'var(--fg-muted)' }}>{r.interpretation}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ML evidence */}
              {sr.mlEvidence && (
                <div>
                  <h4 className="text-sm font-semibold mb-2" style={{ color: 'var(--fg)' }}>
                    Model Evidence
                    <span className="ml-2 text-xs font-normal" style={{ color: 'var(--fg-subtle)' }}>
                      [MODEL ESTIMATE — not ground truth]
                    </span>
                  </h4>
                  <div className="rounded-xl p-3 space-y-2"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                    {sr.mlEvidence.fraudProbability != null && (
                      <div className="flex items-center justify-between text-sm">
                        <span style={{ color: 'var(--fg-muted)' }}>XGBoost Fraud Probability</span>
                        <span className="font-bold" style={{ color: 'var(--risk-high)' }}>
                          {(sr.mlEvidence.fraudProbability * 100).toFixed(1)}%
                        </span>
                      </div>
                    )}
                    {sr.mlEvidence.topShapDrivers?.length > 0 && (
                      <div>
                        <div className="text-xs mb-1" style={{ color: 'var(--fg-subtle)' }}>Top SHAP Drivers</div>
                        {sr.mlEvidence.topShapDrivers.map((d, i) => (
                          <div key={i} className="text-xs font-mono py-0.5" style={{ color: 'var(--fg-muted)' }}>
                            • {d}
                          </div>
                        ))}
                      </div>
                    )}
                    {sr.mlEvidence.disclaimer && (
                      <p className="text-xs" style={{ color: 'var(--fg-subtle)' }}>{sr.mlEvidence.disclaimer}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Network evidence */}
              {sr.networkEvidence && (
                <div>
                  <h4 className="text-sm font-semibold mb-2" style={{ color: 'var(--fg)' }}>Network Evidence</h4>
                  <div className="rounded-xl p-3 flex items-start gap-3"
                    style={{
                      background: sr.networkEvidence.clusterDetected ? 'var(--risk-high-bg)' : 'var(--surface-2)',
                      border: `1px solid ${sr.networkEvidence.clusterDetected ? 'var(--risk-high)' : 'var(--border)'}`,
                    }}>
                    <Network className="h-4 w-4 mt-0.5 shrink-0"
                      style={{ color: sr.networkEvidence.clusterDetected ? 'var(--risk-high)' : 'var(--fg-subtle)' }} />
                    <div className="text-sm space-y-1">
                      <div className="font-semibold" style={{ color: 'var(--fg)' }}>
                        {sr.networkEvidence.clusterDetected
                          ? `Cluster detected — ${sr.networkEvidence.clusterSize} entities`
                          : 'No cluster detected'}
                      </div>
                      {sr.networkEvidence.relationshipSummary && (
                        <p style={{ color: 'var(--fg-muted)' }}>{sr.networkEvidence.relationshipSummary}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Analyst note */}
              {sr.analystNote && (
                <div className="rounded-xl p-3 flex items-start gap-2"
                  style={{ background: 'var(--accent-muted)', border: '1px solid var(--accent)' }}>
                  <ClipboardCheck className="h-4 w-4 mt-0.5 shrink-0" style={{ color: 'var(--accent)' }} />
                  <p className="text-sm" style={{ color: 'var(--fg)' }}>{sr.analystNote}</p>
                </div>
              )}

              {/* Limitations */}
              {sr.limitations?.length > 0 && (
                <div className="rounded-xl p-3 flex items-start gap-3"
                  style={{ background: 'var(--warning-bg)', border: '1px solid var(--warning)' }}>
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" style={{ color: 'var(--warning)' }} />
                  <div>
                    <div className="text-xs font-bold mb-1" style={{ color: 'var(--warning)' }}>
                      AI ASSESSMENT LIMITATIONS
                    </div>
                    {sr.limitations.map((l, i) => (
                      <p key={i} className="text-xs" style={{ color: 'var(--warning)' }}>• {l}</p>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Provider / timestamp */}
          {ai && (
            <div className="text-xs flex items-center gap-3 pt-1" style={{ color: 'var(--fg-subtle)' }}>
              <span>Provider: <strong>{ai.provider}</strong></span>
              <span>Generated: {formatRelativeTime(ai.createdAt)}</span>
              <span className="ml-auto" style={{ color: 'var(--fg-subtle)' }}>{ai.disclaimer}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Analyst Decision ──────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5" style={{ color: 'var(--accent)' }} />
            <CardTitle>Analyst Decision</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>
            Record your final decision after reviewing all evidence. This is persisted to the audit trail.
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium uppercase tracking-wide block mb-1"
                style={{ color: 'var(--fg-subtle)' }}>Decision</label>
              <select
                value={analystDecision}
                onChange={e => setAnalystDecision(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm border"
                style={{
                  background: 'var(--surface-2)',
                  color: 'var(--fg)',
                  borderColor: 'var(--border)',
                }}>
                <option value="">Select decision…</option>
                <option value="MANUAL_REVIEW">MANUAL REVIEW</option>
                <option value="MONITOR">MONITOR</option>
                <option value="HOLD">HOLD FOR REVIEW</option>
                <option value="ESCALATE">ESCALATE</option>
                <option value="ALLOW">ALLOW (No Action)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium uppercase tracking-wide block mb-1"
                style={{ color: 'var(--fg-subtle)' }}>Reason / Notes</label>
              <input
                type="text"
                value={analystReason}
                onChange={e => setAnalystReason(e.target.value)}
                placeholder="Brief rationale for this decision…"
                className="w-full rounded-lg px-3 py-2 text-sm border"
                style={{
                  background: 'var(--surface-2)',
                  color: 'var(--fg)',
                  borderColor: 'var(--border)',
                }} />
            </div>
          </div>
          <button
            onClick={() => saveDecision()}
            disabled={!analystDecision || savingDecision || decisionSaved}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-opacity disabled:opacity-50"
            style={{ background: decisionSaved ? 'var(--success)' : 'var(--accent)', color: '#fff' }}>
            {savingDecision
              ? <><Loader2 className="h-4 w-4 animate-spin" />Saving…</>
              : decisionSaved
              ? <><CheckCircle className="h-4 w-4" />Decision Recorded</>
              : <><ClipboardCheck className="h-4 w-4" />Record Decision</>}
          </button>
          {decisionSaved && (
            <p className="text-xs" style={{ color: 'var(--success)' }}>
              Decision persisted to audit trail. Human decision overrides AI recommendation.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Chargeback evidence ───────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Receipt className="h-5 w-5" style={{ color: 'var(--accent)' }} />
              <CardTitle>Chargeback Evidence Package</CardTitle>
            </div>
            <button
              onClick={() => { setShowChargeback(true); generateChargeback(); }}
              disabled={chargebackPending}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold transition-opacity disabled:opacity-60"
              style={{ background: 'var(--surface-2)', color: 'var(--fg)', border: '1px solid var(--border)' }}>
              {chargebackPending
                ? <><Loader2 className="h-4 w-4 animate-spin" />Preparing…</>
                : 'Prepare Evidence'}
            </button>
          </div>
        </CardHeader>
        {showChargeback && chargebackData && (
          <CardContent className="space-y-4">
            <div className="px-3 py-2 rounded-lg text-xs font-semibold"
              style={{ background: 'var(--warning-bg)', color: 'var(--warning)', border: '1px solid var(--warning)' }}>
              {chargebackData.disclaimer}
            </div>
            <p className="text-sm" style={{ color: 'var(--fg)' }}>{chargebackData.caseSummary}</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
              {[
                { label: 'Transactions', value: chargebackData.totalTransactions },
                { label: 'Refunds', value: chargebackData.totalRefunds },
                { label: 'Refund Rate', value: (chargebackData.refundRate * 100).toFixed(1) + '%' },
                { label: 'Risk Score', value: chargebackData.riskScore + '/100' },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-lg p-2 text-center"
                  style={{ background: 'var(--surface-2)' }}>
                  <div className="text-xs" style={{ color: 'var(--fg-subtle)' }}>{label}</div>
                  <div className="font-bold" style={{ color: 'var(--fg)' }}>{value}</div>
                </div>
              ))}
            </div>
            {chargebackData.topShapDrivers?.length > 0 && (
              <div>
                <div className="text-xs font-semibold mb-1" style={{ color: 'var(--fg-subtle)' }}>Top SHAP Drivers</div>
                {chargebackData.topShapDrivers.map((d, i) => (
                  <div key={i} className="text-xs font-mono" style={{ color: 'var(--fg-muted)' }}>• {d}</div>
                ))}
              </div>
            )}
            <div>
              <div className="text-xs font-semibold mb-1" style={{ color: 'var(--fg-subtle)' }}>Network</div>
              <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>{chargebackData.networkSummary}</p>
            </div>
            <div className="text-xs space-y-0.5" style={{ color: 'var(--fg-subtle)' }}>
              {chargebackData.limitations.map((l, i) => <p key={i}>• {l}</p>)}
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}

/* ── Main component ───────────────────────────────────────────────────── */
export function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const [txPage, setTxPage] = useState(1);
  const [showAllSignals, setShowAllSignals] = useState(false);
  const TX_PAGE_SIZE = 10;

  const { data: customer, isLoading } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => customerApi.getCustomer(id!),
    enabled: !!id,
  });

  const { data: riskDetail, refetch: refetchRisk } = useQuery({
    queryKey: ['customer-risk', id],
    queryFn: () => customerApi.getCustomerRiskAssessment(id!),
    enabled: !!id,
    retry: false,
  });

  const { data: txData } = useQuery({
    queryKey: ['customer-transactions', id, txPage],
    queryFn: () => customerApi.getCustomerTransactions(id!, { page: txPage, pageSize: TX_PAGE_SIZE }),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 gap-3" style={{ color: 'var(--fg-subtle)' }}>
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading customer…
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-2">
        <ShieldAlert className="h-10 w-10" style={{ color: 'var(--fg-subtle)' }} />
        <p style={{ color: 'var(--fg-muted)' }}>Customer not found</p>
        <Link to="/customers" className="text-sm hover:underline" style={{ color: 'var(--accent)' }}>
          Back to customers
        </Link>
      </div>
    );
  }

  const scoreColor =
    customer.riskScore >= 80 ? 'var(--risk-critical)'
    : customer.riskScore >= 65 ? 'var(--risk-high)'
    : customer.riskScore >= 40 ? 'var(--risk-medium)'
    : 'var(--risk-low)';

  const clusterSize = riskDetail?.signals
    ?.filter(s => s.signalType.includes('DEVICE') || s.signalType.includes('IP'))
    ?.length ?? 1;

  const visibleSignals = showAllSignals
    ? (riskDetail?.signals ?? [])
    : (riskDetail?.signals ?? []).slice(0, 3);

  return (
    <div className="space-y-6">
      {/* Back */}
      <Link to="/customers" className="inline-flex items-center gap-2 text-sm hover:underline"
        style={{ color: 'var(--accent)' }}>
        <ArrowLeft className="h-4 w-4" />Back to customers
      </Link>

      {/* ── 1. Customer identity + risk score ─────────────────────── */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="flex items-start gap-5">
              <div className="h-16 w-16 rounded-2xl flex items-center justify-center text-2xl font-bold shrink-0"
                style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}>
                {customer.name?.charAt(0) ?? '?'}
              </div>
              <div>
                <h1 className="text-2xl font-bold" style={{ color: 'var(--fg)' }}>{customer.name}</h1>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <span className="font-mono text-sm" style={{ color: 'var(--fg-subtle)' }}>
                    {customer.customerId}
                  </span>
                  <Badge variant="risk" riskLevel={customer.riskLevel}>{customer.riskLevel} RISK</Badge>
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{
                    background: customer.status === 'FLAGGED' ? 'var(--risk-critical-bg)' : 'var(--success-bg)',
                    color:      customer.status === 'FLAGGED' ? 'var(--risk-critical)' : 'var(--success)',
                  }}>
                    {customer.status}
                  </span>
                </div>
                <p className="text-sm mt-2" style={{ color: 'var(--fg-muted)' }}>
                  First seen {formatRelativeTime(customer.firstSeen)} · Last active {formatRelativeTime(customer.lastActivity)}
                </p>
              </div>
            </div>

            {/* ── 2. Risk score ──────────────────────────────────────── */}
            <div className="text-center">
              <div className="text-xs font-medium uppercase tracking-wider mb-1"
                style={{ color: 'var(--fg-subtle)' }}>Risk Score</div>
              <div className="text-5xl font-bold tabular-nums" style={{ color: scoreColor }}>
                {customer.riskScore}
              </div>
              <div className="text-xs mt-1" style={{ color: 'var(--fg-subtle)' }}>/ 100</div>
            </div>
          </div>

          {/* Stats strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-px mt-6 rounded-xl overflow-hidden border"
            style={{ borderColor: 'var(--border)', background: 'var(--border)' }}>
            {[
              { icon: Activity,   label: 'Transactions', val: formatNumber(customer.transactionCount) },
              { icon: CreditCard, label: 'Total Amount',  val: formatCurrency(customer.totalAmount) },
              { icon: Smartphone, label: 'Devices',       val: String(customer.deviceCount) },
              { icon: Globe,      label: 'IP Addresses',  val: String(customer.ipCount) },
            ].map(({ icon: Icon, label, val }) => (
              <div key={label} className="flex flex-col items-center justify-center gap-1 py-4"
                style={{ background: 'var(--surface-2)' }}>
                <Icon className="h-4 w-4 mb-0.5" style={{ color: 'var(--fg-subtle)' }} />
                <div className="text-xl font-bold" style={{ color: 'var(--fg)' }}>{val}</div>
                <div className="text-xs" style={{ color: 'var(--fg-subtle)' }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Refund alert */}
          {customer.refundRate > 10 && (
            <div className="mt-4 flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{ background: 'var(--risk-high-bg)', border: '1px solid var(--risk-high)' }}>
              <AlertTriangle className="h-4 w-4 shrink-0" style={{ color: 'var(--risk-high)' }} />
              <span className="text-sm font-medium" style={{ color: 'var(--risk-high)' }}>
                Refund rate {customer.refundRate.toFixed(1)}% — significantly above merchant baseline.
                {' '}{customer.refundCount} refunds across {customer.transactionCount} transactions.
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── 3. ML fraud probability + SHAP ───────────────────────────── */}
      {riskDetail?.fraudProbability != null && (
        <div>
          <SectionLabel>ML Model Evidence</SectionLabel>
          <Card style={{ border: '1px solid var(--accent)' }}>
            <CardContent className="pt-5 space-y-4">
              <div className="flex items-start justify-between flex-wrap gap-4">
                <div>
                  <div className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--fg-subtle)' }}>
                    XGBoost Fraud Probability
                    <span className="ml-2 font-normal normal-case" style={{ color: 'var(--fg-subtle)' }}>
                      [MODEL ESTIMATE — not ground truth]
                    </span>
                  </div>
                  <div className="text-4xl font-bold" style={{ color: 'var(--risk-high)' }}>
                    {(riskDetail.fraudProbability * 100).toFixed(1)}%
                  </div>
                  <div className="text-xs mt-1" style={{ color: 'var(--fg-subtle)' }}>
                    Model: {riskDetail.modelVersion ?? 'xgboost-v1'} · Benchmark: Precision 61.6%, Recall 48.1%, AUPRC 0.56
                  </div>
                </div>
                {riskDetail.anomalyScore != null && (
                  <div className="text-right">
                    <div className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--fg-subtle)' }}>
                      Anomaly Score
                    </div>
                    <div className="text-2xl font-bold" style={{ color: 'var(--fg)' }}>
                      {riskDetail.anomalyScore.toFixed(3)}
                    </div>
                    <div className="text-xs" style={{ color: 'var(--fg-subtle)' }}>0=normal · 1=anomalous</div>
                  </div>
                )}
              </div>

              {/* SHAP contributions */}
              {riskDetail.shapContributions && riskDetail.shapContributions.length > 0 && (
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide mb-2"
                    style={{ color: 'var(--fg-subtle)' }}>
                    SHAP Feature Contributions
                    <span className="ml-2 font-normal normal-case"
                      style={{ color: 'var(--fg-subtle)' }}>
                      red = pushes toward fraud · green = pushes away
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    {riskDetail.shapContributions.map((c, i) => (
                      <ShapBar key={i} contrib={c} />
                    ))}
                  </div>
                  <p className="text-xs mt-2" style={{ color: 'var(--fg-subtle)' }}>
                    SHAP explains the model's prediction, not ground truth.
                    High values indicate model reliance on this feature, not causality.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── 4. Risk signals ──────────────────────────────────────────── */}
      {riskDetail && riskDetail.signals.length > 0 && (
        <div>
          <SectionLabel>Risk Signals ({riskDetail.signals.length})</SectionLabel>
          <div className="space-y-3">
            {visibleSignals.map((signal, idx) => (
              <Card key={idx}>
                <CardContent className="pt-5">
                  <div className="flex flex-wrap items-start justify-between gap-4 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="h-2 w-2 rounded-full shrink-0" style={{
                        background: signal.severity === 'CRITICAL' ? 'var(--risk-critical)'
                          : signal.severity === 'HIGH' ? 'var(--risk-high)'
                          : signal.severity === 'MEDIUM' ? 'var(--risk-medium)'
                          : 'var(--risk-low)',
                      }} />
                      <span className="font-semibold" style={{ color: 'var(--fg)' }}>
                        {signal.signalType.replace(/_/g, ' ')}
                      </span>
                      <Badge variant="risk" riskLevel={signal.severity as any}>{signal.severity}</Badge>
                    </div>
                    <div className="text-right">
                      <div className="text-xs" style={{ color: 'var(--fg-subtle)' }}>Contribution</div>
                      <div className="text-xl font-bold" style={{ color: 'var(--risk-high)' }}>
                        +{signal.scoreContribution} pts
                      </div>
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3 mb-2">
                    <div className="rounded-lg p-3" style={{ background: 'var(--surface-2)' }}>
                      <div className="text-xs mb-1" style={{ color: 'var(--fg-subtle)' }}>Observed value</div>
                      <div className="text-sm font-semibold" style={{ color: 'var(--fg)' }}>
                        {signal.observedValue}
                      </div>
                    </div>
                    <div className="rounded-lg p-3" style={{ background: 'var(--surface-2)' }}>
                      <div className="text-xs mb-1" style={{ color: 'var(--fg-subtle)' }}>Expected baseline</div>
                      <div className="text-sm font-semibold" style={{ color: 'var(--fg)' }}>
                        {signal.baselineValue}
                      </div>
                    </div>
                  </div>
                  {signal.explanation && (
                    <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>{signal.explanation}</p>
                  )}
                </CardContent>
              </Card>
            ))}

            {riskDetail.signals.length > 3 && (
              <button
                onClick={() => setShowAllSignals(v => !v)}
                className="flex items-center gap-2 text-sm w-full justify-center py-2 rounded-xl transition-colors"
                style={{ color: 'var(--accent)', background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                {showAllSignals
                  ? <><ChevronUp className="h-4 w-4" />Show fewer signals</>
                  : <><ChevronDown className="h-4 w-4" />Show {riskDetail.signals.length - 3} more signals</>}
              </button>
            )}
          </div>
        </div>
      )}

      {/* No risk analysis yet */}
      {!riskDetail && (
        <div className="flex items-start gap-3 px-5 py-4 rounded-xl"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" style={{ color: 'var(--fg-subtle)' }} />
          <div>
            <div className="text-sm font-bold mb-1" style={{ color: 'var(--fg)' }}>No risk analysis yet</div>
            <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>
              Run risk analysis first (Dataset page → Analyze Risk) to see signals, ML predictions, and SHAP values.
            </p>
          </div>
        </div>
      )}

      {/* ── 5. AI Assessment + Analyst Decision ──────────────────────── */}
      {riskDetail && (
        <div>
          <SectionLabel>AI Evidence Assessment</SectionLabel>
          <AiPanel
            customerId={id!}
            clusterSize={clusterSize}
            riskDetail={riskDetail}
            onRefresh={() => refetchRisk()}
          />
        </div>
      )}

      {/* ── 6. Transaction history ────────────────────────────────────── */}
      <div>
        <SectionLabel>Transaction History</SectionLabel>
        <Card>
          <CardContent className="px-0 py-0">
            {!txData?.data.length ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <Receipt className="h-8 w-8" style={{ color: 'var(--fg-subtle)' }} />
                <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>No transactions found</p>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-6">Transaction ID</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Risk</TableHead>
                      <TableHead>Timestamp</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {txData.data.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell className="pl-6">
                          <Link to={`/transactions/${tx.transactionId}`}
                            className="font-mono text-xs hover:underline"
                            style={{ color: 'var(--accent)' }}>
                            {tx.transactionId}
                          </Link>
                        </TableCell>
                        <TableCell className="font-semibold tabular-nums" style={{ color: 'var(--fg)' }}>
                          {formatCurrency(tx.amount)}
                        </TableCell>
                        <TableCell className="text-xs" style={{ color: 'var(--fg-muted)' }}>
                          {tx.paymentMethod}
                        </TableCell>
                        <TableCell className="text-xs" style={{ color: 'var(--fg-muted)' }}>
                          {tx.status}
                        </TableCell>
                        <TableCell>
                          <Badge variant="risk" riskLevel={tx.riskLevel}>{tx.riskLevel}</Badge>
                        </TableCell>
                        <TableCell className="text-xs" style={{ color: 'var(--fg-subtle)' }}>
                          {formatRelativeTime(tx.timestamp)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <PaginationBar
                  page={txPage} pageSize={TX_PAGE_SIZE} total={txData.total}
                  onPrev={() => setTxPage(p => Math.max(1, p - 1))}
                  onNext={() => setTxPage(p => p + 1)}
                  label="transactions"
                />
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
