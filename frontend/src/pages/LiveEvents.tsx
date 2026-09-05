import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { webhookApi, type WebhookEventRecord } from '@/services/api';
import { RazorpayCheckoutButton } from '@/components/ui/RazorpayCheckoutButton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { PaginationBar } from '@/components/ui/Pagination';
import { formatRelativeTime } from '@/lib/utils';
import {
  Activity, AlertTriangle, CheckCircle, Clock, XCircle,
  Copy, RefreshCw, Zap, Info,
} from 'lucide-react';

/* ── helpers ──────────────────────────────────────────────────────────── */
function statusIcon(status: WebhookEventRecord['status']) {
  switch (status) {
    case 'PROCESSED': return <CheckCircle className="h-3.5 w-3.5" style={{ color: 'var(--success)' }} />;
    case 'DUPLICATE': return <Copy        className="h-3.5 w-3.5" style={{ color: 'var(--fg-subtle)' }} />;
    case 'FAILED':    return <XCircle     className="h-3.5 w-3.5" style={{ color: 'var(--risk-high)' }} />;
    case 'IGNORED':   return <Info        className="h-3.5 w-3.5" style={{ color: 'var(--fg-subtle)' }} />;
    default:          return <Clock       className="h-3.5 w-3.5" style={{ color: 'var(--warning)' }} />;
  }
}

function statusColor(status: WebhookEventRecord['status']): string {
  switch (status) {
    case 'PROCESSED': return 'var(--success)';
    case 'FAILED':    return 'var(--risk-high)';
    case 'DUPLICATE': return 'var(--fg-subtle)';
    case 'IGNORED':   return 'var(--fg-subtle)';
    default:          return 'var(--warning)';
  }
}

function riskColor(level: string | null): string {
  switch (level) {
    case 'CRITICAL': return 'var(--risk-critical)';
    case 'HIGH':     return 'var(--risk-high)';
    case 'MEDIUM':   return 'var(--risk-medium)';
    case 'LOW':      return 'var(--risk-low)';
    default:         return 'var(--fg-subtle)';
  }
}

function eventTypeLabel(type: string): string {
  return type.replace('.', ' ').toUpperCase();
}

function eventTypeColor(type: string): string {
  if (type.startsWith('payment.captured'))  return 'var(--success)';
  if (type.startsWith('payment.failed'))    return 'var(--risk-high)';
  if (type.startsWith('refund.'))           return 'var(--warning)';
  return 'var(--fg-subtle)';
}

/* ── empty state ──────────────────────────────────────────────────────── */
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 gap-4 text-center">
      <div className="h-16 w-16 rounded-2xl flex items-center justify-center"
        style={{ background: 'var(--accent-muted)' }}>
        <Zap className="h-8 w-8" style={{ color: 'var(--accent)' }} />
      </div>
      <div>
        <h3 className="text-base font-semibold mb-2" style={{ color: 'var(--fg)' }}>
          No live events yet
        </h3>
        <p className="text-sm max-w-md" style={{ color: 'var(--fg-muted)' }}>
          Configure your Razorpay Test Mode webhook to start receiving live events.
          Every payment captured, payment failed, or refund will appear here in real time
          with an immediate risk score from the full ML + rules pipeline.
        </p>
      </div>
      <div className="rounded-xl p-4 text-left max-w-lg w-full"
        style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
        <div className="text-xs font-bold uppercase tracking-wider mb-2"
          style={{ color: 'var(--fg-subtle)' }}>Setup</div>
        <ol className="space-y-1.5 text-sm" style={{ color: 'var(--fg-muted)' }}>
          <li><span className="font-semibold" style={{ color: 'var(--fg)' }}>1.</span> Set{' '}
            <code className="text-xs px-1 py-0.5 rounded"
              style={{ background: 'var(--surface)', color: 'var(--accent)' }}>
              RAZORPAY_WEBHOOK_SECRET
            </code>{' '}in <code className="text-xs">backend/.env</code>
          </li>
          <li><span className="font-semibold" style={{ color: 'var(--fg)' }}>2.</span> Set{' '}
            <code className="text-xs px-1 py-0.5 rounded"
              style={{ background: 'var(--surface)', color: 'var(--accent)' }}>
              RAZORPAY_WEBHOOK_ENABLED=true
            </code>
          </li>
          <li><span className="font-semibold" style={{ color: 'var(--fg)' }}>3.</span>{' '}
            Expose your backend with{' '}
            <code className="text-xs px-1 py-0.5 rounded"
              style={{ background: 'var(--surface)', color: 'var(--accent)' }}>
              ngrok http 8080
            </code>
          </li>
          <li><span className="font-semibold" style={{ color: 'var(--fg)' }}>4.</span>{' '}
            In Razorpay Dashboard → Settings → Webhooks, add:
            <div className="mt-1 px-2 py-1 rounded text-xs font-mono"
              style={{ background: 'var(--surface)', color: 'var(--accent)' }}>
              {'https://<ngrok-url>/api/v1/webhooks/razorpay/<merchantId>'}
            </div>
          </li>
          <li><span className="font-semibold" style={{ color: 'var(--fg)' }}>5.</span>{' '}
            Enable events: <code className="text-xs">payment.captured</code>,{' '}
            <code className="text-xs">payment.failed</code>,{' '}
            <code className="text-xs">refund.created</code>
          </li>
          <li><span className="font-semibold" style={{ color: 'var(--fg)' }}>6.</span>{' '}
            Make a test payment — it will appear here with a live risk score.
          </li>
        </ol>
      </div>
    </div>
  );
}

