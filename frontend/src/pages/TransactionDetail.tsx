import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { transactionApi } from '@/services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency, formatRelativeTime } from '@/lib/utils';
import {
  ArrowLeft, Receipt, AlertTriangle, Activity,
  Smartphone, Globe, CreditCard,
} from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  COMPLETED: 'var(--success)',
  REFUNDED:  'var(--risk-medium)',
  PENDING:   'var(--info)',
  FAILED:    'var(--risk-critical)',
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 my-5">
      <div className="h-px flex-1" style={{ background: 'var(--border)' }} />
      <span className="text-xs font-semibold uppercase tracking-widest px-2"
        style={{ color: 'var(--fg-subtle)' }}>
        {children}
      </span>
      <div className="h-px flex-1" style={{ background: 'var(--border)' }} />
    </div>
  );
}

export function TransactionDetail() {
  const { id } = useParams<{ id: string }>();

  const { data: txn, isLoading } = useQuery({
    queryKey: ['transaction', id],
    queryFn:  () => transactionApi.getTransaction(id!),
    enabled:  !!id,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 gap-3" style={{ color: 'var(--fg-subtle)' }}>
        <span className="h-5 w-5 border-2 border-current/20 border-t-current rounded-full animate-spin" />
        Loading transaction…
      </div>
    );
  }

  if (!txn) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-2">
        <Receipt className="h-10 w-10" style={{ color: 'var(--fg-subtle)' }} />
        <p style={{ color: 'var(--fg-muted)' }}>Transaction not found</p>
        <Link to="/transactions" className="text-sm hover:underline" style={{ color: 'var(--accent)' }}>
          Back to transactions
        </Link>
      </div>
    );
  }

  const score = txn.riskScore ?? 0;
  const scoreColor = score >= 80 ? 'var(--risk-critical)'
    : score >= 65 ? 'var(--risk-high)'
    : score >= 40 ? 'var(--risk-medium)'
    : 'var(--risk-low)';

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Back */}
      <Link to="/transactions"
        className="inline-flex items-center gap-2 text-sm hover:underline"
        style={{ color: 'var(--accent)' }}>
        <ArrowLeft className="h-4 w-4" />Back to transactions
      </Link>

      {/* Hero card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'var(--accent-muted)' }}>
                <Receipt className="h-5 w-5" style={{ color: 'var(--accent)' }} />
              </div>
              <div>
                <h1 className="text-xl font-bold font-mono" style={{ color: 'var(--fg)' }}>
                  {txn.transactionId}
                </h1>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full"
                      style={{ background: STATUS_COLORS[txn.status] ?? 'var(--fg-subtle)' }} />
                    <span className="text-sm" style={{ color: 'var(--fg-muted)' }}>{txn.status}</span>
                  </div>
                  <Badge variant="risk" riskLevel={txn.riskLevel ?? 'LOW'}>{(txn.riskLevel ?? 'LOW')} RISK</Badge>
                  <Link to={`/customers/${txn.customerId}`}
                    className="text-sm hover:underline" style={{ color: 'var(--accent)' }}>
                    {txn.customerName}
                  </Link>
                </div>
                <p className="text-xs mt-1" style={{ color: 'var(--fg-subtle)' }}>
                  {formatRelativeTime(txn.timestamp)}
                </p>
              </div>
            </div>

            {/* Risk score + amount */}
            <div className="flex items-center gap-6">
              <div className="text-right">
                <div className="text-xs uppercase tracking-wider mb-0.5"
                  style={{ color: 'var(--fg-subtle)' }}>Amount</div>
                <div className="text-3xl font-bold tabular-nums" style={{ color: 'var(--fg)' }}>
                  {formatCurrency(txn.amount)}
                </div>
                <div className="text-xs" style={{ color: 'var(--fg-subtle)' }}>{txn.currency}</div>
              </div>
              <div className="text-right">
                <div className="text-xs uppercase tracking-wider mb-0.5"
                  style={{ color: 'var(--fg-subtle)' }}>Risk Score</div>
                <div className="text-3xl font-bold tabular-nums" style={{ color: scoreColor }}>
                  {txn.riskScore ?? '—'}
                </div>
              </div>
            </div>
          </div>

          {/* Stat strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-px mt-6 rounded-xl overflow-hidden border"
            style={{ borderColor: 'var(--border)', background: 'var(--border)' }}>
            {[
              { icon: CreditCard, label: 'Payment Method', val: txn.paymentMethod },
              { icon: Smartphone, label: 'Device ID',      val: txn.deviceId ?? '—' },
              { icon: Globe,      label: 'IP Address',     val: txn.ipAddress ?? '—' },
              { icon: Activity,   label: 'Risk Signals',   val: `${txn.signalCount}` },
            ].map(({ icon: Icon, label, val }) => (
              <div key={label} className="flex flex-col items-center justify-center gap-1 py-4"
                style={{ background: 'var(--surface-2)' }}>
                <Icon className="h-4 w-4 mb-0.5" style={{ color: 'var(--fg-subtle)' }} />
                <div className="text-sm font-bold truncate max-w-[120px] text-center"
                  style={{ color: 'var(--fg)' }}>
                  {val}
                </div>
                <div className="text-xs" style={{ color: 'var(--fg-subtle)' }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Refund info */}
          {txn.isRefunded && (
            <div className="mt-4 flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{ background: 'var(--risk-high-bg)', border: '1px solid var(--risk-high)' }}>
              <AlertTriangle className="h-4 w-4 shrink-0" style={{ color: 'var(--risk-high)' }} />
              <span className="text-sm font-medium" style={{ color: 'var(--risk-high)' }}>
                Transaction refunded
                {txn.refundAmount && ` — ${formatCurrency(txn.refundAmount)} refunded`}
                {txn.refundDate && ` on ${formatRelativeTime(txn.refundDate)}`}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ML Risk Assessment */}
      <SectionLabel>ML Risk Assessment</SectionLabel>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Quantitative Risk Scores</CardTitle>
            <span className="text-xs px-2 py-0.5 rounded-md font-medium"
              style={{ background: 'var(--surface-2)', color: 'var(--fg-muted)' }}>
              MODEL ESTIMATE
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 mb-4">
            {/* Overall risk */}
            <div className="rounded-xl p-4" style={{ background: 'var(--surface-2)' }}>
              <div className="text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--fg-subtle)' }}>
                Composite Risk Score
              </div>
              <div className="flex items-end gap-2">
                <div className="text-3xl font-bold tabular-nums" style={{ color: scoreColor }}>
                  {txn.riskScore ?? '—'}
                </div>
                <div className="text-sm mb-1" style={{ color: 'var(--fg-subtle)' }}>/100</div>
              </div>
              <div className="mt-2 h-2 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                <div className="h-full rounded-full transition-all"
                  style={{ width: `${score}%`, background: scoreColor }} />
              </div>
              <div className="text-xs mt-1" style={{ color: 'var(--fg-subtle)' }}>
                0.75 × fraud_prob + 0.25 × anomaly_score
              </div>
            </div>

            {/* Signal count */}
            <div className="rounded-xl p-4" style={{ background: 'var(--surface-2)' }}>
              <div className="text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--fg-subtle)' }}>
                Rule-Based Signals
              </div>
              <div className="text-3xl font-bold" style={{ color: txn.signalCount > 0 ? 'var(--risk-high)' : 'var(--success)' }}>
                {txn.signalCount}
              </div>
              <div className="text-xs mt-1" style={{ color: 'var(--fg-subtle)' }}>
                {txn.signalCount === 0 ? 'No signals detected' : `signal${txn.signalCount > 1 ? 's' : ''} triggered`}
              </div>
            </div>
          </div>

          <div className="text-xs px-3 py-2 rounded-lg"
            style={{ background: 'var(--surface-2)', color: 'var(--fg-subtle)' }}>
            Fraud probability and anomaly score are available per-customer in the customer detail page.
            Transaction-level ML scores require running risk analysis with ML service enabled.
          </div>
        </CardContent>
      </Card>

      {/* SHAP Contributions — shown when ML is available */}
      <SectionLabel>Feature Contributions (SHAP)</SectionLabel>
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-start gap-3 px-4 py-3 rounded-xl"
            style={{ background: 'var(--warning-bg)', border: '1px solid var(--warning)' }}>
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" style={{ color: 'var(--warning)' }} />
            <div className="text-xs" style={{ color: 'var(--warning)' }}>
              <strong>SHAP DISCLAIMER</strong> — Feature contributions explain the <em>model's prediction</em>,
              not ground truth. A high SHAP value means the model relied on this feature, not that the feature
              is definitive evidence of fraud. SHAP does not prove causality.
            </div>
          </div>
          <div className="mt-4 text-sm text-center py-6" style={{ color: 'var(--fg-subtle)' }}>
            SHAP feature contributions are generated per-prediction when the ML service is enabled
            (ML_SERVICE_ENABLED=true). Run risk analysis to populate this section.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
