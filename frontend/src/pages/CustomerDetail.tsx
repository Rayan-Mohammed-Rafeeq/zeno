import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { customerApi } from '@/services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatNumber, formatCurrency, formatRelativeTime } from '@/lib/utils';
import { ArrowLeft, AlertTriangle, ShieldAlert, Activity, CreditCard, Smartphone, Globe } from 'lucide-react';

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="h-px flex-1" style={{ background: 'var(--border)' }} />
      <span className="text-xs font-semibold uppercase tracking-widest px-2" style={{ color: 'var(--fg-subtle)' }}>
        {children}
      </span>
      <div className="h-px flex-1" style={{ background: 'var(--border)' }} />
    </div>
  );
}

export function CustomerDetail() {
  const { id } = useParams<{ id: string }>();

  const { data: customer, isLoading } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => customerApi.getCustomer(id!),
    enabled: !!id,
  });

  const { data: risk } = useQuery({
    queryKey: ['customer-risk', id],
    queryFn: () => customerApi.getCustomerRiskAssessment(id!),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 gap-3" style={{ color: 'var(--fg-subtle)' }}>
        <span className="h-5 w-5 border-2 border-current/20 border-t-current rounded-full animate-spin" />
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

  return (
    <div className="space-y-6">
      {/* Back */}
      <Link to="/customers"
        className="inline-flex items-center gap-2 text-sm hover:underline"
        style={{ color: 'var(--accent)' }}>
        <ArrowLeft className="h-4 w-4" />Back to customers
      </Link>

      {/* Hero card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-start justify-between gap-6">
            {/* Left */}
            <div className="flex items-start gap-5">
              <div className="h-16 w-16 rounded-2xl flex items-center justify-center text-2xl font-bold shrink-0"
                style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}>
                {customer.name.charAt(0)}
              </div>
              <div>
                <h1 className="text-2xl font-bold" style={{ color: 'var(--fg)' }}>{customer.name}</h1>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <span className="font-mono text-sm" style={{ color: 'var(--fg-subtle)' }}>{customer.customerId}</span>
                  <Badge variant="risk" riskLevel={customer.riskLevel}>{customer.riskLevel} RISK</Badge>
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{
                    background: customer.status === 'FLAGGED' ? 'var(--risk-critical-bg)' : 'var(--success-bg)',
                    color: customer.status === 'FLAGGED' ? 'var(--risk-critical)' : 'var(--success)',
                  }}>
                    {customer.status}
                  </span>
                </div>
                <p className="text-sm mt-2" style={{ color: 'var(--fg-muted)' }}>
                  First seen {formatRelativeTime(customer.firstSeen)} · Last active {formatRelativeTime(customer.lastActivity)}
                </p>
              </div>
            </div>

            {/* Risk score gauge */}
            <div className="text-center">
              <div className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: 'var(--fg-subtle)' }}>
                Risk Score
              </div>
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
              { icon: Activity,    label: 'Transactions', val: formatNumber(customer.transactionCount) },
              { icon: CreditCard,  label: 'Total Amount',  val: formatCurrency(customer.totalAmount) },
              { icon: Smartphone,  label: 'Devices',       val: String(customer.deviceCount) },
              { icon: Globe,       label: 'IP Addresses',  val: String(customer.ipCount) },
            ].map(({ icon: Icon, label, val }) => (
              <div key={label} className="flex flex-col items-center justify-center gap-1 py-4"
                style={{ background: 'var(--surface-2)' }}>
                <Icon className="h-4 w-4 mb-0.5" style={{ color: 'var(--fg-subtle)' }} />
                <div className="text-xl font-bold" style={{ color: 'var(--fg)' }}>{val}</div>
                <div className="text-xs" style={{ color: 'var(--fg-subtle)' }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Refund rate highlighted */}
          {customer.refundRate > 10 && (
            <div className="mt-4 flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{ background: 'var(--risk-high-bg)', border: '1px solid var(--risk-high)' }}>
              <AlertTriangle className="h-4 w-4 shrink-0" style={{ color: 'var(--risk-high)' }} />
              <span className="text-sm font-medium" style={{ color: 'var(--risk-high)' }}>
                Refund rate {customer.refundRate.toFixed(1)}% — significantly above merchant baseline.
                {customer.refundCount} refunds across {customer.transactionCount} transactions.
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Risk Signals */}
      {risk && risk.signals.length > 0 && (
        <div>
          <SectionLabel>Risk Signals</SectionLabel>
          <div className="space-y-3">
            {risk.signals.map((signal) => (
              <Card key={signal.id}>
                <CardContent className="pt-5">
                  <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="h-2 w-2 rounded-full" style={{
                        background: signal.severity === 'CRITICAL' ? 'var(--risk-critical)'
                          : signal.severity === 'HIGH' ? 'var(--risk-high)'
                          : signal.severity === 'MEDIUM' ? 'var(--risk-medium)'
                          : 'var(--risk-low)',
                      }} />
                      <span className="font-semibold" style={{ color: 'var(--fg)' }}>{signal.name}</span>
                      <Badge variant="risk" riskLevel={signal.severity}>{signal.severity}</Badge>
                    </div>
                    <div className="text-right">
                      <div className="text-xs" style={{ color: 'var(--fg-subtle)' }}>Contribution</div>
                      <div className="text-xl font-bold" style={{ color: 'var(--risk-high)' }}>
                        +{signal.contribution} pts
                      </div>
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4 mb-3">
                    <div className="rounded-lg p-3" style={{ background: 'var(--surface-2)' }}>
                      <div className="text-xs mb-1" style={{ color: 'var(--fg-subtle)' }}>Observed value</div>
                      <div className="text-sm font-semibold" style={{ color: 'var(--fg)' }}>{signal.observedValue}</div>
                    </div>
                    <div className="rounded-lg p-3" style={{ background: 'var(--surface-2)' }}>
                      <div className="text-xs mb-1" style={{ color: 'var(--fg-subtle)' }}>Expected baseline</div>
                      <div className="text-sm font-semibold" style={{ color: 'var(--fg)' }}>{signal.expectedBaseline}</div>
                    </div>
                  </div>

                  <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>{signal.evidence}</p>

                  <div className="flex items-center gap-4 mt-3 text-xs" style={{ color: 'var(--fg-subtle)' }}>
                    <span>Confidence: <strong style={{ color: 'var(--fg-muted)' }}>{(signal.confidence * 100).toFixed(0)}%</strong></span>
                    <span>Detected {formatRelativeTime(signal.detectedAt)}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* AI Assessment */}
      {risk?.aiAssessment && (
        <div>
          <SectionLabel>AI Evidence Assessment</SectionLabel>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle>AI-Generated Assessment</CardTitle>
                <Badge variant="outline">AI-GENERATED · REVIEW REQUIRED</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Summary */}
              <div className="rounded-xl p-4" style={{ background: 'var(--accent-muted)', border: '1px solid var(--border)' }}>
                <p className="text-sm font-medium" style={{ color: 'var(--fg)' }}>
                  {risk.aiAssessment.summary}
                </p>
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-2" style={{ color: 'var(--fg)' }}>Reasoning</h4>
                <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>{risk.aiAssessment.reasoning}</p>
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-2" style={{ color: 'var(--fg)' }}>Evidence Considered</h4>
                <ul className="space-y-1.5">
                  {risk.aiAssessment.evidenceConsidered.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm" style={{ color: 'var(--fg-muted)' }}>
                      <span className="h-1.5 w-1.5 rounded-full mt-1.5 shrink-0" style={{ background: 'var(--accent)' }} />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-2" style={{ color: 'var(--fg)' }}>Recommended Action</h4>
                <span className="px-3 py-1.5 rounded-lg text-sm font-semibold"
                  style={{ background: 'var(--warning-bg)', color: 'var(--warning)' }}>
                  {risk.aiAssessment.recommendedAction.replace(/_/g, ' ')}
                </span>
              </div>

              {/* Limitations box */}
              <div className="rounded-xl p-4 flex items-start gap-3"
                style={{ background: 'var(--warning-bg)', border: '1px solid var(--warning)' }}>
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" style={{ color: 'var(--warning)' }} />
                <div>
                  <div className="text-xs font-bold mb-1" style={{ color: 'var(--warning)' }}>
                    AI ASSESSMENT DISCLAIMER
                  </div>
                  <p className="text-sm" style={{ color: 'var(--warning)' }}>{risk.aiAssessment.limitations}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
