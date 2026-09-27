import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { zenoApi } from '@/services/api/zenoApi';
import { useAuth } from '@/contexts/AuthContext';
import {
  ArrowLeft, CheckCircle2, Clock, AlertTriangle, Check, Plus,
  History, RefreshCw, X, MessageSquare, Sparkles, ShieldCheck,
  Stethoscope, Send
} from 'lucide-react';

const AI_DEMO_ACCOUNTS = new Set([
  'demo.provider', 'demo.staff', 'demo.pharmacist',
  'dr.patel', 'dr.williams', 'lisa.martinez', 'sarah.chen', 'mike.johnson',
]);

export function RefillDetail() {
  const { id } = useParams<{ id: string }>();
  const refillId = Number(id);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const autoRequestedCases = useRef(new Set<number>());
  const isDemoAccount = AI_DEMO_ACCOUNTS.has(user?.username ?? '');
  const isProvider = user?.role === 'PROVIDER' || user?.role === 'ADMIN';
  const isPharmacist = user?.role === 'PHARMACIST' || user?.role === 'PHARMACY_STAFF';

  // Modals state
  const [completeActionModal, setCompleteActionModal] = useState<{ open: boolean; actionId: number | null }>({ open: false, actionId: null });
  const [actionNotes, setActionNotes] = useState('');
  const [resolveModalOpen, setResolveModalOpen] = useState(false);
  const [resolveSummary, setResolveSummary] = useState('');
  const [addActionModalOpen, setAddActionModalOpen] = useState(false);
  const [newActionType, setNewActionType] = useState('REQUEST_PROVIDER_APPROVAL');
  const [newActionRole, setNewActionRole] = useState('PRACTICE_STAFF');
  const [newActionDesc, setNewActionDesc] = useState('');

  // Option B: Doctor authorization & nurse delegation states
  const [doctorPrescribeModalOpen, setDoctorPrescribeModalOpen] = useState(false);
  const [forwardToDoctorModalOpen, setForwardToDoctorModalOpen] = useState(false);
  const defaultNextYear = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const [newExpiryDate, setNewExpiryDate] = useState(defaultNextYear);
  const [newRefillsAllowed, setNewRefillsAllowed] = useState(3);
  const [newRxNumber, setNewRxNumber] = useState('');
  const [doctorSignNotes, setDoctorSignNotes] = useState('Reviewed patient chart and clinical response. Authorized renewed prescription for 1 year with 3 refills.');
  const [forwardNotes, setForwardNotes] = useState('Chart and adherence reviewed. Patient stable on maintenance therapy. Forwarding to provider for renewed prescription authorization.');

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

  useEffect(() => {
    const needsRecommendation = Boolean(
      isDemoAccount && refill?.blockerType &&
      refill.status !== 'COMPLETED' && refill.status !== 'CANCELLED' && resolutionCase &&
      savedRecommendation && !savedRecommendation.available && !savedRecommendation.recommendation,
    );
    if (!needsRecommendation || autoRequestedCases.current.has(caseId)) return;

    autoRequestedCases.current.add(caseId);
    recommendationMutation.mutate();
  }, [
    caseId,
    isDemoAccount,
    recommendationMutation.mutate,
    refill?.blockerType,
    refill?.status,
    resolutionCase,
    savedRecommendation,
  ]);

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

  useEffect(() => {
    const rxNumber = refill?.prescription?.rxNumber;
    if (rxNumber && !newRxNumber) {
      setNewRxNumber(`${rxNumber}-REN`);
    }
  }, [refill?.prescription?.rxNumber, newRxNumber]);

  const resolveCaseMutation = useMutation({
    mutationFn: (payload: string | { resolutionSummary: string; newExpiryDate?: string; newRefillsAllowed?: number; newRxNumber?: string }) =>
      zenoApi.resolveCase(caseId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['refill', refillId] });
      queryClient.invalidateQueries({ queryKey: ['refill-timeline', refillId] });
      setResolveModalOpen(false);
      setDoctorPrescribeModalOpen(false);
    },
  });

  const addActionMutation = useMutation({
    mutationFn: (dto: any) => zenoApi.createAction(caseId, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['refill-actions', refillId] });
      queryClient.invalidateQueries({ queryKey: ['refill-timeline', refillId] });
      setAddActionModalOpen(false);
      setForwardToDoctorModalOpen(false);
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
  const prescriberName = rx?.provider
    ? `Dr. ${rx.provider.firstName} ${rx.provider.lastName}`
    : 'Dr. Arun Patel';
  const prescriberNpi = rx?.provider?.npi || '1982736450';

  const isPrimaryPrescriber = isProvider && Boolean(
    user?.username === 'dr.patel' ||
    (rx?.provider?.lastName && user?.name?.toLowerCase().includes(rx.provider.lastName.toLowerCase())) ||
    (rx?.provider?.lastName && user?.username?.toLowerCase().includes(rx.provider.lastName.toLowerCase())) ||
    user?.role === 'ADMIN'
  );

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
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <button
                onClick={() => setAddActionModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-[var(--surface-2)] text-[var(--fg)] hover:bg-[var(--surface-3)] border border-[var(--border)] transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Assign Action</span>
              </button>

              {refill.blockerType === 'NEW_PRESCRIPTION_REQUIRED' ? (
                <>
                  {!isProvider ? (
                    <button
                      onClick={() => setForwardToDoctorModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-500 transition-colors shadow-xs"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{isPharmacist ? 'Request Renewal from Prescriber' : 'Forward to Doctor'}</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => setDoctorPrescribeModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-500 transition-colors shadow-xs"
                      title="Authorize & Issue New Prescription"
                    >
                      <Stethoscope className="w-3.5 h-3.5" />
                      <span>Authorize & Issue New Rx</span>
                    </button>
                  )}
                </>
              ) : (
                <button
                  onClick={() => setResolveModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-500 transition-colors shadow-xs"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Mark Resolved</span>
                </button>
              )}
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
                {isDemoAccount && savedRecommendation?.recommendation && (
                  <p className="text-[11px] text-violet-300">Demo recommendation · human review required</p>
                )}
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
                          {action.assignedUser && ` · ${action.assignedUser.firstName} ${action.assignedUser.lastName}`}
                        </span>
                      </div>

                      {action.status !== 'COMPLETED' && (
                        action.actionType === 'REQUEST_NEW_PRESCRIPTION' && isProvider ? (
                          <button
                            onClick={() => {
                              setDoctorPrescribeModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-500 transition-colors shadow-xs"
                          >
                            <Stethoscope className="w-3.5 h-3.5" />
                            <span>Authorize & Sign Rx</span>
                          </button>
                        ) : action.assignedRole === 'PROVIDER' && !isProvider ? (
                          <span
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20"
                            title="Clinical sign-off reserved for licensed prescribers (Doctor / Provider)."
                          >
                            <Clock className="w-3 h-3 text-amber-400" />
                            <span>Prescriber Sign-off Required</span>
                          </span>
                        ) : (
                          <button
                            onClick={() => {
                              setCompleteActionModal({ open: true, actionId: action.id });
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold bg-[var(--accent)] text-white hover:opacity-90 transition-opacity"
                          >
                            <Check className="w-3 h-3" />
                            <span>Complete Task</span>
                          </button>
                        )
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
                        {(ev.actorLabel === 'triage-engine' || ev.actorLabel?.startsWith('Automated ')) && (
                          <span className="rounded-full border border-sky-400/25 bg-sky-400/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-sky-300">
                            Automated
                          </span>
                        )}
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
                onClick={() => {
                  completeActionMutation.reset();
                  setCompleteActionModal({ open: false, actionId: null });
                }}
                className="p-1 rounded-lg text-[var(--fg-muted)] hover:text-[var(--fg)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-[var(--fg-muted)]">
              Document what occurred (e.g. physician verbal approval, clinic fax confirmation, prior auth reference number).
            </p>

            {completeActionMutation.error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                <div>
                  <strong className="font-semibold block text-rose-400">Action Notice</strong>
                  <span>{(completeActionMutation.error as Error)?.message || 'Unable to complete action.'}</span>
                </div>
              </div>
            )}

            <textarea
              value={actionNotes}
              onChange={e => setActionNotes(e.target.value)}
              placeholder="e.g. Dr. Patel authorized 3 refills via phone on 09/27. Chart reviewed."
              rows={3}
              className="w-full p-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-xs text-[var(--fg)] focus:outline-hidden focus:border-[var(--accent)]"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  completeActionMutation.reset();
                  setCompleteActionModal({ open: false, actionId: null });
                }}
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
              <button
                onClick={() => {
                  resolveCaseMutation.reset();
                  setResolveModalOpen(false);
                }}
                className="p-1 rounded-lg text-[var(--fg-muted)] hover:text-[var(--fg)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-[var(--fg-muted)]">
              Summarize the resolution. Marking resolved will clear the blocker and trigger re-triage to advance this refill to READY.
            </p>

            {refill.blockerType === 'NEW_PRESCRIPTION_REQUIRED' && !isProvider && (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200 space-y-2">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                  <div>
                    <strong className="block font-semibold text-amber-400">Prescriber Sign-off Required (Option B)</strong>
                    <span>This refill requires a renewed prescription from {prescriberName}. Under clinical regulations, {isPharmacist ? 'pharmacists' : 'nursing staff'} cannot resolve this case directly. Please route this request to the doctor.</span>
                  </div>
                </div>
                <div className="pt-1">
                  <button
                    onClick={() => {
                      resolveCaseMutation.reset();
                      setResolveModalOpen(false);
                      setForwardToDoctorModalOpen(true);
                    }}
                    className="w-full py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Switch to: {isPharmacist ? 'Request Renewal from Doctor' : 'Forward to Doctor Queue'}</span>
                  </button>
                </div>
              </div>
            )}

            {resolveCaseMutation.error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                <div>
                  <strong className="font-semibold block text-rose-400">Action Notice</strong>
                  <span>{(resolveCaseMutation.error as Error)?.message || 'Unable to resolve case.'}</span>
                </div>
              </div>
            )}

            <textarea
              value={resolveSummary}
              onChange={e => setResolveSummary(e.target.value)}
              placeholder="e.g. Authorized 3 additional refills after chart review. Ready to dispense."
              rows={3}
              className="w-full p-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-xs text-[var(--fg)] focus:outline-hidden focus:border-[var(--accent)]"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  resolveCaseMutation.reset();
                  setResolveModalOpen(false);
                }}
                className="px-3 py-2 rounded-xl text-xs font-medium text-[var(--fg-muted)] hover:bg-[var(--surface-2)]"
              >
                Cancel
              </button>
              <button
                onClick={() => resolveCaseMutation.mutate(resolveSummary || 'Case resolved by clinical staff.')}
                disabled={resolveCaseMutation.isPending || (refill.blockerType === 'NEW_PRESCRIPTION_REQUIRED' && !isProvider)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resolveCaseMutation.isPending ? 'Resolving...' : 'Confirm Resolution'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Forward to Doctor Modal (Nursing Delegation Flow - Option B) ────────── */}
      {forwardToDoctorModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-lg p-6 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400">
                  <Send className="w-4 h-4" />
                </span>
                <h3 className="text-base font-bold text-[var(--fg)]">
                  {isPharmacist ? 'Request Prescription Renewal from Prescriber' : 'Forward to Doctor for Prescription Authorization'}
                </h3>
              </div>
              <button
                onClick={() => {
                  addActionMutation.reset();
                  setForwardToDoctorModalOpen(false);
                }}
                className="p-1 rounded-lg text-[var(--fg-muted)] hover:text-[var(--fg)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300 leading-relaxed">
              <strong className="text-white block mb-0.5">Clinical Protocol (Option B):</strong>
              {isPharmacist ? (
                <span>This prescription has expired. Under pharmacy practice acts, pharmacists cannot write or prescribe new orders. Submit a formal renewal request to the prescriber (Doctor) to authorize a new prescription before dispensing.</span>
              ) : (
                <span>This prescription has expired. Healthcare regulations require a licensed prescriber (Doctor / Provider) to authorize and issue a renewed prescription. As clinical staff, submit your chart review notes to queue this order for provider sign-off.</span>
              )}
            </div>

            {addActionMutation.error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                <div>
                  <strong className="font-semibold block text-rose-400">Forwarding Notice</strong>
                  <span>{(addActionMutation.error as Error)?.message || 'Unable to route request to prescriber.'}</span>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs space-y-1">
                <div className="flex justify-between text-[var(--fg-muted)]">
                  <span>Assigned Doctor:</span>
                  <span className="font-semibold text-[var(--fg)]">{prescriberName} (NPI: {prescriberNpi})</span>
                </div>
                <div className="flex justify-between text-[var(--fg-muted)]">
                  <span>Medication:</span>
                  <span className="font-semibold text-[var(--fg)]">{rx?.medicationName}</span>
                </div>
                <div className="flex justify-between text-[var(--fg-muted)]">
                  <span>Patient:</span>
                  <span className="font-semibold text-[var(--fg)]">{refill.patient?.firstName} {refill.patient?.lastName} (MRN: {refill.patient?.mrn || 'MRN-001'})</span>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[var(--fg-muted)] uppercase">
                  {isPharmacist ? 'Pharmacy Renewal Request Notes' : 'Clinical Chart Review & Triage Notes'}
                </label>
                <textarea
                  value={forwardNotes}
                  onChange={e => setForwardNotes(e.target.value)}
                  placeholder={
                    isPharmacist
                      ? 'e.g. Patient requests 30-day refill at pharmacy counter. Prescription expired. Forwarding renewal request to clinic provider.'
                      : 'e.g. Chart and adherence reviewed. Patient stable on maintenance therapy. Requesting renewed 1-year prescription with 3 refills.'
                  }
                  rows={3}
                  className="w-full mt-1 p-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-xs text-[var(--fg)] focus:outline-hidden focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  addActionMutation.reset();
                  setForwardToDoctorModalOpen(false);
                }}
                className="px-3 py-2 rounded-xl text-xs font-medium text-[var(--fg-muted)] hover:bg-[var(--surface-2)]"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  addActionMutation.mutate({
                    actionType: 'REQUEST_NEW_PRESCRIPTION',
                    assignedRole: 'PROVIDER',
                    description: forwardNotes || (isPharmacist
                      ? 'Pharmacy requests renewed prescription authorization from provider.'
                      : 'Patient requires new prescription authorization. Chart reviewed and forwarded by practice staff.'
                    ),
                  });
                }}
                disabled={addActionMutation.isPending}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-500 shadow-xs"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{addActionMutation.isPending ? 'Routing...' : (isPharmacist ? 'Send Renewal Request to Doctor' : 'Forward to Doctor Queue')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Doctor Prescription Authorization Modal (Option B Sign-off) ───── */}
      {doctorPrescribeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-lg p-6 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                  <Stethoscope className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-[var(--fg)]">Doctor Prescription Authorization</h3>
                  <p className="text-[11px] text-[var(--fg-muted)]">Option B: Clinical Prescriber Sign-off & Rx Issuance</p>
                </div>
              </div>
              <button
                onClick={() => {
                  resolveCaseMutation.reset();
                  setDoctorPrescribeModalOpen(false);
                }}
                className="p-1 rounded-lg text-[var(--fg-muted)] hover:text-[var(--fg)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Context Summary */}
            <div className="p-3.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-[var(--fg-muted)]">Patient:</span>
                <span className="font-bold text-[var(--fg)]">{refill.patient?.firstName} {refill.patient?.lastName} (MRN: {refill.patient?.mrn || 'MRN-001'})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--fg-muted)]">Medication:</span>
                <span className="font-bold text-emerald-400">{rx?.medicationName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--fg-muted)]">Prescribing Doctor:</span>
                <span className="font-semibold text-[var(--fg)]">{prescriberName} (NPI: {prescriberNpi})</span>
              </div>
            </div>

            {/* Prescriptive Authority Status Notice */}
            {isPrimaryPrescriber ? (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
                <div>
                  <strong className="block font-semibold text-emerald-400">Primary Prescriber of Record</strong>
                  <span>You are signed in with prescriptive authority as {prescriberName}. You hold authority to renew and authorize this order.</span>
                </div>
              </div>
            ) : isProvider ? (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                <div>
                  <strong className="block font-semibold text-amber-400">Cross-Coverage Authorization Protocol</strong>
                  <span>Primary prescriber on file is {prescriberName}. You ({user?.name || user?.username}) are signing under practice cross-coverage authorization. Your provider credentials will be recorded in the audit trail.</span>
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-200 space-y-2">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                  <div>
                    <strong className="block font-semibold text-rose-400">Prescriptive Authority Required</strong>
                    <span>This medication was prescribed by {prescriberName}. Under state medical licensing regulations, {isPharmacist ? 'pharmacists' : 'practice staff / nurses'} cannot independently write or authorize new prescriptions. Please forward this renewal request to {prescriberName}.</span>
                  </div>
                </div>
                <div className="pt-1">
                  <button
                    onClick={() => {
                      resolveCaseMutation.reset();
                      setDoctorPrescribeModalOpen(false);
                      setForwardToDoctorModalOpen(true);
                    }}
                    className="w-full py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Switch to: {isPharmacist ? 'Request Renewal from Doctor' : 'Forward to Doctor Queue'}</span>
                  </button>
                </div>
              </div>
            )}

            {resolveCaseMutation.error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                <div>
                  <strong className="font-semibold block text-rose-400">Authorization Notice</strong>
                  <span>{(resolveCaseMutation.error as Error)?.message || 'Prescription authorization could not be completed.'}</span>
                </div>
              </div>
            )}

            {/* Form Fields */}
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-[var(--fg-muted)] uppercase">New Expiration Date</label>
                  <input
                    type="date"
                    value={newExpiryDate}
                    onChange={e => setNewExpiryDate(e.target.value)}
                    className="w-full mt-1 p-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-xs text-[var(--fg)] focus:outline-hidden focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[var(--fg-muted)] uppercase">Refills Authorized</label>
                  <select
                    value={newRefillsAllowed}
                    onChange={e => setNewRefillsAllowed(Number(e.target.value))}
                    className="w-full mt-1 p-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-xs text-[var(--fg)] focus:outline-hidden focus:border-emerald-500"
                  >
                    <option value={1}>1 refill (30-60 days)</option>
                    <option value={2}>2 refills (90 days)</option>
                    <option value={3}>3 refills (120 days)</option>
                    <option value={5}>5 refills (6 months)</option>
                    <option value={11}>11 refills (1 year)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[var(--fg-muted)] uppercase">Renewed Rx Number / e-Prescription ID</label>
                <input
                  type="text"
                  value={newRxNumber}
                  onChange={e => setNewRxNumber(e.target.value)}
                  placeholder="e.g. RX-10001-REN"
                  className="w-full mt-1 p-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-xs text-[var(--fg)] focus:outline-hidden focus:border-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[var(--fg-muted)] uppercase">Prescriber Clinical Sign-off Notes</label>
                <textarea
                  value={doctorSignNotes}
                  onChange={e => setDoctorSignNotes(e.target.value)}
                  placeholder="e.g. Reviewed patient chart and clinical response. Authorized renewed prescription for 1 year with 3 refills."
                  rows={2}
                  className="w-full mt-1 p-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-xs text-[var(--fg)] focus:outline-hidden focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  resolveCaseMutation.reset();
                  setDoctorPrescribeModalOpen(false);
                }}
                className="px-3 py-2 rounded-xl text-xs font-medium text-[var(--fg-muted)] hover:bg-[var(--surface-2)]"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  resolveCaseMutation.mutate({
                    resolutionSummary: doctorSignNotes || `Authorized renewed prescription valid until ${newExpiryDate} with ${newRefillsAllowed} refills.`,
                    newExpiryDate,
                    newRefillsAllowed,
                    newRxNumber: newRxNumber || (rx?.rxNumber ? `${rx.rxNumber}-REN` : undefined),
                  });
                }}
                disabled={resolveCaseMutation.isPending || !isProvider}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{resolveCaseMutation.isPending ? 'Authorizing...' : 'Authorize & Sign Prescription'}</span>
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
                  <option value="REQUEST_NEW_PRESCRIPTION">Request New Prescription (Expired Rx)</option>
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
  const labels: Record<string, string> = {
    REQUEST_NEW_PRESCRIPTION:   'Request New Prescription (Expired Rx)',
    REQUEST_PROVIDER_APPROVAL:  'Request Provider Approval',
    REQUEST_PROVIDER_REVIEW:    'Request Provider Review',
    REQUEST_MISSING_INFORMATION:'Request Missing Clinical Information',
    VERIFY_INSURANCE:           'Verify Insurance / Prior Auth',
    PRIOR_AUTH_REQUEST:         'Prior Authorization Request',
    CONTACT_PHARMACY:           'Contact Pharmacy',
    FOLLOW_UP_WITH_PRACTICE:    'Follow Up With Clinic',
    CONTACT_PATIENT:            'Contact Patient',
    VERIFY_RESOLUTION:          'Verify Resolution',
    ESCALATE_CASE:              'Escalate Case',
    OTHER:                      'Other',
  };
  return labels[type] ?? type.replace(/_/g, ' ');
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
  const labels: Record<string, string> = {
    REFILL_REQUESTED:             'Refill Requested',
    REFILL_UNDER_REVIEW:          'Triage Started',
    BLOCKER_IDENTIFIED:           'Blocker Identified',
    REFILL_READY:                 'Ready to Dispense',
    REFILL_COMPLETED:             'Refill Dispensed',
    CASE_CREATED:                 'Resolution Case Opened',
    CASE_RESOLVED:                'Case Resolved',
    CASE_ESCALATED:               'Case Escalated',
    ACTION_CREATED:               'Action Assigned',
    ACTION_COMPLETED:             'Action Completed',
    AI_RECOMMENDATION_RECEIVED:   'AI Recommendation Received',
  };
  return labels[type] ?? type.replace(/_/g, ' ');
}

function formatTimestamp(isoString?: string): string {
  if (!isoString) return 'Just now';
  const d = new Date(isoString);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' + d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
