import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { zenoApi } from '@/services/api/zenoApi';
import {
  Plus, Search, RefreshCw, AlertTriangle, Sparkles, ArrowRight, X
} from 'lucide-react';

export function Refills() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [triageLoadingId, setTriageLoadingId] = useState<number | null>(null);

  // New Refill Form State
  const [prescriptionId, setPrescriptionId] = useState(1);
  const pharmacyId = 1;
  const [priority, setPriority] = useState('NORMAL');
  const [notes, setNotes] = useState('');

  // Queries
  const { data: refills = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['refills-all'],
    queryFn: () => zenoApi.getRefills(),
  });

  const { data: prescriptions = [] } = useQuery({
    queryKey: ['prescriptions-select'],
    queryFn: () => zenoApi.getPrescriptions(),
  });

  // Mutations
  const createRefillMutation = useMutation({
    mutationFn: (dto: any) => zenoApi.createRefill(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['refills-all'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-refills'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      setIsNewModalOpen(false);
      setNotes('');
    },
  });

  const triageMutation = useMutation({
    mutationFn: (id: number) => zenoApi.triageRefill(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['refills-all'] });
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

  const filtered = refills.filter(r => {
    const med = r.prescription?.medicationName?.toLowerCase() || '';
    const pat = `${r.patient?.firstName || ''} ${r.patient?.lastName || ''}`.toLowerCase();
    const matchesSearch = med.includes(search.toLowerCase()) || pat.includes(search.toLowerCase());

    if (!matchesSearch) return false;
    if (statusFilter === 'ALL') return true;
    if (statusFilter === 'BLOCKED') return !!r.blockerType;
    if (statusFilter === 'READY') return r.status === 'READY';
    if (statusFilter === 'PROVIDER') return r.status === 'AWAITING_PROVIDER';
    if (statusFilter === 'COMPLETED') return r.status === 'COMPLETED';
    return r.status === statusFilter;
  });

  return (
    <div className="space-y-6 pb-16">
      {/* ── Page Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/20">
              Directory
            </span>
            <span className="text-xs text-[var(--fg-subtle)]">·</span>
            <span className="text-xs text-[var(--fg-muted)]">{refills.length} total recorded requests</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--fg)] tracking-tight">Prescription Refill Requests</h1>
          <p className="text-sm text-[var(--fg-muted)]">
            Manage, triage, and coordinate incoming pharmacy refill authorizations and blocked workflows.
          </p>
        </div>

        <button
          onClick={() => setIsNewModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--accent)] text-white font-semibold text-sm hover:opacity-95 hover:shadow-[0_4px_20px_rgba(94,91,193,0.35)] active:scale-95 transition-all shadow-sm self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New Refill Request</span>
        </button>
      </div>

      {createRefillMutation.isError && (
        <div role="alert" className="rounded-2xl border border-rose-500/25 bg-rose-500/5 px-4 py-3 text-sm text-rose-300">
          Could not create the refill request. Please check the prescription and try again.
        </div>
      )}

      {/* ── Filter & Search Toolbar ─────────────────────────────────────────── */}
      <div className="glass-card-elevated p-4 flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--fg-subtle)]" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search patient, medication, or case…"
            className="w-full pl-9 pr-8 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-xs text-[var(--fg)] placeholder:text-[var(--fg-subtle)] focus:outline-hidden focus:border-[var(--accent)] transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--fg-subtle)] hover:text-[var(--fg)] text-xs p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto text-xs p-1 rounded-2xl bg-[var(--surface-2)]/60 border border-[var(--border)]/70">
          {[
            { id: 'ALL', label: `All (${refills.length})` },
            { id: 'BLOCKED', label: 'Blocked' },
            { id: 'PROVIDER', label: 'Awaiting Doctor' },
            { id: 'READY', label: 'Ready' },
            { id: 'COMPLETED', label: 'Completed' },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setStatusFilter(f.id)}
              className={`px-3 py-1.5 rounded-xl font-semibold transition-all cursor-pointer ${
                statusFilter === f.id
                  ? 'bg-[var(--accent)] text-white shadow-xs'
                  : 'text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--surface)]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Refills Table ───────────────────────────────────────────────────── */}
      <div className="glass-card-elevated overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--surface-2)]/50 text-[11px] font-semibold text-[var(--fg-muted)] uppercase tracking-wider border-b border-[var(--border)]">
              <tr>
                <th className="py-3.5 px-4">Refill ID</th>
                <th className="py-3.5 px-4">Patient</th>
                <th className="py-3.5 px-4">Medication</th>
                <th className="py-3.5 px-4">Workflow State</th>
                <th className="py-3.5 px-4">Blocker Type</th>
                <th className="py-3.5 px-4">Priority</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-xs text-[var(--fg-muted)]">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[var(--accent)]" />
                    <span className="font-semibold text-sm text-[var(--fg)]">Loading refill requests…</span>
                  </td>
                </tr>
              ) : isError ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <p className="text-sm font-semibold text-[var(--fg)]">Refill requests could not be loaded</p>
                    <button onClick={() => void refetch()} className="mt-2 text-xs font-semibold text-[var(--accent)] hover:underline">Try again</button>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-xs text-[var(--fg-muted)]">
                    <p className="font-semibold text-sm text-[var(--fg)]">No matching refill requests found</p>
                    <p className="text-xs text-[var(--fg-subtle)] mt-1">Try adjusting your search query or status filter.</p>
                  </td>
                </tr>
              ) : (
                filtered.map(r => (
                  <tr key={r.id} className="hover:bg-[var(--surface-2)]/60 transition-all table-row-hover group">
                    <td className="py-4 px-4 font-mono text-xs">
                      <span className="px-2 py-0.5 rounded-lg bg-[var(--surface-2)] text-[var(--fg-muted)] border border-[var(--border)]/60 font-semibold">
                        #{r.id}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="font-bold text-[var(--fg)] group-hover:text-[var(--accent)] transition-colors">
                        {r.patient?.firstName} {r.patient?.lastName}
                      </div>
                      <div className="text-xs text-[var(--fg-subtle)] mt-0.5">
                        {r.pharmacy?.name || 'Main Pharmacy'}
                      </div>
                    </td>
                    <td className="py-4 px-4 font-semibold text-[var(--fg)]">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
                        <span>{r.prescription?.medicationName}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[var(--surface-2)] text-[var(--fg-muted)] border border-[var(--border)]">
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        {r.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      {r.blockerType ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/25 shadow-xs">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          {r.blockerType.replace(/_/g, ' ')}
                        </span>
                      ) : (
                        <span className="text-xs text-[var(--fg-subtle)] italic">— None —</span>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      {r.priority === 'URGENT' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 shadow-[0_0_8px_rgba(244,63,94,0.2)]">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
                          </span>
                          URGENT
                        </span>
                      ) : r.priority === 'HIGH' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_#f59e0b]" />
                          HIGH
                        </span>
                      ) : (
                        <span className="text-xs text-[var(--fg-muted)] font-medium">Normal</span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {r.status === 'REQUESTED' && (
                          <button
                            onClick={e => handleTriage(e, r.id)}
                            disabled={triageLoadingId === r.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[var(--accent)] text-white hover:opacity-95 hover:shadow-[0_2px_12px_rgba(94,91,193,0.35)] active:scale-95 transition-all shadow-xs cursor-pointer"
                          >
                            <Sparkles className="w-3 h-3" />
                            <span>{triageLoadingId === r.id ? 'Evaluating…' : 'Triage'}</span>
                          </button>
                        )}
                        <Link
                          to={`/refills/${r.id}`}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold border border-[var(--border)] bg-[var(--surface-2)]/60 text-[var(--fg)] hover:border-[var(--accent)] hover:bg-[var(--surface)] hover:text-[var(--accent)] hover:shadow-xs transition-all group/btn"
                        >
                          <span>Resolution Hub</span>
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

      {/* ── New Refill Request Modal ────────────────────────────────────────── */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md p-6 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[var(--fg)]">Create Refill Request</h3>
              <button onClick={() => setIsNewModalOpen(false)} className="p-1 rounded-lg text-[var(--fg-muted)] hover:text-[var(--fg)]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[var(--fg-muted)]">
              Submit a refill request on behalf of a patient. The system will automatically check remaining refills and identify blockers upon triage.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-[var(--fg-muted)] uppercase">Select Prescription</label>
                <select
                  value={prescriptionId}
                  onChange={e => setPrescriptionId(Number(e.target.value))}
                  className="w-full mt-1 p-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-xs text-[var(--fg)]"
                >
                  {prescriptions.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.medicationName} ({p.patient?.firstName} {p.patient?.lastName}) — {p.refillsUsed}/{p.refillsAllowed} Refills
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[var(--fg-muted)] uppercase">Priority</label>
                <select
                  value={priority}
                  onChange={e => setPriority(e.target.value)}
                  className="w-full mt-1 p-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-xs text-[var(--fg)]"
                >
                  <option value="NORMAL">Normal</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent (Low Supply)</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[var(--fg-muted)] uppercase">Notes / Patient Request Info</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="e.g. Patient requests 30-day refill at counter."
                  rows={2}
                  className="w-full mt-1 p-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-xs text-[var(--fg)]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setIsNewModalOpen(false)} className="px-3 py-2 rounded-xl text-xs font-medium text-[var(--fg-muted)] hover:bg-[var(--surface-2)]">
                Cancel
              </button>
              <button
                onClick={() => createRefillMutation.mutate({
                  prescriptionId,
                  pharmacyId,
                  priority,
                  notes: notes || 'Standard refill request',
                })}
                disabled={createRefillMutation.isPending}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[var(--accent)] text-white hover:opacity-90"
              >
                {createRefillMutation.isPending ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
