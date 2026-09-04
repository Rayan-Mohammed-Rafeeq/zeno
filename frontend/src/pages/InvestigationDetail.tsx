import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { investigationApi, apiRequest } from '@/services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatRelativeTime } from '@/lib/utils';
import {
  ArrowLeft, ShieldAlert, AlertTriangle, MessageSquare,
  CheckCircle, User, Brain, Clock, Send,
} from 'lucide-react';

const STATUS_STYLE: Record<string, React.CSSProperties> = {
  OPEN:         { background: 'var(--accent-muted)',    color: 'var(--accent)' },
  REVIEWING:    { background: 'var(--warning-bg)',      color: 'var(--warning)' },
  ESCALATED:    { background: 'var(--risk-high-bg)',    color: 'var(--risk-high)' },
  RESOLVED:     { background: 'var(--success-bg)',      color: 'var(--success)' },
};

const STATUS_TRANSITIONS: Record<string, string[]> = {
  OPEN:      ['REVIEWING'],
  REVIEWING: ['ESCALATED', 'RESOLVED'],
  ESCALATED: ['RESOLVED'],
  RESOLVED:  [],
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

export function InvestigationDetail() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [noteText, setNoteText] = useState('');
  const [statusLoading, setStatusLoading] = useState(false);

  const { data: inv, isLoading } = useQuery({
    queryKey: ['investigation', id],
    queryFn:  () => investigationApi.getInvestigation(id!),
    enabled:  !!id,
  });

  // Add note mutation
  const addNote = useMutation({
    mutationFn: (content: string) =>
      apiRequest(`/investigations/${id}/notes`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      }),
    onSuccess: () => {
      setNoteText('');
      qc.invalidateQueries({ queryKey: ['investigation', id] });
    },
  });

  // Status update
  const updateStatus = async (newStatus: string) => {
    setStatusLoading(true);
    try {
      await apiRequest(`/investigations/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      qc.invalidateQueries({ queryKey: ['investigation', id] });
      qc.invalidateQueries({ queryKey: ['investigations'] });
    } finally {
      setStatusLoading(false);
    }
  };

  // AI assessment mutation
  const requestAi = useMutation({
    mutationFn: () =>
      apiRequest('/intelligence/assess', {
        method: 'POST',
        body: JSON.stringify({ subjectId: inv?.subjectId, subjectType: inv?.subjectType }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['investigation', id] }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 gap-3" style={{ color: 'var(--fg-subtle)' }}>
        <span className="h-5 w-5 border-2 border-current/20 border-t-current rounded-full animate-spin" />
        Loading investigation…
      </div>
    );
  }

  if (!inv) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-2">
        <ShieldAlert className="h-10 w-10" style={{ color: 'var(--fg-subtle)' }} />
        <p style={{ color: 'var(--fg-muted)' }}>Investigation not found</p>
        <Link to="/investigations" className="text-sm hover:underline" style={{ color: 'var(--accent)' }}>
          Back to investigations
        </Link>
      </div>
    );
  }

  const transitions = STATUS_TRANSITIONS[inv.status] ?? [];

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Back */}
      <Link to="/investigations"
        className="inline-flex items-center gap-2 text-sm hover:underline"
        style={{ color: 'var(--accent)' }}>
        <ArrowLeft className="h-4 w-4" />Back to investigations
      </Link>

      {/* Header card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-xl font-bold" style={{ color: 'var(--fg)' }}>
                  Investigation
                </h1>
                <span className="font-mono text-xs px-2 py-1 rounded-lg"
                  style={{ background: 'var(--surface-2)', color: 'var(--fg-muted)' }}>
                  {inv.id?.slice(0, 8)}…
                </span>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <Badge variant="risk" riskLevel={inv.riskLevel as any}>{inv.riskLevel}</Badge>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-md"
                  style={STATUS_STYLE[inv.status] ?? {}}>
                  {inv.status}
                </span>
                <span className="text-sm" style={{ color: 'var(--fg-muted)' }}>
                  {inv.subjectType} · {inv.subjectId?.slice(0, 12)}…
                </span>
              </div>
              <div className="flex items-center gap-4 mt-3 text-xs" style={{ color: 'var(--fg-subtle)' }}>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Opened {formatRelativeTime(inv.createdAt)}
                </span>
                {inv.updatedAt !== inv.createdAt && (
                  <span>Updated {formatRelativeTime(inv.updatedAt)}</span>
                )}
              </div>
            </div>

            {/* Status actions */}
            {transitions.length > 0 && (
              <div className="flex flex-col gap-2">
                <div className="text-xs font-medium" style={{ color: 'var(--fg-subtle)' }}>
                  Update status
                </div>
                <div className="flex gap-2">
                  {transitions.map((s) => (
                    <button key={s} disabled={statusLoading}
                      onClick={() => updateStatus(s)}
                      className="px-3 h-8 rounded-lg text-xs font-semibold transition-all"
                      style={s === 'RESOLVED'
                        ? { background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid var(--success)' }
                        : s === 'ESCALATED'
                        ? { background: 'var(--risk-high-bg)', color: 'var(--risk-high)', border: '1px solid var(--risk-high)' }
                        : { background: 'var(--accent-muted)', color: 'var(--accent)', border: '1px solid var(--accent)' }}>
                      → {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ML Evidence section */}
      <SectionLabel>ML Evidence</SectionLabel>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Quantitative Risk Evidence</CardTitle>
            <span className="text-xs px-2 py-0.5 rounded-md font-medium"
              style={{ background: 'var(--surface-2)', color: 'var(--fg-muted)' }}>
              MODEL ESTIMATE
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            {[
              { label: 'Risk Score',        val: '—', sub: 'Run risk analysis first' },
              { label: 'Fraud Probability', val: '—', sub: 'XGBoost calibrated' },
              { label: 'Anomaly Score',     val: '—', sub: 'Isolation Forest' },
              { label: 'Model Version',     val: '—', sub: 'Feature version' },
            ].map(({ label, val, sub }) => (
              <div key={label} className="rounded-xl p-4 text-center"
                style={{ background: 'var(--surface-2)' }}>
                <div className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--fg-subtle)' }}>
                  {label}
                </div>
                <div className="text-xl font-bold" style={{ color: 'var(--fg)' }}>{val}</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--fg-subtle)' }}>{sub}</div>
              </div>
            ))}
          </div>
          <p className="text-xs px-3 py-2 rounded-lg" style={{ background: 'var(--warning-bg)', color: 'var(--warning)' }}>
            ML scores are populated when the ML service is enabled (ML_SERVICE_ENABLED=true)
            and risk analysis has been run on the subject customer.
          </p>
        </CardContent>
      </Card>

      {/* AI Assessment */}
      <SectionLabel>AI Assessment</SectionLabel>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-4 w-4" style={{ color: 'var(--accent)' }} />
              Evidence Synthesis
            </CardTitle>
            <button
              onClick={() => requestAi.mutate()}
              disabled={requestAi.isPending}
              className="flex items-center gap-2 px-3 h-8 rounded-lg text-xs font-semibold transition-all"
              style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}>
              {requestAi.isPending ? (
                <span className="h-3 w-3 border-2 border-current/20 border-t-current rounded-full animate-spin" />
              ) : (
                <Brain className="h-3 w-3" />
              )}
              {requestAi.isPending ? 'Requesting…' : 'Request AI Assessment'}
            </button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-3 px-4 py-3 rounded-xl mb-4"
            style={{ background: 'var(--warning-bg)', border: '1px solid var(--warning)' }}>
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" style={{ color: 'var(--warning)' }} />
            <div className="text-xs" style={{ color: 'var(--warning)' }}>
              <strong>AI ASSESSMENT DISCLAIMER</strong> — This is an AI-generated advisory summary.
              It interprets supplied evidence and must not be used as the sole basis for any decision.
              All AI assessments require human analyst review before action.
              The ML model provides the quantitative risk score; the AI provides qualitative interpretation only.
            </div>
          </div>

          {requestAi.isSuccess ? (
            <div className="rounded-xl p-4" style={{ background: 'var(--accent-muted)', border: '1px solid var(--border)' }}>
              <p className="text-sm font-medium mb-1" style={{ color: 'var(--fg)' }}>
                Assessment requested successfully. Refresh to view the latest assessment.
              </p>
            </div>
          ) : (
            <p className="text-sm" style={{ color: 'var(--fg-subtle)' }}>
              Click "Request AI Assessment" to trigger the Minimax M3 / OpenAI evidence synthesis for this subject.
              The assessment is advisory only — it synthesises rule-based signals, ML scores, and cluster evidence.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Analyst notes */}
      <SectionLabel>Analyst Notes</SectionLabel>
      <Card>
        <CardContent className="pt-5 space-y-4">
          {inv.notes && inv.notes.length > 0 ? (
            <div className="space-y-3">
              {inv.notes.map((note) => (
                <div key={note.id} className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: 'var(--accent-muted)' }}>
                    <User className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                  </div>
                  <div className="flex-1 rounded-xl p-3" style={{ background: 'var(--surface-2)' }}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold" style={{ color: 'var(--fg)' }}>
                        {note.authorId?.slice(0, 8)}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--fg-subtle)' }}>
                        {formatRelativeTime(note.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>{note.content}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 py-4" style={{ color: 'var(--fg-subtle)' }}>
              <MessageSquare className="h-4 w-4" />
              <span className="text-sm">No notes yet. Add the first note below.</span>
            </div>
          )}

          {/* Add note */}
          {inv.status !== 'RESOLVED' && (
            <div className="flex gap-3 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Add an analyst note…"
                rows={3}
                className="flex-1 rounded-xl p-3 text-sm resize-none outline-none transition-all"
                style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  color: 'var(--fg)',
                }}
                onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
                onBlur={(e)  => (e.target.style.borderColor = 'var(--border)')}
              />
              <button
                disabled={!noteText.trim() || addNote.isPending}
                onClick={() => addNote.mutate(noteText.trim())}
                className="self-end flex items-center gap-2 px-4 h-9 rounded-lg text-sm font-semibold transition-all"
                style={{
                  background: noteText.trim() ? 'var(--accent)' : 'var(--surface-2)',
                  color: noteText.trim() ? 'var(--accent-fg)' : 'var(--fg-subtle)',
                }}>
                {addNote.isPending
                  ? <span className="h-4 w-4 border-2 border-current/20 border-t-current rounded-full animate-spin" />
                  : <Send className="h-4 w-4" />}
                Post
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resolved banner */}
      {inv.status === 'RESOLVED' && (
        <div className="flex items-center gap-3 px-5 py-4 rounded-xl"
          style={{ background: 'var(--success-bg)', border: '1px solid var(--success)' }}>
          <CheckCircle className="h-5 w-5 shrink-0" style={{ color: 'var(--success)' }} />
          <div>
            <div className="text-sm font-bold" style={{ color: 'var(--success)' }}>Investigation Resolved</div>
            <p className="text-xs mt-0.5" style={{ color: 'var(--success)' }}>
              This investigation has been closed. No further actions can be taken.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