/* ── main component ───────────────────────────────────────────────────── */
export function LiveEvents() {
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['webhook-events', page],
    queryFn: () => webhookApi.listEvents({ page, size: PAGE_SIZE }),
    refetchInterval: 10_000,   // poll every 10 s for new events
    retry: false,
  });

  const events = data?.data ?? [];
  const total  = data?.total ?? 0;

  // Summary stats from current page
  const processed  = events.filter(e => e.status === 'PROCESSED').length;
  const highRisk   = events.filter(e => e.riskLevel === 'HIGH' || e.riskLevel === 'CRITICAL').length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--fg)' }}>
            <Activity className="h-6 w-6" style={{ color: 'var(--accent)' }} />
            Live Events
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--fg-muted)' }}>
            Real-time Razorpay Test Mode transactions — each event is risk-scored immediately.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-opacity disabled:opacity-60"
          style={{ background: 'var(--surface-2)', color: 'var(--fg)', border: '1px solid var(--border)' }}>
          <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* TEST MODE disclaimer — always prominent */}
      <div className="flex items-start gap-3 px-4 py-3 rounded-xl"
        style={{ background: 'var(--warning-bg)', border: '1px solid var(--warning)' }}>
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" style={{ color: 'var(--warning)' }} />
        <div>
          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--warning)' }}>
            Razorpay Test Mode &nbsp;·&nbsp; Not Production Data
          </span>
          <p className="text-xs mt-0.5" style={{ color: 'var(--warning)' }}>
            All events shown here are from Razorpay Test Mode only.
            Risk scores use the same XGBoost + rules pipeline as the synthetic demo —
            they are NOT claims of production fraud detection performance.
            IEEE-CIS benchmark metrics (Precision 61.6%, Recall 48.1%, AUPRC 0.56) apply only
            to the held-out IEEE-CIS dataset, not to these transactions.
          </p>
        </div>
      </div>

      {/* Summary strip */}
      {total > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total Events',     value: total,     color: 'var(--fg)' },
            { label: 'Risk-Scored',      value: processed, color: 'var(--success)' },
            { label: 'High / Critical',  value: highRisk,  color: highRisk > 0 ? 'var(--risk-high)' : 'var(--fg-subtle)' },
          ].map(({ label, value, color }) => (
            <Card key={label}>
              <CardContent className="pt-4 pb-4">
                <div className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--fg-subtle)' }}>
                  {label}
                </div>
                <div className="text-2xl font-bold" style={{ color }}>{value}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Checkout demo card ───────────────────────────────────────── */}
      <Card style={{ border: '1px solid var(--accent)' }}>
        <CardHeader>
          <CardTitle>Test a Live Payment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>
            Click below to make a ₹1 test payment. The transaction will flow through
            Razorpay Test Mode → be ingested by the webhook → scored by the full
            ML + rules pipeline → and appear in the event feed below.
          </p>
          <div className="flex flex-col sm:flex-row items-start gap-4">
            <div className="flex-1">
              <RazorpayCheckoutButton
                amount={100}
                currency="INR"
                receipt="zeno-demo"
                description="Zeno Risk Manager — Live Demo Payment"
                name="Zeno Risk Manager"
                label="Pay ₹1 — Test Live Analysis"
                onSuccess={(paymentId) => {
                  // Trigger a refetch so the new event shows up immediately
                  refetch();
                  console.info('Payment verified:', paymentId);
                }}
                onError={(reason) => {
                  console.warn('Payment error:', reason);
                }}
              />
            </div>
            <div className="text-xs max-w-xs" style={{ color: 'var(--fg-subtle)' }}>
              <p className="font-semibold mb-1" style={{ color: 'var(--fg-muted)' }}>
                Test card numbers:
              </p>
              <p>Success: <span className="font-mono">4111 1111 1111 1111</span></p>
              <p>Failure: <span className="font-mono">4000 0000 0000 0002</span></p>
              <p>CVV: any 3 digits · Expiry: any future date</p>
            </div>
          </div>
          <p className="text-xs px-3 py-2 rounded-lg"
            style={{ background: 'var(--warning-bg)', color: 'var(--warning)' }}>
            Note: webhook events appear here only if RAZORPAY_WEBHOOK_ENABLED=true
            and the backend is exposed via ngrok with the webhook URL configured in
            Razorpay Dashboard. Without ngrok, the payment still verifies client-side.
          </p>
        </CardContent>
      </Card>

      {/* Event table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Webhook Event Feed</CardTitle>
            <div className="flex items-center gap-1.5 text-xs"
              style={{ color: 'var(--fg-subtle)' }}>
              <span className="h-2 w-2 rounded-full animate-pulse"
                style={{ background: 'var(--success)' }} />
              Auto-refreshes every 10s
            </div>
          </div>
        </CardHeader>

        <CardContent className="px-0 py-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-32 gap-2"
              style={{ color: 'var(--fg-subtle)' }}>
              <span className="h-5 w-5 border-2 border-current/20 border-t-current rounded-full animate-spin" />
              Loading events…
            </div>
          ) : events.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Event</TableHead>
                    <TableHead>Razorpay ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Risk Score</TableHead>
                    <TableHead>Risk Level</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((ev) => (
                    <TableRow key={ev.id}>
                      {/* Event type */}
                      <TableCell className="pl-6">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded"
                          style={{
                            background: 'var(--surface-2)',
                            color: eventTypeColor(ev.eventType),
                          }}>
                          {eventTypeLabel(ev.eventType)}
                        </span>
                      </TableCell>

                      {/* Razorpay event ID */}
                      <TableCell>
                        <span className="font-mono text-xs" style={{ color: 'var(--fg-subtle)' }}>
                          {ev.razorpayEventId.length > 20
                            ? ev.razorpayEventId.slice(0, 20) + '…'
                            : ev.razorpayEventId}
                        </span>
                      </TableCell>

                      {/* Status */}
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-xs font-medium"
                          style={{ color: statusColor(ev.status) }}>
                          {statusIcon(ev.status)}
                          {ev.status}
                        </div>
                        {ev.errorMessage && (
                          <p className="text-xs mt-0.5 max-w-xs truncate"
                            style={{ color: 'var(--risk-high)' }}>
                            {ev.errorMessage}
                          </p>
                        )}
                      </TableCell>

                      {/* Risk score */}
                      <TableCell>
                        {ev.riskScore != null ? (
                          <span className="font-bold tabular-nums text-sm"
                            style={{ color: riskColor(ev.riskLevel) }}>
                            {ev.riskScore}
                            <span className="text-xs font-normal ml-0.5"
                              style={{ color: 'var(--fg-subtle)' }}>/100</span>
                          </span>
                        ) : (
                          <span style={{ color: 'var(--fg-subtle)' }}>—</span>
                        )}
                      </TableCell>

                      {/* Risk level */}
                      <TableCell>
                        {ev.riskLevel ? (
                          <Badge variant="risk" riskLevel={ev.riskLevel as any}>
                            {ev.riskLevel}
                          </Badge>
                        ) : (
                          <span className="text-xs" style={{ color: 'var(--fg-subtle)' }}>—</span>
                        )}
                      </TableCell>

                      {/* Customer link */}
                      <TableCell>
                        {ev.paymentId ? (
                          <Link
                            to={`/transactions`}
                            className="text-xs hover:underline font-mono"
                            style={{ color: 'var(--accent)' }}>
                            {ev.paymentId.slice(0, 8)}…
                          </Link>
                        ) : (
                          <span className="text-xs" style={{ color: 'var(--fg-subtle)' }}>—</span>
                        )}
                      </TableCell>

                      {/* Source */}
                      <TableCell>
                        <span className="text-xs px-2 py-0.5 rounded font-semibold"
                          style={{ background: 'var(--warning-bg)', color: 'var(--warning)' }}>
                          {ev.source}
                        </span>
                      </TableCell>

                      {/* Time */}
                      <TableCell className="text-xs" style={{ color: 'var(--fg-subtle)' }}>
                        {formatRelativeTime(ev.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <PaginationBar
                page={page + 1}
                pageSize={PAGE_SIZE}
                total={total}
                onPrev={() => setPage(p => Math.max(0, p - 1))}
                onNext={() => setPage(p => p + 1)}
                label="events"
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* How it works */}
      <Card>
        <CardHeader><CardTitle>How Live Analysis Works</CardTitle></CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-5 gap-2 text-xs text-center">
            {[
              { step: '1', label: 'Razorpay\nTest Payment', color: 'var(--accent)' },
              { step: '→', label: '', color: 'var(--fg-subtle)' },
              { step: '2', label: 'HMAC-SHA256\nVerification', color: 'var(--success)' },
              { step: '→', label: '', color: 'var(--fg-subtle)' },
              { step: '3', label: 'Customer\nUpsert', color: 'var(--fg)' },
            ].map((s, i) => (
              <div key={i} className={`rounded-lg p-2 ${s.step === '→' ? '' : ''}`}
                style={{ background: s.step === '→' ? 'transparent' : 'var(--surface-2)' }}>
                <div className="font-bold text-sm" style={{ color: s.color }}>{s.step}</div>
                <div className="whitespace-pre-line mt-0.5" style={{ color: 'var(--fg-muted)' }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
          <div className="grid sm:grid-cols-5 gap-2 text-xs text-center mt-2">
            {[
              { step: '4', label: 'Payment\nPersisted', color: 'var(--fg)' },
              { step: '→', label: '', color: 'var(--fg-subtle)' },
              { step: '5', label: 'RiskEngine\n(ML + Rules)', color: 'var(--accent)' },
              { step: '→', label: '', color: 'var(--fg-subtle)' },
              { step: '6', label: 'Score on\nDashboard', color: 'var(--success)' },
            ].map((s, i) => (
              <div key={i} className="rounded-lg p-2"
                style={{ background: s.step === '→' ? 'transparent' : 'var(--surface-2)' }}>
                <div className="font-bold text-sm" style={{ color: s.color }}>{s.step}</div>
                <div className="whitespace-pre-line mt-0.5" style={{ color: 'var(--fg-muted)' }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs mt-3 px-3 py-2 rounded-lg"
            style={{ background: 'var(--surface-2)', color: 'var(--fg-subtle)' }}>
            The RiskEngine runs the exact same pipeline as the synthetic demo:
            7 rule-based signal detectors + XGBoost ML model (when enabled) + graph/cluster detection.
            Risk scores from Test Mode events are for demonstration only and do not represent
            production Razorpay fraud performance.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
