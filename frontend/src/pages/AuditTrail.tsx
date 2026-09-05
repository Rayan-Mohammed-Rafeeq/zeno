import { useQuery } from '@tanstack/react-query';
import { auditApi } from '@/services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { KpiCard } from '@/components/ui/KpiCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { formatDateTime } from '@/lib/utils';
import {
  FileText, Database, Activity, Network, FileSearch,
  Bot, ShieldCheck, CheckCircle, User, Cpu,
} from 'lucide-react';
import type { AuditEventType } from '@/types';

const EVENT_META: Record<AuditEventType, { icon: React.ComponentType<any>; color: string; label: string }> = {
  DATASET_GENERATED:       { icon: Database,    color: 'var(--info)',          label: 'Dataset Generated'         },
  TRANSACTION_ANALYZED:    { icon: Activity,    color: 'var(--success)',       label: 'Transaction Analyzed'      },
  RISK_SIGNAL_DETECTED:    { icon: ShieldCheck, color: 'var(--risk-medium)',   label: 'Risk Signal Detected'      },
  CLUSTER_IDENTIFIED:      { icon: Network,     color: 'var(--risk-high)',     label: 'Cluster Identified'        },
  INVESTIGATION_CREATED:   { icon: FileSearch,  color: 'var(--accent)',        label: 'Investigation Created'     },
  AI_ASSESSMENT_GENERATED: { icon: Bot,         color: 'var(--warning)',       label: 'AI Assessment Generated'   },
  DECISION_RECOMMENDED:    { icon: CheckCircle, color: 'var(--risk-critical)', label: 'Decision Recommended'      },
  INVESTIGATION_RESOLVED:  { icon: CheckCircle, color: 'var(--success)',       label: 'Investigation Resolved'    },
};

export function AuditTrail() {
  const { data, isLoading } = useQuery({
    queryKey: ['audit-events'],
    queryFn:  () => auditApi.getAuditEvents({ page: 1, pageSize: 100 }),
  });

  // Sort newest first
  const events = [...(data?.data ?? [])].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        icon={FileText}
        title="Audit Trail"
        subtitle="Immutable chronological log of all system and analyst actions."
      />

      {/* Summary KPI strip */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <KpiCard icon={Activity}    label="Total Events"    value={data?.total ?? 0}                                                                 delay="animate-fade-up-d1" />
        <KpiCard icon={Cpu}         label="System Actions"  value={events.filter((e) => e.actorType === 'SYSTEM').length}                            delay="animate-fade-up-d2" />
        <KpiCard icon={User}        label="Analyst Actions" value={events.filter((e) => e.actorType === 'USER').length}                              delay="animate-fade-up-d3" />
        <KpiCard icon={ShieldCheck} label="Risk Detections" value={events.filter((e) => ['RISK_SIGNAL_DETECTED','CLUSTER_IDENTIFIED'].includes(e.eventType)).length} accent="danger" delay="animate-fade-up-d4" />
      </div>

      {/* Timeline */}
      <Card>
        <CardHeader><CardTitle>Event Log</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-48 gap-3" style={{ color: 'var(--fg-subtle)' }}>
              <span className="h-5 w-5 border-2 border-current/20 border-t-current rounded-full animate-spin" />
              Loading events…
            </div>
          ) : (
            <div className="relative">
              {/* Vertical line */}
              <div className="absolute left-5 top-0 bottom-0 w-px" style={{ background: 'var(--border)' }} />

              <div className="space-y-1">
                {events.map((event) => {
                  const meta = EVENT_META[event.eventType] ?? {
                    icon: Activity, color: 'var(--fg-subtle)', label: event.eventType,
                  };
                  const Icon = meta.icon;

                  return (
                    <div key={event.id} className="flex items-start gap-4 pl-0 py-3 group">
                      {/* Icon bubble on the line */}
                      <div className="relative z-10 h-10 w-10 rounded-full flex items-center justify-center shrink-0"
                        style={{ background: 'var(--surface-2)', border: `1.5px solid ${meta.color}` }}>
                        <Icon className="h-4 w-4" style={{ color: meta.color }} />
                      </div>

                      <div className="flex-1 min-w-0 pt-1.5">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div>
                            <span className="text-sm font-semibold" style={{ color: 'var(--fg)' }}>
                              {meta.label}
                            </span>
                            {' '}
                            <span className="text-sm" style={{ color: 'var(--fg-muted)' }}>
                              on <strong style={{ color: 'var(--fg)' }}>{event.entityType}</strong>
                              {' '}<span className="font-mono text-xs">{event.entityId}</span>
                            </span>
                          </div>
                          <div className="text-xs shrink-0" style={{ color: 'var(--fg-subtle)' }}>
                            {formatDateTime(event.timestamp)}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 mt-1">
                          {event.actorType === 'SYSTEM'
                            ? <Cpu className="h-3 w-3" style={{ color: 'var(--fg-subtle)' }} />
                            : <User className="h-3 w-3" style={{ color: 'var(--fg-subtle)' }} />
                          }
                          <span className="text-xs" style={{ color: 'var(--fg-subtle)' }}>{event.actor}</span>
                          <span className="text-xs px-1.5 py-0.5 rounded"
                            style={{ background: 'var(--success-bg)', color: 'var(--success)' }}>
                            {event.outcome}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
