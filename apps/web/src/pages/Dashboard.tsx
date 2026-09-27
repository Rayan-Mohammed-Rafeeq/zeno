import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { zenoApi } from '@/services/api/zenoApi';
import { useAuth } from '@/contexts/AuthContext';
import {
  Activity, AlertTriangle, ArrowRight, CheckCircle2, Clock,
  Flame, HeartPulse, Pill, RefreshCw, ShieldAlert, Sparkles, Stethoscope,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

export function Dashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [filterRole, setFilterRole] = useState<'ALL' | 'PROVIDER' | 'PRACTICE_STAFF' | 'PHARMACY' | 'URGENT'>('ALL');
  const [triageLoadingId, setTriageLoadingId] = useState<number | null>(null);

  // Queries
  const { data: summary, isLoading: summaryLoading, isError: summaryError, refetch: refetchSummary } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: () => zenoApi.getDashboardSummary(),
    refetchInterval: 15000,
  });

  const { data: refills = [], isLoading: refillsLoading, isError: refillsError, refetch: refetchRefills } = useQuery({
    queryKey: ['dashboard-refills'],
    queryFn: () => zenoApi.getDashboardRefills(),
    refetchInterval: 15000,
  });

  // Triage mutation
  const triageMutation = useMutation({
    mutationFn: (refillId: number) => zenoApi.triageRefill(refillId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-refills'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
    },
    onSettled: () => setTriageLoadingId(null),
  });

  const handleTriage = async (e: React.MouseEvent, refillId: number) => {
    e.preventDefault();
    e.stopPropagation();
    setTriageLoadingId(refillId);
    try {
      await triageMutation.mutateAsync(refillId);
    } catch (err) {
      console.error('Triage failed:', err);
    }
  };

  // Filter refills
  const filteredRefills = refills.filter(r => {
    if (filterRole === 'URGENT') return r.priority === 'URGENT' || r.priority === 'HIGH';
    if (filterRole === 'PROVIDER') return r.status === 'AWAITING_PROVIDER' || r.blocker === 'PROVIDER_APPROVAL_REQUIRED' || r.blocker === 'NO_REFILLS';
    if (filterRole === 'PRACTICE_STAFF') return r.status === 'AWAITING_PRACTICE' || r.status === 'ACTION_REQUIRED' || r.blocker === 'MISSING_INFORMATION';
    if (filterRole === 'PHARMACY') return r.status === 'AWAITING_PHARMACY' || r.status === 'READY' || r.blocker === 'PHARMACY_ISSUE';
    return true;
  });

  // Prepare chart data from blocker breakdown
  const blockerChartData = summary?.blockerBreakdown
    ? Object.entries(summary.blockerBreakdown).map(([key, count]) => ({
        name: key.replace(/_/g, ' '),
        shortName: formatBlockerShort(key),
        count,
        color: getBlockerColor(key),
      }))
    : [];

  return (
    <div className="space-y-6 pb-12">
      {/* ── Top Role Banner & Page Header ────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-[var(--surface)] to-[var(--surface-2)] border border-[var(--border)] relative overflow-hidden shadow-sm">
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-[var(--accent)] opacity-10 rounded-full blur-3xl pointer-events-none" />

        <div className="space-y-1 relative z-10">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/20">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
              Live Refill State Engine
            </span>
            <span className="text-xs text-[var(--fg-subtle)]">·</span>
            <span className="text-xs text-[var(--fg-muted)]">
              Logged in as <strong className="text-[var(--fg)]">{user?.name || user?.username || 'Team Member'}</strong>
              {user?.roleDisplayName && ` (${user.roleDisplayName})`}
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--fg)]">
            Prescription Refill Operations
          </h1>
          <p className="text-sm text-[var(--fg-muted)]">
            Real-time coordination across pharmacies, providers, and practice coordinators.
          </p>
        </div>

        <div className="flex items-center gap-3 relative z-10">
          <button
            onClick={() => refetchRefills()}
            className="p-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-2)] transition-colors shadow-xs"
            title="Refresh queue"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <Link
            to="/refills"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--accent)] text-white font-medium text-sm hover:opacity-90 transition-opacity shadow-[0_2px_12px_rgba(94,91,193,0.3)]"
          >
            <Pill className="w-4 h-4" />
            <span>Refill Requests</span>
          </Link>
        </div>
      </div>

      {(summaryError || refillsError) && (
        <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-rose-500/25 bg-rose-500/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-[var(--fg)]">Live workspace data could not be loaded</p>
            <p className="mt-1 text-xs text-[var(--fg-muted)]">Check that the API is running and your session is valid. No sample records are being shown.</p>
          </div>
          <button
            onClick={() => { void refetchSummary(); void refetchRefills(); }}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] px-3 py-2 text-xs font-semibold text-[var(--fg)] hover:bg-[var(--surface-2)]"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Try again
          </button>
        </div>
      )}

      {/* ── KPI Metric Cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Active Blocked Cases */}
        <div className="glass-card p-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xs relative overflow-hidden group hover:border-[var(--accent)]/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--fg-muted)] tracking-wider uppercase">Active Bottlenecks</span>
            <span className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
              <Activity className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-[var(--fg)]">
              {summaryLoading ? '—' : summary?.totalActive ?? 0}
            </span>
            <span className="text-xs text-[var(--fg-subtle)] font-medium">stuck refills</span>
          </div>
          <p className="mt-2 text-xs text-[var(--fg-muted)] flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
            Under coordinated resolution
          </p>
        </div>

        {/* Card 2: Awaiting Provider */}
        <div className="glass-card p-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xs relative overflow-hidden group hover:border-amber-500/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--fg-muted)] tracking-wider uppercase">Awaiting Doctor</span>
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
              <Stethoscope className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-amber-500">
              {summaryLoading ? '—' : summary?.awaitingProvider ?? 0}
            </span>
            <span className="text-xs text-[var(--fg-subtle)] font-medium">need doctor review</span>
          </div>
          <p className="mt-2 text-xs text-[var(--fg-muted)] flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Renewals & clinical approvals
          </p>
        </div>

        {/* Card 3: Awaiting Pharmacy / Insurance */}
        <div className="glass-card p-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xs relative overflow-hidden group hover:border-sky-500/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--fg-muted)] tracking-wider uppercase">Insurance & Pharmacy</span>
            <span className="p-2 rounded-xl bg-sky-500/10 text-sky-400">
              <ShieldAlert className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-sky-400">
              {summaryLoading ? '—' : (summary?.awaitingInsurance ?? 0) + (summary?.awaitingPharmacy ?? 0)}
            </span>
            <span className="text-xs text-[var(--fg-subtle)] font-medium">prior auth & stock</span>
          </div>
          <p className="mt-2 text-xs text-[var(--fg-muted)] flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
            Pending PBM / formulary action
          </p>
        </div>

        {/* Card 4: Urgent & Escalated */}
        <div className="glass-card p-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xs relative overflow-hidden group hover:border-rose-500/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--fg-muted)] tracking-wider uppercase">Urgent Escalations</span>
            <span className="p-2 rounded-xl bg-rose-500/10 text-rose-500">
              <Flame className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-rose-500">
              {summaryLoading ? '—' : summary?.escalated ?? 0}
            </span>
            <span className="text-xs text-[var(--fg-subtle)] font-medium">immediate attention</span>
          </div>
          <p className="mt-2 text-xs text-[var(--fg-muted)] flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            High clinical priority
          </p>
        </div>
      </div>

      {/* ── Workflow State Distribution & Quick Analytics ───────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Blocker Root-Cause Breakdown */}
        <div className="lg:col-span-2 p-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-[var(--fg)]">Why Refills Are Stuck (Root Cause Detection)</h2>
              <p className="text-xs text-[var(--fg-muted)]">Automatic categorization by Zeno deterministic triage engine</p>
            </div>
            <span className="text-xs font-medium px-2 py-1 rounded-md bg-[var(--surface-2)] text-[var(--fg-muted)]">
              {summaryLoading ? 'Loading cases…' : `${summary?.activeCases ?? 0} active cases`}
            </span>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={blockerChartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <XAxis dataKey="shortName" tick={{ fill: 'var(--fg-muted)', fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fill: 'var(--fg-muted)', fontSize: 11 }} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-xs shadow-xl space-y-1">
                          <p className="font-semibold text-[var(--fg)]">{data.name}</p>
                          <p className="text-[var(--accent)] font-medium">{data.count} refill cases blocked</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {blockerChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 3 Core Roles Summary Box */}
        <div className="p-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xs flex flex-col justify-between">
          <div>
            <h2 className="text-base font-semibold text-[var(--fg)]">Who Needs to Act?</h2>
            <p className="text-xs text-[var(--fg-muted)] mb-4">Action allocation across the 3 core personas</p>

            <div className="space-y-3">
              {/* Role 1: Pharmacist */}
              <div className="p-3 rounded-xl bg-[var(--surface-2)]/60 border border-[var(--border)] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-sky-500/15 text-sky-400 flex items-center justify-center font-bold text-xs">
                    💊
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-[var(--fg)]">Pharmacist</h4>
                    <p className="text-[11px] text-[var(--fg-muted)]">Prior auth, stock, dispensing</p>
                  </div>
                </div>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-400">
                  {summary?.awaitingPharmacy ?? 0}
                </span>
              </div>

              {/* Role 2: Practice Staff / Nurse */}
              <div className="p-3 rounded-xl bg-[var(--surface-2)]/60 border border-[var(--border)] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/15 text-purple-400 flex items-center justify-center font-bold text-xs">
                    📋
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-[var(--fg)]">Practice Staff / Nurse</h4>
                    <p className="text-[11px] text-[var(--fg-muted)]">Lab results, visits, chart intake</p>
                  </div>
                </div>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400">
                  {summary?.awaitingPractice ?? 0}
                </span>
              </div>

              {/* Role 3: Doctor / Provider */}
              <div className="p-3 rounded-xl bg-[var(--surface-2)]/60 border border-[var(--border)] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center font-bold text-xs">
                    🩺
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-[var(--fg)]">Doctor / Provider</h4>
                    <p className="text-[11px] text-[var(--fg-muted)]">Prescription renewal, approvals</p>
                  </div>
                </div>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400">
                  {summary?.awaitingProvider ?? 0}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[var(--border)] text-[11px] text-[var(--fg-subtle)] flex items-center gap-1.5">
            <HeartPulse className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />
            <span>Clinical decisions remain 100% human-controlled.</span>
          </div>
        </div>
      </div>

      {/* ── Active Refill Resolution Queue ───────────────────────────────────── */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xs overflow-hidden">
        {/* Table Header & Filters */}
        <div className="p-4 sm:p-5 border-b border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-[var(--fg)]">Active Refill Resolution Queue</h2>
            <p className="text-xs text-[var(--fg-muted)]">
              Showing refills awaiting provider approval, practice follow-up, or pharmacy action
            </p>
          </div>

          {/* Persona Filter Tabs */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--surface-2)] text-xs border border-[var(--border)] overflow-x-auto">
            <button
              onClick={() => setFilterRole('ALL')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${filterRole === 'ALL' ? 'bg-[var(--surface)] text-[var(--fg)] shadow-xs' : 'text-[var(--fg-muted)] hover:text-[var(--fg)]'}`}
            >
              All ({refills.length})
            </button>
            <button
              onClick={() => setFilterRole('PROVIDER')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1 ${filterRole === 'PROVIDER' ? 'bg-[var(--surface)] text-amber-500 shadow-xs' : 'text-[var(--fg-muted)] hover:text-[var(--fg)]'}`}
            >
              <span>🩺 Doctor</span>
            </button>
            <button
              onClick={() => setFilterRole('PRACTICE_STAFF')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1 ${filterRole === 'PRACTICE_STAFF' ? 'bg-[var(--surface)] text-purple-400 shadow-xs' : 'text-[var(--fg-muted)] hover:text-[var(--fg)]'}`}
            >
              <span>📋 Nurse/Staff</span>
            </button>
            <button
              onClick={() => setFilterRole('PHARMACY')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1 ${filterRole === 'PHARMACY' ? 'bg-[var(--surface)] text-sky-400 shadow-xs' : 'text-[var(--fg-muted)] hover:text-[var(--fg)]'}`}
            >
              <span>💊 Pharmacy</span>
            </button>
            <button
              onClick={() => setFilterRole('URGENT')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1 ${filterRole === 'URGENT' ? 'bg-[var(--surface)] text-rose-500 shadow-xs' : 'text-[var(--fg-muted)] hover:text-[var(--fg)]'}`}
            >
              <span>🔥 Urgent</span>
            </button>
          </div>
        </div>

        {/* Queue Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--surface-2)]/40 text-[11px] font-semibold text-[var(--fg-muted)] uppercase tracking-wider border-b border-[var(--border)]">
              <tr>
                <th className="py-3 px-4">Refill & Patient</th>
                <th className="py-3 px-4">Medication</th>
                <th className="py-3 px-4">Workflow Status</th>
                <th className="py-3 px-4">Detected Blocker</th>
                <th className="py-3 px-4">Priority</th>
                <th className="py-3 px-4">Waiting Since</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {refillsLoading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-[var(--fg-muted)]">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[var(--accent)]" />
                    Loading refill queue...
                  </td>
                </tr>
              ) : filteredRefills.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-[var(--fg-muted)]">
                    <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500 opacity-60" />
                    No blocked refills in this view.
                  </td>
                </tr>
              ) : (
                filteredRefills.map(r => (
                  <tr key={r.refillId} className="hover:bg-[var(--surface-2)]/50 transition-colors group">
                    {/* Patient & ID */}
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-[var(--fg)]">{r.patientName}</div>
                      <div className="text-xs text-[var(--fg-subtle)]">Case #{r.refillId} · {r.pharmacyName}</div>
                    </td>

                    {/* Medication */}
                    <td className="py-3.5 px-4 font-medium text-[var(--fg)]">
                      {r.medicationName}
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4">
                      <StatusBadge status={r.status} />
                    </td>

                    {/* Blocker */}
                    <td className="py-3.5 px-4">
                      {r.blocker ? (
                        <BlockerBadge blocker={r.blocker} />
                      ) : (
                        <span className="text-xs text-[var(--fg-subtle)]">— None (Ready) —</span>
                      )}
                    </td>

                    {/* Priority */}
                    <td className="py-3.5 px-4">
                      <PriorityBadge priority={r.priority} />
                    </td>

                    {/* Waiting Since */}
                    <td className="py-3.5 px-4 text-xs text-[var(--fg-muted)]">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-[var(--fg-subtle)]" />
                        <span>{formatTimeAgo(r.waitingSince)}</span>
                      </div>
                    </td>

                    {/* Action Links */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {r.status === 'REQUESTED' && (
                          <button
                            onClick={e => handleTriage(e, r.refillId)}
                            disabled={triageLoadingId === r.refillId}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[var(--accent)] text-white hover:opacity-90 transition-opacity"
                          >
                            <Sparkles className="w-3 h-3" />
                            <span>{triageLoadingId === r.refillId ? 'Triaging...' : 'Triage'}</span>
                          </button>
                        )}
                        <Link
                          to={`/refills/${r.refillId}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--border)] bg-[var(--surface-2)]/60 text-[var(--fg)] hover:border-[var(--accent)] transition-colors"
                        >
                          <span>Open Hub</span>
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Status & Blocker Helpers ──────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; text: string; label: string }> = {
    REQUESTED: { bg: 'bg-zinc-500/15', text: 'text-zinc-400', label: 'Requested' },
    UNDER_REVIEW: { bg: 'bg-blue-500/15', text: 'text-blue-400', label: 'Under Review' },
    AWAITING_PROVIDER: { bg: 'bg-amber-500/15', text: 'text-amber-400', label: 'Doctor Review' },
    AWAITING_PRACTICE: { bg: 'bg-purple-500/15', text: 'text-purple-400', label: 'Practice Action' },
    AWAITING_PHARMACY: { bg: 'bg-sky-500/15', text: 'text-sky-400', label: 'Pharmacy Action' },
    AWAITING_INSURANCE: { bg: 'bg-indigo-500/15', text: 'text-indigo-400', label: 'Insurance / PBM' },
    READY: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', label: 'Ready to Dispense' },
    COMPLETED: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', label: 'Completed' },
    ESCALATED: { bg: 'bg-rose-500/15', text: 'text-rose-400', label: 'Escalated' },
    ACTION_REQUIRED: { bg: 'bg-orange-500/15', text: 'text-orange-400', label: 'Action Required' },
  };

  const item = styles[status] || { bg: 'bg-zinc-500/15', text: 'text-zinc-400', label: status };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${item.bg} ${item.text}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {item.label}
    </span>
  );
}

