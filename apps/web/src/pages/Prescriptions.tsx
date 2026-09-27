import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { zenoApi } from '@/services/api/zenoApi';
import { Search, Pill, RefreshCw } from 'lucide-react';

export function Prescriptions() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [requestingId, setRequestingId] = useState<number | null>(null);

  const { data: prescriptions = [], isLoading } = useQuery({
    queryKey: ['prescriptions-all'],
    queryFn: () => zenoApi.getPrescriptions(),
  });

  const createRefillMutation = useMutation({
    mutationFn: (rxId: number) => zenoApi.createRefill({
      prescriptionId: rxId,
      pharmacyId: 1,
      priority: 'NORMAL',
      notes: 'Initiated from prescription directory',
    }),
    onSuccess: (newRefill) => {
      queryClient.invalidateQueries({ queryKey: ['refills-all'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-refills'] });
      navigate(`/refills/${newRefill.id}`);
    },
    onSettled: () => setRequestingId(null),
  });

  const handleRequestRefill = (rxId: number) => {
    setRequestingId(rxId);
    createRefillMutation.mutate(rxId);
  };

  const filtered = prescriptions.filter(p => {
    const med = p.medicationName.toLowerCase();
    const pat = `${p.patient?.firstName || ''} ${p.patient?.lastName || ''}`.toLowerCase();
    return med.includes(search.toLowerCase()) || pat.includes(search.toLowerCase());
  });

  return (
    <div className="space-y-6 pb-16">
      {/* ── Page Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--fg)]">Prescriptions Directory</h1>
          <p className="text-sm text-[var(--fg-muted)]">
            Patient prescription profiles, remaining authorized refills, and renewals.
          </p>
        </div>
      </div>

      {/* ── Search Toolbar ──────────────────────────────────────────────────── */}
      <div className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xs flex items-center justify-between">
        <div className="relative w-full max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--fg-subtle)]" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by patient or medication..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-xs text-[var(--fg)] placeholder:text-[var(--fg-subtle)] focus:outline-hidden focus:border-[var(--accent)]"
          />
        </div>
        <span className="text-xs text-[var(--fg-muted)]">
          {filtered.length} prescriptions
        </span>
      </div>

      {/* ── Prescriptions Table ─────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--surface-2)]/50 text-[11px] font-semibold text-[var(--fg-muted)] uppercase tracking-wider border-b border-[var(--border)]">
              <tr>
                <th className="py-3 px-4">RX Number</th>
                <th className="py-3 px-4">Patient</th>
                <th className="py-3 px-4">Medication</th>
                <th className="py-3 px-4">Doctor / Prescriber</th>
                <th className="py-3 px-4">Refills Status</th>
                <th className="py-3 px-4">Rx State</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-xs text-[var(--fg-muted)]">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[var(--accent)]" />
                    Loading prescriptions...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-xs text-[var(--fg-muted)]">
                    No prescriptions match your search.
                  </td>
                </tr>
              ) : (
                filtered.map(p => {
                  const used = p.refillsUsed ?? 0;
                  const allowed = p.refillsAllowed ?? 0;
                  const remaining = Math.max(0, allowed - used);
                  const isOutOfRefills = used >= allowed;
                  const isExpired = p.status === 'EXPIRED';

                  return (
                    <tr key={p.id} className="hover:bg-[var(--surface-2)]/40 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-xs text-[var(--fg-subtle)]">
                        {p.rxNumber || `RX-${10000 + p.id}`}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-[var(--fg)]">
                          {p.patient?.firstName} {p.patient?.lastName}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-[var(--fg)]">{p.medicationName}</div>
                        <div className="text-xs text-[var(--fg-subtle)]">{p.instructions || 'Standard dosage'}</div>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-[var(--fg-muted)]">
                        Dr. {p.provider?.firstName} {p.provider?.lastName}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-xs">
                            <span className="font-bold text-[var(--fg)]">{used} of {allowed}</span>
                            <span className="text-[11px] text-[var(--fg-subtle)]">used</span>
                            {remaining === 0 ? (
                              <span className="ml-1 text-[10px] font-bold px-1.5 py-0.2 rounded bg-red-500/20 text-red-400">0 left</span>
                            ) : (
                              <span className="ml-1 text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400">{remaining} left</span>
                            )}
                          </div>
                          <div className="w-24 bg-[var(--surface-3)] h-1 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${isOutOfRefills ? 'bg-red-500' : 'bg-[var(--accent)]'}`}
                              style={{ width: `${Math.min(100, (used / (allowed || 1)) * 100)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        {isExpired ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            Expired
                          </span>
                        ) : isOutOfRefills ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            Out of Refills
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            Active
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => handleRequestRefill(p.id)}
                          disabled={requestingId === p.id}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--accent)] text-white hover:opacity-90 transition-opacity"
                        >
                          <Pill className="w-3 h-3" />
                          <span>{requestingId === p.id ? 'Requesting...' : 'Request Refill'}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
