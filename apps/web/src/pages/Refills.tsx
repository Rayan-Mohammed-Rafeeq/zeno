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
  const { data: refills = [], isLoading } = useQuery({
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
          <h1 className="text-2xl font-bold text-[var(--fg)]">Prescription Refill Requests</h1>
          <p className="text-sm text-[var(--fg-muted)]">
            Manage, triage, and resolve incoming pharmacy refill requests.
          </p>
        </div>

        <button
          onClick={() => setIsNewModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--accent)] text-white font-medium text-sm hover:opacity-90 transition-opacity shadow-sm self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Refill Request</span>
        </button>
      </div>

      {/* ── Filter & Search Toolbar ─────────────────────────────────────────── */}
      <div className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--fg-subtle)]" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search patient or medication..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-xs text-[var(--fg)] placeholder:text-[var(--fg-subtle)] focus:outline-hidden focus:border-[var(--accent)]"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto text-xs">
          {[
            { id: 'ALL', label: 'All' },
            { id: 'BLOCKED', label: 'Blocked' },
            { id: 'PROVIDER', label: 'Awaiting Doctor' },
            { id: 'READY', label: 'Ready' },
            { id: 'COMPLETED', label: 'Completed' },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setStatusFilter(f.id)}
              className={`px-3 py-1.5 rounded-xl font-medium transition-colors ${
                statusFilter === f.id
                  ? 'bg-[var(--accent)] text-white'
                  : 'bg-[var(--surface-2)] text-[var(--fg-muted)] hover:text-[var(--fg)]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Refills Table ───────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--surface-2)]/50 text-[11px] font-semibold text-[var(--fg-muted)] uppercase tracking-wider border-b border-[var(--border)]">
              <tr>
                <th className="py-3 px-4">Refill ID</th>
                <th className="py-3 px-4">Patient</th>
                <th className="py-3 px-4">Medication</th>
                <th className="py-3 px-4">Workflow State</th>
                <th className="py-3 px-4">Blocker Type</th>
                <th className="py-3 px-4">Priority</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-xs text-[var(--fg-muted)]">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[var(--accent)]" />
                    Loading requests...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-xs text-[var(--fg-muted)]">
                    No matching refill requests found.
                  </td>
                </tr>
              ) : (
                filtered.map(r => (
                  <tr key={r.id} className="hover:bg-[var(--surface-2)]/40 transition-colors">
                    <td className="py-3.5 px-4 font-mono text-xs text-[var(--fg-subtle)]">
                      #{r.id}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-[var(--fg)]">
                        {r.patient?.firstName} {r.patient?.lastName}
                      </div>
                      <div className="text-xs text-[var(--fg-subtle)]">
                        {r.pharmacy?.name || 'Main Pharmacy'}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-[var(--fg)]">
                      {r.prescription?.medicationName}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[var(--surface-2)] text-[var(--fg-muted)]">
                        {r.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      {r.blockerType ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
                          <AlertTriangle className="w-3 h-3" />
                          {r.blockerType.replace(/_/g, ' ')}
                        </span>
                      ) : (
                        <span className="text-xs text-[var(--fg-subtle)]">— None —</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`text-xs font-bold ${r.priority === 'URGENT' ? 'text-rose-400' : r.priority === 'HIGH' ? 'text-amber-400' : 'text-[var(--fg-muted)]'}`}>
                        {r.priority}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {r.status === 'REQUESTED' && (
                          <button
                            onClick={e => handleTriage(e, r.id)}
                            disabled={triageLoadingId === r.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[var(--accent)] text-white hover:opacity-90"
                          >
                            <Sparkles className="w-3 h-3" />
                            <span>{triageLoadingId === r.id ? 'Evaluating...' : 'Triage'}</span>
                          </button>
                        )}
                        <Link
                          to={`/refills/${r.id}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--border)] bg-[var(--surface-2)]/60 text-[var(--fg)] hover:border-[var(--accent)] transition-colors"
                        >
                          <span>Resolution Hub</span>
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