function BlockerBadge({ blocker }: { blocker: string }) {
  const labels: Record<string, string> = {
    NO_REFILLS: 'Out of Refills',
    PROVIDER_APPROVAL_REQUIRED: 'Provider Approval Req.',
    NEW_PRESCRIPTION_REQUIRED: 'New Rx Required',
    VISIT_REQUIRED: 'Visit Required',
    MISSING_INFORMATION: 'Missing Clinical Info',
    INSURANCE_BLOCK: 'Insurance Blocked',
    PHARMACY_ISSUE: 'Pharmacy Stock Issue',
  };

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
      <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />
      {labels[blocker] || blocker}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  if (priority === 'URGENT') {
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-rose-500/20 text-rose-400">URGENT</span>;
  }
  if (priority === 'HIGH') {
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-amber-500/20 text-amber-400">HIGH</span>;
  }
  return <span className="text-xs text-[var(--fg-muted)]">Normal</span>;
}

function formatBlockerShort(blocker: string): string {
  const map: Record<string, string> = {
    NO_REFILLS: 'No Refills',
    PROVIDER_APPROVAL_REQUIRED: 'Provider Req',
    NEW_PRESCRIPTION_REQUIRED: 'Expired Rx',
    MISSING_INFORMATION: 'Missing Info',
    INSURANCE_BLOCK: 'Insurance',
    PHARMACY_ISSUE: 'Pharmacy',
  };
  return map[blocker] || blocker;
}

function getBlockerColor(blocker: string): string {
  const map: Record<string, string> = {
    NO_REFILLS: '#f59e0b',
    PROVIDER_APPROVAL_REQUIRED: '#8588e6',
    NEW_PRESCRIPTION_REQUIRED: '#ef4444',
    MISSING_INFORMATION: '#fbbf24',
    INSURANCE_BLOCK: '#38bdf8',
    PHARMACY_ISSUE: '#a855f7',
  };
  return map[blocker] || '#5e5bc1';
}

function formatTimeAgo(isoString?: string): string {
  if (!isoString) return 'Just now';
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffHours = Math.floor(diffMs / 3600000);
  if (diffHours < 1) return '30m ago';
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}
