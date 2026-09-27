import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  History, Search, ArrowRight,
} from 'lucide-react';

export function AuditTrail() {
  const [search, setSearch] = useState('');

  // Sample aggregated audit events
  const auditEvents = [
    {
      id: 101,
      refillId: 1,
      medication: 'Lisinopril 10mg',
      patient: 'James Anderson',
      eventType: 'REFILL_READY',
      description: 'Prescription evaluated with no blockers. State marked READY for pharmacy dispensing.',
      actor: 'triage-engine (Deterministic Engine)',
      time: '2 hours ago',
      type: 'SUCCESS',
    },
    {
      id: 102,
      refillId: 2,
      medication: 'Metformin 500mg',
      patient: 'Maria Rodriguez',
      eventType: 'BLOCKER_IDENTIFIED',
      description: 'Blocker detected: Authorized refills exhausted (used 3/3). Case assigned to Practice Staff.',
      actor: 'triage-engine',
      time: '1 day ago',
      type: 'WARNING',
    },
    {
      id: 103,
      refillId: 3,
      medication: 'Humira 40mg',
      patient: 'William Taylor',
      eventType: 'ACTION_CREATED',
      description: 'Prior authorization verification requested with insurance/PBM.',
      actor: 'sarah.chen (Pharmacist)',
      time: '2 days ago',
      type: 'INFO',
    },
    {
      id: 104,
      refillId: 7,
      medication: 'Atorvastatin 40mg',
      patient: 'Michael Wilson',
      eventType: 'PROVIDER_APPROVED',
      description: 'Dr. Kim granted verbal authorization for 3 additional refills after chart review.',
      actor: 'lisa.martinez (Practice Staff / Nurse)',
      time: '3 days ago',
      type: 'SUCCESS',
    },
    {
      id: 105,
      refillId: 7,
      medication: 'Atorvastatin 40mg',
      patient: 'Michael Wilson',
      eventType: 'REFILL_COMPLETED',
      description: 'Medication dispensed and claim finalized at counter.',
      actor: 'sarah.chen (Pharmacist)',
      time: '3 days ago',
      type: 'SUCCESS',
    },
    {
      id: 106,
      refillId: 8,
      medication: 'Warfarin 5mg',
      patient: 'Patricia Garcia',
      eventType: 'CASE_ESCALATED',
      description: 'Clinical adjustment flagged for urgent physician review pending lab INR result.',
      actor: 'sarah.chen (Pharmacist)',
      time: '4 days ago',
      type: 'ALERT',
    },
  ];

  const filtered = auditEvents.filter(e =>
    e.medication.toLowerCase().includes(search.toLowerCase()) ||
    e.patient.toLowerCase().includes(search.toLowerCase()) ||
    e.description.toLowerCase().includes(search.toLowerCase()) ||
    e.actor.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-16">
      {/* ── Page Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-[var(--accent)]/15 text-[var(--accent)]">
              <History className="w-4 h-4" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--accent)]">
              Full System Observability
            </span>
          </div>
          <h1 className="text-2xl font-bold text-[var(--fg)] mt-1">Refill Event Audit Trail</h1>
          <p className="text-sm text-[var(--fg-muted)]">
            Append-only, immutable record of every state transition, clinical decision, and staff action.
          </p>
        </div>
      </div>

      {/* ── Search & Filter ─────────────────────────────────────────────────── */}
      <div className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xs flex items-center justify-between">
        <div className="relative w-full max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--fg-subtle)]" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search events, actors, or patients..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-xs text-[var(--fg)] placeholder:text-[var(--fg-subtle)] focus:outline-hidden focus:border-[var(--accent)]"
          />
        </div>
        <span className="text-xs text-[var(--fg-muted)]">
          {filtered.length} audit records
        </span>
      </div>

      {/* ── Event Feed Table ────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--surface-2)]/50 text-[11px] font-semibold text-[var(--fg-muted)] uppercase tracking-wider border-b border-[var(--border)]">
              <tr>
                <th className="py-3 px-4">Event Type</th>
                <th className="py-3 px-4">Refill & Patient</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4">Actor / System</th>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4 text-right">Case Link</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {filtered.map(ev => (
                <tr key={ev.id} className="hover:bg-[var(--surface-2)]/40 transition-colors">
                  <td className="py-3.5 px-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      ev.type === 'SUCCESS' ? 'bg-emerald-500/15 text-emerald-400' :
                      ev.type === 'WARNING' ? 'bg-amber-500/15 text-amber-400' :
                      ev.type === 'ALERT' ? 'bg-rose-500/15 text-rose-400' :
                      'bg-indigo-500/15 text-indigo-400'
                    }`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-current" />
                      {ev.eventType.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-[var(--fg)]">{ev.patient}</div>
                    <div className="text-xs text-[var(--fg-subtle)]">{ev.medication} · Case #{ev.refillId}</div>
                  </td>
                  <td className="py-3.5 px-4 text-xs text-[var(--fg-muted)] max-w-md">
                    {ev.description}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-xs text-[var(--accent)]">
                    {ev.actor}
                  </td>
                  <td className="py-3.5 px-4 text-xs text-[var(--fg-subtle)] whitespace-nowrap">
                    {ev.time}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <Link
                      to={`/refills/${ev.refillId}`}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent)] hover:underline"
                    >
                      <span>View</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
