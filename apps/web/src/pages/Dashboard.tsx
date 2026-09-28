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
  const [filterRole, setFilterRole] = useState<'ALL' | 'PROVIDER' | 'PRACTICE_STAFF' | 'PHARMACY' | 'URGENT'>(() => {
    if (user?.role === 'PROVIDER') return 'PROVIDER';
    if (user?.role === 'PRACTICE_STAFF') return 'PRACTICE_STAFF';
    if (user?.role === 'PHARMACIST' || user?.role === 'PHARMACY_STAFF') return 'PHARMACY';
    return 'ALL';
  });
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-r from-[var(--surface)] via-[var(--surface-2)]/60 to-[var(--surface)] border border-[var(--border)] relative overflow-hidden shadow-sm backdrop-blur-xl">
        <div className="absolute -top-16 -right-16 w-64 h-64 bg-[var(--accent)] opacity-10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-64 h-64 bg-indigo-500 opacity-10 rounded-full blur-3xl pointer-events-none" />

        <div className="space-y-1.5 relative z-10">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/25 shadow-xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--accent)] opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--accent)]" />
              </span>
              Live Refill State Engine
            </span>
            <span className="text-xs text-[var(--fg-subtle)]">·</span>
            <span className="inline-flex items-center gap-1 text-xs text-[var(--fg-muted)]">
              <span>{user?.roleDisplayName ? `${user.roleDisplayName} Workspace` : 'Operations Hub'}</span>
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--fg)]">
            {getGreeting(user?.role, user?.name || user?.username)}
          </h1>
          <p className="text-sm text-[var(--fg-muted)] max-w-2xl">
            Real-time multi-party coordination dashboard across pharmacies, clinical providers, and practice coordinators.
          </p>
        </div>

        <div className="flex items-center gap-3 relative z-10 shrink-0">
          <button
            onClick={() => { void refetchSummary(); void refetchRefills(); }}
            className="p-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-2)] text-[var(--fg-muted)] hover:text-[var(--fg)] transition-all shadow-xs group"
            title="Sync live queue"
          >
            <RefreshCw className={`w-4 h-4 transition-transform duration-500 ${refillsLoading || summaryLoading ? 'animate-spin text-[var(--accent)]' : 'group-hover:rotate-180'}`} />
          </button>
          <Link
            to="/refills"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--accent)] text-white font-semibold text-sm hover:opacity-95 hover:shadow-[0_4px_20px_rgba(94,91,193,0.4)] active:scale-[0.98] transition-all shadow-[0_2px_12px_rgba(94,91,193,0.3)]"
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
        <div className="glass-card-elevated p-5 relative overflow-hidden group">
          <div className="glow-bloom-indigo -top-10 -right-10 opacity-70 group-hover:opacity-100 transition-opacity" />
          <div className="flex items-center justify-between relative z-10">
            <span className="text-xs font-bold text-[var(--fg-muted)] tracking-wider uppercase">Active Bottlenecks</span>
            <span className="p-2.5 rounded-xl bg-indigo-500/15 text-indigo-400 border border-indigo-500/20 group-hover:scale-110 transition-transform">
              <Activity className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2 relative z-10">
            <span className="text-3xl font-black text-[var(--fg)] tracking-tight">
              {summaryLoading ? '—' : summary?.totalActive ?? 0}
            </span>
            <span className="text-xs text-[var(--fg-subtle)] font-medium">stuck refills</span>
          </div>
          <p className="mt-2 text-xs text-[var(--fg-muted)] flex items-center gap-1.5 relative z-10">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_6px_#6366f1]" />
            Under coordinated resolution
          </p>
        </div>

        {/* Card 2: Awaiting Provider */}
        <div className="glass-card-elevated p-5 relative overflow-hidden group">
          <div className="glow-bloom-amber -top-10 -right-10 opacity-70 group-hover:opacity-100 transition-opacity" />
          <div className="flex items-center justify-between relative z-10">
            <span className="text-xs font-bold text-[var(--fg-muted)] tracking-wider uppercase">Awaiting Doctor</span>
            <span className="p-2.5 rounded-xl bg-amber-500/15 text-amber-500 border border-amber-500/20 group-hover:scale-110 transition-transform">
              <Stethoscope className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2 relative z-10">
            <span className="text-3xl font-black text-amber-500 tracking-tight">
              {summaryLoading ? '—' : summary?.awaitingProvider ?? 0}
            </span>
            <span className="text-xs text-[var(--fg-subtle)] font-medium">need doctor review</span>
          </div>
          <p className="mt-2 text-xs text-[var(--fg-muted)] flex items-center gap-1.5 relative z-10">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_6px_#f59e0b]" />
            Renewals & clinical approvals
          </p>
        </div>

        {/* Card 3: Awaiting Pharmacy / Insurance */}
        <div className="glass-card-elevated p-5 relative overflow-hidden group">
          <div className="glow-bloom-sky -top-10 -right-10 opacity-70 group-hover:opacity-100 transition-opacity" />
          <div className="flex items-center justify-between relative z-10">
            <span className="text-xs font-bold text-[var(--fg-muted)] tracking-wider uppercase">Insurance & Pharmacy</span>
            <span className="p-2.5 rounded-xl bg-sky-500/15 text-sky-400 border border-sky-500/20 group-hover:scale-110 transition-transform">
              <ShieldAlert className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2 relative z-10">
            <span className="text-3xl font-black text-sky-400 tracking-tight">
              {summaryLoading ? '—' : (summary?.awaitingInsurance ?? 0) + (summary?.awaitingPharmacy ?? 0)}
            </span>
            <span className="text-xs text-[var(--fg-subtle)] font-medium">prior auth & stock</span>
          </div>
          <p className="mt-2 text-xs text-[var(--fg-muted)] flex items-center gap-1.5 relative z-10">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shadow-[0_0_6px_#38bdf8]" />
            Pending PBM / formulary action
          </p>
        </div>

        {/* Card 4: Urgent & Escalated */}
        <div className="glass-card-elevated p-5 relative overflow-hidden group">
          <div className="glow-bloom-rose -top-10 -right-10 opacity-70 group-hover:opacity-100 transition-opacity" />
          <div className="flex items-center justify-between relative z-10">
            <span className="text-xs font-bold text-[var(--fg-muted)] tracking-wider uppercase">Urgent Escalations</span>
            <span className="p-2.5 rounded-xl bg-rose-500/15 text-rose-500 border border-rose-500/20 group-hover:scale-110 transition-transform">
              <Flame className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2 relative z-10">
            <span className="text-3xl font-black text-rose-500 tracking-tight">
              {summaryLoading ? '—' : summary?.escalated ?? 0}
            </span>
            <span className="text-xs text-[var(--fg-subtle)] font-medium">immediate attention</span>
          </div>
          <p className="mt-2 text-xs text-[var(--fg-muted)] flex items-center gap-1.5 relative z-10">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-[0_0_6px_#f43f5e] badge-pulse-urgent" />
            High clinical priority
          </p>
        </div>
      </div>

      {/* ── Workflow State Distribution & Quick Analytics ───────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Blocker Root-Cause Breakdown */}
        <div className="lg:col-span-2 glass-card-elevated p-6 relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="text-base font-bold text-[var(--fg)] tracking-tight">Why Refills Are Stuck (Root Cause Detection)</h2>
              <p className="text-xs text-[var(--fg-muted)]">Automatic categorization by Zeno deterministic triage engine</p>
            </div>
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-[var(--surface-2)] text-[var(--fg-muted)] border border-[var(--border)] self-start sm:self-auto shadow-2xs">
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
                        <div className="p-3 rounded-2xl bg-[var(--surface)]/95 backdrop-blur-md border border-[var(--border)] text-xs shadow-2xl space-y-1">
                          <p className="font-bold text-[var(--fg)]">{data.name}</p>
                          <p className="text-[var(--accent)] font-semibold">{data.count} refill cases blocked</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                  {blockerChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 3 Core Roles Summary Box */}
        <div className="glass-card-elevated p-6 flex flex-col justify-between relative overflow-hidden">
          <div>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-base font-bold text-[var(--fg)] tracking-tight">Who Needs to Act?</h2>
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[var(--surface-2)] text-[var(--fg-subtle)] border border-[var(--border)]/60">Triage Queue</span>
            </div>
            <p className="text-xs text-[var(--fg-muted)] mb-4">Click any persona to filter active cases below</p>

            <div className="space-y-2.5">
              {/* Role 1: Pharmacist */}
              <button
                type="button"
                onClick={() => setFilterRole(filterRole === 'PHARMACY' ? 'ALL' : 'PHARMACY')}
                className={`w-full text-left p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between group ${filterRole === 'PHARMACY' ? 'bg-sky-500/15 border-sky-500/40 shadow-xs' : 'bg-[var(--surface-2)]/60 border-[var(--border)] hover:bg-[var(--surface-2)] hover:border-sky-500/30'}`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-sky-500/15 text-sky-400 flex items-center justify-center font-bold text-sm border border-sky-500/25 group-hover:scale-105 transition-transform">
                    💊
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[var(--fg)]">Pharmacist</h4>
                    <p className="text-[11px] text-[var(--fg-muted)]">Prior auth, stock, dispensing</p>
                  </div>
                </div>
                <span className="text-xs font-black px-2.5 py-1 rounded-full bg-sky-500/20 text-sky-400 border border-sky-500/30">
                  {summary?.awaitingPharmacy ?? 0}
                </span>
              </button>

              {/* Role 2: Practice Staff / Nurse */}
              <button
                type="button"
                onClick={() => setFilterRole(filterRole === 'PRACTICE_STAFF' ? 'ALL' : 'PRACTICE_STAFF')}
                className={`w-full text-left p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between group ${filterRole === 'PRACTICE_STAFF' ? 'bg-purple-500/15 border-purple-500/40 shadow-xs' : 'bg-[var(--surface-2)]/60 border-[var(--border)] hover:bg-[var(--surface-2)] hover:border-purple-500/30'}`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-purple-500/15 text-purple-400 flex items-center justify-center font-bold text-sm border border-purple-500/25 group-hover:scale-105 transition-transform">
                    📋
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[var(--fg)]">Practice Staff / Nurse</h4>
                    <p className="text-[11px] text-[var(--fg-muted)]">Lab results, visits, chart intake</p>
                  </div>
                </div>
                <span className="text-xs font-black px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30">
                  {summary?.awaitingPractice ?? 0}
                </span>
              </button>

              {/* Role 3: Doctor / Provider */}
              <button
                type="button"
                onClick={() => setFilterRole(filterRole === 'PROVIDER' ? 'ALL' : 'PROVIDER')}
                className={`w-full text-left p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between group ${filterRole === 'PROVIDER' ? 'bg-amber-500/15 border-amber-500/40 shadow-xs' : 'bg-[var(--surface-2)]/60 border-[var(--border)] hover:bg-[var(--surface-2)] hover:border-amber-500/30'}`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center font-bold text-sm border border-amber-500/25 group-hover:scale-105 transition-transform">
                    🩺
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[var(--fg)]">Doctor / Provider</h4>
                    <p className="text-[11px] text-[var(--fg-muted)]">Prescription renewal, approvals</p>
                  </div>
                </div>
                <span className="text-xs font-black px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  {summary?.awaitingProvider ?? 0}
                </span>
              </button>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[var(--border)] text-[11px] text-[var(--fg-subtle)] flex items-center gap-1.5">
            <HeartPulse className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />
            <span>Clinical decisions remain 100% human-controlled.</span>
          </div>
        </div>
      </div>

      {/* ── Active Refill Resolution Queue ───────────────────────────────────── */}
      <div className="glass-card-elevated overflow-hidden">
        {/* Table Header & Filters */}
        <div className="p-5 border-b border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-[var(--fg)] tracking-tight">Active Refill Resolution Queue</h2>
            <p className="text-xs text-[var(--fg-muted)]">
              Real-time cases requiring clinical review, prior authorization, or pharmacist check
            </p>
          </div>

          {/* Persona Filter Tabs */}
          <div className="flex items-center gap-1 p-1 rounded-2xl bg-[var(--surface-2)]/80 text-xs border border-[var(--border)] overflow-x-auto shadow-inner">
            <button
              onClick={() => setFilterRole('ALL')}
              className={`px-3 py-1.5 rounded-xl font-semibold transition-all ${filterRole === 'ALL' ? 'bg-[var(--surface)] text-[var(--fg)] shadow-xs scale-100' : 'text-[var(--fg-muted)] hover:text-[var(--fg)]'}`}
            >
              All ({refills.length})
            </button>
            <button
              onClick={() => setFilterRole('PROVIDER')}
              className={`px-3 py-1.5 rounded-xl font-semibold transition-all flex items-center gap-1 ${filterRole === 'PROVIDER' ? 'bg-[var(--surface)] text-amber-500 shadow-xs' : 'text-[var(--fg-muted)] hover:text-[var(--fg)]'}`}
            >
              <span>🩺 Doctor</span>
            </button>
            <button
              onClick={() => setFilterRole('PRACTICE_STAFF')}
              className={`px-3 py-1.5 rounded-xl font-semibold transition-all flex items-center gap-1 ${filterRole === 'PRACTICE_STAFF' ? 'bg-[var(--surface)] text-purple-400 shadow-xs' : 'text-[var(--fg-muted)] hover:text-[var(--fg)]'}`}
            >
              <span>📋 Nurse/Staff</span>
            </button>
            <button
              onClick={() => setFilterRole('PHARMACY')}
              className={`px-3 py-1.5 rounded-xl font-semibold transition-all flex items-center gap-1 ${filterRole === 'PHARMACY' ? 'bg-[var(--surface)] text-sky-400 shadow-xs' : 'text-[var(--fg-muted)] hover:text-[var(--fg)]'}`}
            >
              <span>💊 Pharmacy</span>
            </button>
            <button
              onClick={() => setFilterRole('URGENT')}
              className={`px-3 py-1.5 rounded-xl font-semibold transition-all flex items-center gap-1 ${filterRole === 'URGENT' ? 'bg-[var(--surface)] text-rose-500 shadow-xs' : 'text-[var(--fg-muted)] hover:text-[var(--fg)]'}`}
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
                  <td colSpan={7} className="text-center py-16 text-[var(--fg-muted)]">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-3 text-[var(--accent)]" />
                    <p className="font-semibold text-sm text-[var(--fg)]">Connecting to live triage queue…</p>
                    <p className="text-xs text-[var(--fg-subtle)] mt-0.5">Fetching latest refill state transitions</p>
                  </td>
                </tr>
              ) : filteredRefills.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-16 text-[var(--fg-muted)]">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-3">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <p className="font-semibold text-sm text-[var(--fg)]">No blocked refills in this queue</p>
                    <p className="text-xs text-[var(--fg-subtle)] mt-0.5">All active prescriptions are currently clear of bottlenecks.</p>
                  </td>
                </tr>
              ) : (
                filteredRefills.map(r => (
                  <tr key={r.refillId} className="hover:bg-[var(--surface-2)]/60 transition-all table-row-hover group">
                    {/* Patient & ID */}
                    <td className="py-4 px-4">
                      <div className="font-bold text-[var(--fg)] group-hover:text-[var(--accent)] transition-colors">{r.patientName}</div>
                      <div className="text-xs text-[var(--fg-subtle)] flex items-center gap-1.5 mt-0.5">
                        <span className="font-mono text-[11px] px-1.5 py-0.2 rounded bg-[var(--surface-2)] text-[var(--fg-muted)] border border-[var(--border)]/60">#{r.refillId}</span>
                        <span>· {r.pharmacyName}</span>
                      </div>
                    </td>

                    {/* Medication */}
                    <td className="py-4 px-4 font-semibold text-[var(--fg)]">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
                        <span>{r.medicationName}</span>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-4 px-4">
                      <StatusBadge status={r.status} />
                    </td>

                    {/* Blocker */}
                    <td className="py-4 px-4">
                      {r.blocker ? (
                        <BlockerBadge blocker={r.blocker} />
                      ) : (
                        <span className="text-xs text-[var(--fg-subtle)] italic">— None (Ready) —</span>
                      )}
                    </td>

                    {/* Priority */}
                    <td className="py-4 px-4">
                      <PriorityBadge priority={r.priority} />
                    </td>

                    {/* Waiting Since */}
                    <td className="py-4 px-4 text-xs text-[var(--fg-muted)]">
                      <div className="flex items-center gap-1.5 font-medium">
                        <Clock className="w-3.5 h-3.5 text-[var(--fg-subtle)]" />
                        <span>{formatTimeAgo(r.waitingSince)}</span>
                      </div>
                    </td>

                    {/* Action Links */}
                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {r.status === 'REQUESTED' && (
                          <button
                            onClick={e => handleTriage(e, r.refillId)}
                            disabled={triageLoadingId === r.refillId}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[var(--accent)] text-white hover:opacity-95 hover:shadow-[0_2px_12px_rgba(94,91,193,0.35)] active:scale-95 transition-all shadow-xs cursor-pointer"
                          >
                            <Sparkles className="w-3 h-3" />
                            <span>{triageLoadingId === r.refillId ? 'Triaging…' : 'Triage'}</span>
                          </button>
                        )}
                        <Link
                          to={`/refills/${r.refillId}`}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold border border-[var(--border)] bg-[var(--surface-2)]/60 text-[var(--fg)] hover:border-[var(--accent)] hover:bg-[var(--surface)] hover:text-[var(--accent)] hover:shadow-xs transition-all group/btn"
                        >
                          <span>Open Hub</span>
                          <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover/btn:translate-x-0.5" />
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

function getGreeting(role?: string, name?: string) {
  const hour = new Date().getHours();
  let timeStr = 'Good morning';
  if (hour >= 12 && hour < 17) timeStr = 'Good afternoon';
  else if (hour >= 17) timeStr = 'Good evening';

  const displayName = name ? (role === 'PROVIDER' && !name.startsWith('Dr.') ? `Dr. ${name}` : name) : 'Team Member';
  return `${timeStr}, ${displayName}`;
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; text: string; border: string; label: string }> = {
    REQUESTED: { bg: 'bg-zinc-500/15', text: 'text-zinc-400', border: 'border-zinc-500/25', label: 'Requested' },
    UNDER_REVIEW: { bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/30', label: 'Under Review' },
    AWAITING_PROVIDER: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30', label: 'Doctor Review' },
    AWAITING_PRACTICE: { bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-500/30', label: 'Practice Action' },
    AWAITING_PHARMACY: { bg: 'bg-sky-500/15', text: 'text-sky-400', border: 'border-sky-500/30', label: 'Pharmacy Action' },
    AWAITING_INSURANCE: { bg: 'bg-indigo-500/15', text: 'text-indigo-400', border: 'border-indigo-500/30', label: 'Insurance / PBM' },
    READY: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30', label: 'Ready to Dispense' },
    COMPLETED: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30', label: 'Completed' },
    ESCALATED: { bg: 'bg-rose-500/15', text: 'text-rose-400', border: 'border-rose-500/30', label: 'Escalated' },
    ACTION_REQUIRED: { bg: 'bg-orange-500/15', text: 'text-orange-400', border: 'border-orange-500/30', label: 'Action Required' },
  };

  const item = styles[status] || { bg: 'bg-zinc-500/15', text: 'text-zinc-400', border: 'border-zinc-500/25', label: status };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${item.bg} ${item.text} border ${item.border}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current shadow-[0_0_6px_currentColor]" />
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
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/25 shadow-xs">
      <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
      {labels[blocker] || blocker}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  if (priority === 'URGENT') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 shadow-[0_0_8px_rgba(244,63,94,0.2)]">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
        </span>
        URGENT
      </span>
    );
  }
  if (priority === 'HIGH') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_#f59e0b]" />
        HIGH
      </span>
    );
  }
  return <span className="text-xs text-[var(--fg-muted)] font-medium">Normal</span>;
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
