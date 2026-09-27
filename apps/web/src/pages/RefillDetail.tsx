import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { zenoApi } from '@/services/api/zenoApi';
import {
  ArrowLeft, CheckCircle2, Clock, AlertTriangle, Check, Plus,
  History, RefreshCw, X, MessageSquare, Sparkles, ShieldCheck
} from 'lucide-react';

export function RefillDetail() {
  const { id } = useParams<{ id: string }>();
  const refillId = Number(id);
  const queryClient = useQueryClient();

  // Modals state
  const [completeActionModal, setCompleteActionModal] = useState<{ open: boolean; actionId: number | null }>({ open: false, actionId: null });
  const [actionNotes, setActionNotes] = useState('');
  const [resolveModalOpen, setResolveModalOpen] = useState(false);
  const [resolveSummary, setResolveSummary] = useState('');
  const [addActionModalOpen, setAddActionModalOpen] = useState(false);
  const [newActionType, setNewActionType] = useState('REQUEST_PROVIDER_APPROVAL');
  const [newActionRole, setNewActionRole] = useState('PRACTICE_STAFF');
  const [newActionDesc, setNewActionDesc] = useState('');

  // Queries
  const { data: refill, isLoading: refillLoading } = useQuery({
    queryKey: ['refill', refillId],
    queryFn: () => zenoApi.getRefillById(refillId),
  });

  const { data: resolutionCase } = useQuery({
    queryKey: ['resolution-case-for-refill', refillId],
    queryFn: () => zenoApi.getResolutionByRefillId(refillId),
    retry: false,
  });
  const caseId = resolutionCase?.id ?? refillId;
  const recommendationMutation = useMutation({
    mutationFn: () => zenoApi.requestRecommendation(caseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-recommendation', caseId] });
      queryClient.invalidateQueries({ queryKey: ['refill-timeline', refillId] });
      queryClient.invalidateQueries({ queryKey: ['refill', refillId] });
    },
  });
  const { data: savedRecommendation } = useQuery({
    queryKey: ['ai-recommendation', caseId],
    queryFn: () => zenoApi.getPersistedRecommendation(caseId),
    enabled: Boolean(resolutionCase),
    retry: false,
  });

  const { data: actions = [] } = useQuery({
    queryKey: ['refill-actions', refillId],
    queryFn: () => zenoApi.getResolutionActions(caseId),
    enabled: Boolean(resolutionCase),
  });

  const { data: timeline = [] } = useQuery({
    queryKey: ['refill-timeline', refillId],
    queryFn: () => zenoApi.getRefillTimeline(refillId),
  });

  // Mutations
  const completeActionMutation = useMutation({
    mutationFn: ({ actionId, notes }: { actionId: number; notes: string }) =>
      zenoApi.completeAction(caseId, actionId, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['refill-actions', refillId] });
      queryClient.invalidateQueries({ queryKey: ['refill-timeline', refillId] });
      queryClient.invalidateQueries({ queryKey: ['refill', refillId] });
      setCompleteActionModal({ open: false, actionId: null });
      setActionNotes('');
    },
  });

  const resolveCaseMutation = useMutation({
    mutationFn: (summary: string) => zenoApi.resolveCase(caseId, summary),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['refill', refillId] });
      queryClient.invalidateQueries({ queryKey: ['refill-timeline', refillId] });
      setResolveModalOpen(false);
    },
  });

  const addActionMutation = useMutation({
    mutationFn: (dto: any) => zenoApi.createAction(caseId, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['refill-actions', refillId] });
      queryClient.invalidateQueries({ queryKey: ['refill-timeline', refillId] });
      setAddActionModalOpen(false);
      setNewActionDesc('');
    },
  });

  const completeRefillMutation = useMutation({
    mutationFn: () => zenoApi.completeRefill(refillId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['refill', refillId] });
      queryClient.invalidateQueries({ queryKey: ['refill-timeline', refillId] });
    },
  });

  if (refillLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-[var(--fg-muted)]">
        <RefreshCw className="w-6 h-6 animate-spin mr-2 text-[var(--accent)]" />
        Loading refill resolution hub...
      </div>
    );
  }

  if (!refill) {
    return (
      <div className="p-8 text-center text-[var(--fg-muted)]">
        <p>Refill case not found.</p>
        <Link to="/dashboard" className="text-[var(--accent)] underline mt-2 inline-block">Back to Dashboard</Link>
      </div>
    );
  }

  const rx = refill.prescription;

  return (
    <div className="space-y-6 pb-16">
      {/* ── Top Navigation Bar ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/dashboard"
            className="p-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-2)] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-[var(--fg-subtle)]">CASE #{refill.id}</span>
              <span className="text-xs text-[var(--fg-subtle)]">·</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[var(--surface-2)] text-[var(--fg-muted)]">
                {refill.pharmacy?.name || 'Valley Health Pharmacy'}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-[var(--fg)]">
              {rx?.medicationName}
            </h1>
          </div>
        </div>

        {/* Status Pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-indigo-500/15 text-indigo-400 border border-indigo-500/20">
            {refill.status.replace(/_/g, ' ')}
          </span>
          {refill.priority === 'URGENT' && (
            <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-rose-500/20 text-rose-400 border border-rose-500/30">
              URGENT
            </span>
          )}
        </div>
      </div>

      {/* ── "WHY IS THIS REFILL STUCK?" Root-Cause Hero Card ─────────────────── */}
      {refill.blockerType && (
        <div className="p-5 sm:p-6 rounded-2xl border border-red-500/30 bg-gradient-to-r from-red-950/20 via-[var(--surface)] to-[var(--surface)] relative overflow-hidden shadow-xs">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 relative z-10">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-red-500/20 text-red-400">
                  <AlertTriangle className="w-4 h-4" />
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-red-400">
                  Refill Blocker Identified
                </span>
              </div>
              <h2 className="text-lg font-bold text-[var(--fg)]">
                {formatBlockerTitle(refill.blockerType)}
              </h2>
              <p className="text-sm text-[var(--fg-muted)] max-w-2xl leading-relaxed">
                {formatBlockerExplanation(refill.blockerType, rx)}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setAddActionModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-[var(--surface-2)] text-[var(--fg)] hover:bg-[var(--surface-3)] border border-[var(--border)] transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Assign Action</span>
              </button>
              <button
                onClick={() => setResolveModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-500 transition-colors shadow-xs"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Mark Resolved</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {refill.blockerType && resolutionCase && (
        <section className="rounded-2xl border border-violet-500/25 bg-gradient-to-br from-violet-950/20 via-[var(--surface)] to-[var(--surface)] p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="rounded-xl bg-violet-500/15 p-2.5 text-violet-400"><Sparkles className="h-5 w-5" /></span>
              <div>
                <h2 className="font-semibold text-[var(--fg)]">Zeno Intelligence</h2>
                <p className="text-xs text-[var(--fg-muted)]">Operational guidance grounded in this refill’s current record.</p>
              </div>
            </div>
            <button
              onClick={() => recommendationMutation.mutate()}
              disabled={recommendationMutation.isPending}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-60"
            >
              <Sparkles className="h-4 w-4" />
              {recommendationMutation.isPending ? 'Reviewing workflow…' : 'Get workflow recommendation'}
            </button>
          </div>

          {recommendationMutation.error && (
            <p role="status" className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3 text-sm text-amber-300">
              AI assistance unavailable. Continue with the manual workflow.
            </p>
          )}
          {(recommendationMutation.data?.recommendation || savedRecommendation?.recommendation) && (() => {
            const rec = recommendationMutation.data?.recommendation || savedRecommendation?.recommendation;
            return (
              <div className="grid gap-4 border-t border-[var(--border)] pt-4 md:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-violet-300">Why this is blocked</p>
                  <p className="text-sm text-[var(--fg)]">{rec.blocker_explanation}</p>
                  <p className="text-xs text-[var(--fg-muted)]">Confidence {Math.round((rec.confidence ?? 0) * 100)}%</p>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-violet-300">Recommended next step</p>
                  <p className="text-sm text-[var(--fg)]">{rec.ui_next_step || rec.recommended_action}</p>
                  <p className="text-xs text-[var(--fg-muted)]">Owner: {rec.assigned_role?.replaceAll('_', ' ')}</p>
                  {rec.requires_human_approval && <p className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-300"><ShieldCheck className="h-3.5 w-3.5" /> Human review required</p>}
                </div>
                {rec.evidence?.length > 0 && <div className="md:col-span-2"><p className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--fg-muted)]">Supporting information</p><ul className="space-y-1">{rec.evidence.map((item: any, index: number) => <li key={`${item.source}-${index}`} className="text-xs text-[var(--fg-muted)]">• {item.statement} <span className="text-[var(--fg-subtle)]">({item.source})</span></li>)}</ul></div>}
              </div>
            );
          })()}
        </section>
      )}

      {/* ── Ready to Dispense Banner (When Resolved) ─────────────────────────── */}
      {refill.status === 'READY' && (
        <div className="p-5 rounded-2xl border border-emerald-500/30 bg-emerald-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-[var(--fg)]">All Blockers Resolved — Ready to Dispense</h3>
              <p className="text-xs text-[var(--fg-muted)]">Prescription verified and approved. Pharmacist may dispense.</p>
            </div>
          </div>
          <button
            onClick={() => completeRefillMutation.mutate()}
            disabled={completeRefillMutation.isPending}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-500 transition-colors shadow-xs shrink-0"
          >
            {completeRefillMutation.isPending ? 'Completing...' : 'Mark Medication Dispensed'}
          </button>
        </div>
      )}

      {/* ── Main Two-Column Layout ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Context Card + Human-In-The-Loop Actions */}
        <div className="lg:col-span-2 space-y-6">
          {/* Patient & Prescription Context */}
          <div className="p-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--fg-muted)]">
              Clinical & Prescription Context
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-[var(--surface-2)]/50 border border-[var(--border)]">
              <div>
                <span className="text-[11px] text-[var(--fg-subtle)] uppercase font-semibold">Patient</span>
                <p className="text-sm font-bold text-[var(--fg)]">{refill.patient?.firstName} {refill.patient?.lastName}</p>
                <p className="text-xs text-[var(--fg-muted)]">MRN: {refill.patient?.mrn || 'MRN-001'}</p>
              </div>
              <div>
                <span className="text-[11px] text-[var(--fg-subtle)] uppercase font-semibold">Prescribing Doctor</span>
                <p className="text-sm font-bold text-[var(--fg)]">Dr. {rx?.provider?.firstName} {rx?.provider?.lastName}</p>
                <p className="text-xs text-[var(--fg-muted)]">NPI: {rx?.provider?.npi || '1234567890'}</p>
              </div>
              <div>
                <span className="text-[11px] text-[var(--fg-subtle)] uppercase font-semibold">Authorized Refills</span>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <span className="text-base font-extrabold text-[var(--fg)]">{rx?.refillsUsed ?? 0}</span>
                  <span className="text-xs text-[var(--fg-muted)]">used of {rx?.refillsAllowed ?? 0} allowed</span>
                </div>
                <div className="w-full bg-[var(--surface-3)] h-1.5 rounded-full mt-1.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${(rx?.refillsUsed ?? 0) >= (rx?.refillsAllowed ?? 1) ? 'bg-red-500' : 'bg-[var(--accent)]'}`}
                    style={{ width: `${Math.min(100, (((rx?.refillsUsed ?? 0) / (rx?.refillsAllowed || 1)) * 100))}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="text-xs text-[var(--fg-muted)] space-y-1">
              <p><strong className="text-[var(--fg)]">Instructions:</strong> {rx?.instructions || 'Take as directed by physician'}</p>
              <p><strong className="text-[var(--fg)]">Quantity:</strong> {rx?.quantityDispensed || 30} units · {rx?.daysSupply || 30} days supply</p>
              <p><strong className="text-[var(--fg)]">Rx Number:</strong> {rx?.rxNumber || 'RX-10001'}</p>
            </div>
          </div>

          {/* Human-In-The-Loop Actions List */}
          <div className="p-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[var(--fg)]">Required Resolution Actions</h3>
                <p className="text-xs text-[var(--fg-muted)]">Dispatched tasks assigned to Pharmacy, Practice Staff, or Doctor</p>
              </div>
              <button
                onClick={() => setAddActionModalOpen(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-[var(--border)] text-[var(--accent)] hover:bg-[var(--surface-2)] transition-colors"
              >
                <Plus className="w-3 h-3" />
                <span>New Action</span>
              </button>
            </div>

            {actions.length === 0 ? (
              <div className="p-6 text-center text-xs text-[var(--fg-muted)] rounded-xl border border-dashed border-[var(--border)]">
                No pending actions. Click "New Action" or mark resolved.
              </div>
            ) : (
              <div className="space-y-3">
                {actions.map(action => (
                  <div
                    key={action.id}
                    className={`p-4 rounded-xl border transition-all ${
                      action.status === 'COMPLETED'
                        ? 'border-emerald-500/20 bg-emerald-950/10 opacity-75'
                        : 'border-[var(--border)] bg-[var(--surface-2)]/60'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {action.status === 'COMPLETED' ? (
                          <span className="p-1 rounded-full bg-emerald-500/20 text-emerald-400">
                            <Check className="w-3.5 h-3.5" />
                          </span>
                        ) : (
                          <span className="p-1 rounded-full bg-amber-500/20 text-amber-400">
                            <Clock className="w-3.5 h-3.5" />
                          </span>
                        )}
                        <span className="text-xs font-bold text-[var(--fg)]">
                          {formatActionType(action.actionType)}
                        </span>
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-[var(--surface-3)] text-[var(--fg-muted)]">
                          Assigned: {formatRoleBadge(action.assignedRole)}
                        </span>
                      </div>

                      {action.status !== 'COMPLETED' && (
                        <button
                          onClick={() => {
                            setCompleteActionModal({ open: true, actionId: action.id });
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold bg-[var(--accent)] text-white hover:opacity-90 transition-opacity"
                        >
                          <Check className="w-3 h-3" />
                          <span>Complete Task</span>
                        </button>
                      )}
                    </div>

                    <p className="mt-2 text-xs text-[var(--fg-muted)] pl-6">
                      {action.description}
                    </p>

                    {action.completionNotes && (
                      <div className="mt-2.5 ml-6 p-2.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-xs text-emerald-400/90 flex items-start gap-2">
                        <MessageSquare className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <div>
                          <strong className="text-[var(--fg)]">Completion Notes: </strong>
                          {action.completionNotes}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Immutable Audit Timeline */}
        <div className="space-y-6">
          <div className="p-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-[var(--border)]">
              <History className="w-4 h-4 text-[var(--accent)]" />
              <div>
                <h3 className="text-sm font-bold text-[var(--fg)]">Workflow Event Audit Trail</h3>
                <p className="text-[11px] text-[var(--fg-muted)]">Append-only state transition history</p>
              </div>
            </div>

            {timeline.length === 0 ? (
              <p className="text-xs text-[var(--fg-muted)] py-4 text-center">No timeline events recorded.</p>
            ) : (
              <div className="relative pl-6 space-y-5 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-[var(--border)]">
                {timeline.map((ev, idx) => (
                  <div key={ev.id || idx} className="relative">
                    {/* Dot */}
                    <div className="absolute -left-[23px] top-1 w-3 h-3 rounded-full bg-[var(--accent)] border-2 border-[var(--surface)]" />

                    <div className="space-y-0.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-[var(--fg)]">
                          {formatEventType(ev.eventType)}
                        </span>
                        <span className="text-[10px] text-[var(--fg-subtle)] font-mono">
                          {formatTimestamp(ev.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--fg-muted)] leading-relaxed">
                        {ev.description}
                      </p>
                      {ev.actorLabel && (
                        <p className="text-[10px] font-mono text-[var(--accent)]">
                          By: {ev.actorLabel}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Complete Action Modal ───────────────────────────────────────────── */}
      {completeActionModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md p-6 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[var(--fg)]">Complete Action</h3>
              <button
                onClick={() => setCompleteActionModal({ open: false, actionId: null })}
                className="p-1 rounded-lg text-[var(--fg-muted)] hover:text-[var(--fg)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-[var(--fg-muted)]">
              Document what occurred (e.g. physician verbal approval, clinic fax confirmation, prior auth reference number).
            </p>
            <textarea
              value={actionNotes}
              onChange={e => setActionNotes(e.target.value)}
              placeholder="e.g. Dr. Patel authorized 3 refills via phone on 09/27. Chart reviewed."
              rows={3}
              className="w-full p-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-xs text-[var(--fg)] focus:outline-hidden focus:border-[var(--accent)]"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setCompleteActionModal({ open: false, actionId: null })}
                className="px-3 py-2 rounded-xl text-xs font-medium text-[var(--fg-muted)] hover:bg-[var(--surface-2)]"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (completeActionModal.actionId) {
                    completeActionMutation.mutate({
                      actionId: completeActionModal.actionId,
                      notes: actionNotes || 'Task completed as requested.',
                    });
                  }
                }}
                disabled={completeActionMutation.isPending}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[var(--accent)] text-white hover:opacity-90"
              >
                {completeActionMutation.isPending ? 'Saving...' : 'Save & Advance'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Resolve Case Modal ──────────────────────────────────────────────── */}
      {resolveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md p-6 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[var(--fg)]">Mark Refill Case Resolved</h3>
              <button onClick={() => setResolveModalOpen(false)} className="p-1 rounded-lg text-[var(--fg-muted)] hover:text-[var(--fg)]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-[var(--fg-muted)]">
              Summarize the resolution. Marking resolved will clear the blocker and trigger re-triage to advance this refill to READY.
            </p>
            <textarea
              value={resolveSummary}
              onChange={e => setResolveSummary(e.target.value)}
              placeholder="e.g. Authorized 3 additional refills after chart review. Ready to dispense."
              rows={3}
              className="w-full p-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-xs text-[var(--fg)] focus:outline-hidden focus:border-[var(--accent)]"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setResolveModalOpen(false)} className="px-3 py-2 rounded-xl text-xs font-medium text-[var(--fg-muted)] hover:bg-[var(--surface-2)]">
                Cancel
              </button>
              <button
                onClick={() => resolveCaseMutation.mutate(resolveSummary || 'Case resolved by clinical staff.')}
                disabled={resolveCaseMutation.isPending}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-500"
              >
                {resolveCaseMutation.isPending ? 'Resolving...' : 'Confirm Resolution'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Action Modal ────────────────────────────────────────────────── */}
      {addActionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md p-6 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[var(--fg)]">Assign New Resolution Action</h3>
              <button onClick={() => setAddActionModalOpen(false)} className="p-1 rounded-lg text-[var(--fg-muted)] hover:text-[var(--fg)]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-[var(--fg-muted)] uppercase">Action Type</label>
                <select
                  value={newActionType}
                  onChange={e => setNewActionType(e.target.value)}
                  className="w-full mt-1 p-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-xs text-[var(--fg)]"
                >
                  <option value="REQUEST_PROVIDER_APPROVAL">Request Provider Approval</option>
                  <option value="REQUEST_MISSING_INFORMATION">Request Missing Clinical Information</option>
                  <option value="VERIFY_INSURANCE">Verify Insurance / Prior Auth</option>
                  <option value="CONTACT_PHARMACY">Contact Pharmacy</option>
                  <option value="FOLLOW_UP_WITH_PRACTICE">Follow Up With Clinic</option>
                  <option value="CONTACT_PATIENT">Contact Patient</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[var(--fg-muted)] uppercase">Assigned Role</label>
                <select
                  value={newActionRole}
                  onChange={e => setNewActionRole(e.target.value)}
                  className="w-full mt-1 p-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-xs text-[var(--fg)]"
                >
                  <option value="PROVIDER">Doctor / Provider</option>
                  <option value="PRACTICE_STAFF">Practice Staff / Nurse</option>
                  <option value="PHARMACIST">Pharmacist</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[var(--fg-muted)] uppercase">Description / Context</label>
                <textarea
                  value={newActionDesc}
                  onChange={e => setNewActionDesc(e.target.value)}
                  placeholder="Explain what needs to be verified or approved..."
                  rows={2}
                  className="w-full mt-1 p-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-xs text-[var(--fg)]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setAddActionModalOpen(false)} className="px-3 py-2 rounded-xl text-xs font-medium text-[var(--fg-muted)] hover:bg-[var(--surface-2)]">
                Cancel
              </button>
              <button
                onClick={() => addActionMutation.mutate({
                  actionType: newActionType,
                  assignedRole: newActionRole,
                  description: newActionDesc || 'Follow up on refill request requirement.',
                })}
                disabled={addActionMutation.isPending}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[var(--accent)] text-white hover:opacity-90"
              >
                {addActionMutation.isPending ? 'Creating...' : 'Assign Action'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatBlockerTitle(blocker?: string): string {
  switch (blocker) {
    case 'NO_REFILLS': return 'Authorized Refills Exhausted (Renewal Required)';
    case 'PROVIDER_APPROVAL_REQUIRED': return 'Doctor / Provider Clinical Approval Required';
    case 'NEW_PRESCRIPTION_REQUIRED': return 'Prescription Has Expired (New Rx Needed)';
    case 'MISSING_INFORMATION': return 'Missing Clinical / Patient Information';
    case 'INSURANCE_BLOCK': return 'Insurance / PBM Prior Authorization Blocker';
    case 'PHARMACY_ISSUE': return 'Pharmacy-Side Inventory or Formulary Blocker';
    default: return 'Workflow Blocker Identified';
  }
}

function formatBlockerExplanation(blocker?: string, rx?: any): string {
  switch (blocker) {
    case 'NO_REFILLS':
      return `This prescription has used all ${rx?.refillsAllowed ?? 3} authorized refills. A doctor or provider must authorize additional refills or issue a renewed prescription.`;
    case 'PROVIDER_APPROVAL_REQUIRED':
      return 'This medication requires direct clinical approval or prior authorization before the pharmacy can dispense it.';
    case 'NEW_PRESCRIPTION_REQUIRED':
      return 'The written prescription has passed its expiration date. Regulations require a fresh prescription from an authorized prescriber.';
    case 'MISSING_INFORMATION':
      return 'Critical prescription parameters (dosage, quantity, or patient chart info) are incomplete. Practice staff must review.';
    case 'INSURANCE_BLOCK':
      return 'The insurance/PBM claim was rejected or flagged for prior authorization review.';
    default:
      return 'A hand-off bottleneck is currently preventing fulfillment. Review assigned actions below to resolve.';
  }
}

function formatActionType(type: string): string {
  return type.replace(/_/g, ' ');
}

function formatRoleBadge(role?: string): string {
  switch (role) {
    case 'PROVIDER': return '🩺 Doctor / Provider';
    case 'PRACTICE_STAFF': return '📋 Practice Staff / Nurse';
    case 'PHARMACIST': return '💊 Pharmacist';
    default: return role || 'Staff';
  }
}

function formatEventType(type: string): string {
  return type.replace(/_/g, ' ');
}

function formatTimestamp(isoString?: string): string {
  if (!isoString) return 'Just now';
  const d = new Date(isoString);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' + d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
