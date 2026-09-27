import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { zenoApi } from '@/services/api/zenoApi';
import { ArrowRight, History, RefreshCw, Search } from 'lucide-react';

export function AuditTrail() {
  const [search, setSearch] = useState('');
  const refillsQuery = useQuery({
    queryKey: ['audit-refills'],
    queryFn: () => zenoApi.getRefills(),
  });
  const refills = refillsQuery.data ?? [];
  const timelineQuery = useQuery({
    queryKey: ['audit-timelines', refills.map(refill => refill.id)],
    queryFn: async () => Promise.all(refills.map(async refill => ({
      refill,
      events: await zenoApi.getRefillTimeline(refill.id),
    }))),
    enabled: !refillsQuery.isLoading && !refillsQuery.isError,
  });

  const events = useMemo(() => (timelineQuery.data ?? [])
    .flatMap(({ refill, events: refillEvents }) => refillEvents.map(event => ({
      id: `${refill.id}-${event.id}`,
      refillId: refill.id,
      patient: [refill.patient?.firstName, refill.patient?.lastName].filter(Boolean).join(' ') || 'Patient',
      medication: refill.prescription?.medicationName || 'Prescription',
      eventType: event.eventType,
      description: event.description || 'Workflow event recorded.',
      actor: event.actorLabel || 'System',
      createdAt: event.createdAt,
    })))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)), [timelineQuery.data]);

  const filtered = events.filter(event =>
    `${event.patient} ${event.medication} ${event.eventType} ${event.description} ${event.actor}`
      .toLowerCase().includes(search.toLowerCase()),
  );
  const isLoading = refillsQuery.isLoading || timelineQuery.isLoading;
  const isError = refillsQuery.isError || timelineQuery.isError;

  return (
    <div className="space-y-6 pb-16">
      <section className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-gradient-to-br from-[var(--surface)] via-[var(--surface)] to-[var(--accent-muted)] p-5 sm:p-7">
        <div className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full bg-[var(--accent)]/10 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--accent)]/20 bg-[var(--accent)]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--accent)]">
              <History className="h-3.5 w-3.5" /> Refill activity
            </span>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-[var(--fg)]">Audit timeline</h1>
            <p className="mt-1 max-w-xl text-sm text-[var(--fg-muted)]">
              Recorded status changes and actions from the refill requests in your workspace.
            </p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)]/80 px-4 py-3">
            <p className="text-2xl font-bold text-[var(--fg)]">{isLoading ? '—' : events.length}</p>
            <p className="text-[11px] text-[var(--fg-muted)]">recorded events</p>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        <div className="flex flex-col gap-3 border-b border-[var(--border)] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-[var(--fg)]">Recent activity</h2>
            <p className="mt-0.5 text-xs text-[var(--fg-muted)]">Newest workflow events appear first.</p>
          </div>
          <label className="relative block w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--fg-subtle)]" />
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Search events, patients, or medications"
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] py-2 pl-9 pr-3 text-xs text-[var(--fg)] outline-none focus:border-[var(--accent)]"
            />
          </label>
        </div>

        {isError ? (
          <div role="alert" className="p-10 text-center">
            <p className="font-semibold text-[var(--fg)]">Activity could not be loaded</p>
            <p className="mt-1 text-sm text-[var(--fg-muted)]">Check your API connection and try again.</p>
            <button
              onClick={() => { void refillsQuery.refetch(); void timelineQuery.refetch(); }}
              className="mt-4 inline-flex items-center gap-2 rounded-xl border border-[var(--border)] px-3 py-2 text-xs font-semibold text-[var(--fg)] hover:bg-[var(--surface-2)]"
            ><RefreshCw className="h-3.5 w-3.5" /> Retry</button>
          </div>
        ) : isLoading ? (
          <div className="p-12 text-center text-sm text-[var(--fg-muted)]"><RefreshCw className="mx-auto mb-2 h-5 w-5 animate-spin text-[var(--accent)]" />Loading refill activity…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <History className="mx-auto mb-2 h-7 w-7 text-[var(--fg-subtle)]" />
            <p className="font-medium text-[var(--fg)]">{search ? 'No activity matches your search' : 'No refill activity yet'}</p>
            <p className="mt-1 text-xs text-[var(--fg-muted)]">Workflow events will appear here as refill requests are handled.</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {filtered.map(event => (
              <article key={event.id} className="grid gap-3 p-4 transition-colors hover:bg-[var(--surface-2)]/40 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div className="flex min-w-0 gap-3">
                  <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--accent)] ring-4 ring-[var(--accent)]/10" />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-[var(--fg)]">{event.eventType.replaceAll('_', ' ')}</h3>
                      <span className="text-xs text-[var(--fg-subtle)]">{new Date(event.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="mt-1 text-sm text-[var(--fg-muted)]">{event.description}</p>
                    <p className="mt-1 text-xs text-[var(--fg-subtle)]">{event.patient} · {event.medication} · by {event.actor}</p>
                  </div>
                </div>
                <Link to={`/refills/${event.refillId}`} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--accent)] hover:underline sm:ml-4">
                  Refill #{event.refillId} <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
