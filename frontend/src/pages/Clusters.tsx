/**
 * NETWORK INTELLIGENCE — Coordinated Risk Detection
 *
 * This page is a genuine investigation workspace, not a generic CRUD table.
 * Layout:
 *   1. Page header + compact summary row
 *   2. Investigation toolbar (search + filters)
 *   3. Main workspace (graph hero + selected-cluster panel side-by-side)
 *   4. All Networks table (acts as navigation index)
 *
 * Data contract:
 *   - All fields read from the real backend ClusterResponse DTO.
 *   - Timestamps come as ISO-8601 Instant strings.
 *   - estimatedExposure is BigDecimal serialized as number (may be null).
 *   - No hardcoded metrics. No fabricated relationships.
 */

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation } from 'react-router-dom';
import { ClusterNetworkGraph } from '@/components/clusters/ClusterNetworkGraph';

import { clusterApi, investigationApi, intelligenceApi } from '@/services/api';
import type { RiskCluster, RiskLevel, AiAssessment } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { PaginationBar } from '@/components/ui/Pagination';
import { formatCurrency, formatRelativeTime, formatNumber } from '@/lib/utils';
import {
  Network, Users, Smartphone, Globe, Receipt,
  AlertTriangle, Search, ChevronRight, X,
  RefreshCw, FileSearch,
  Brain, CheckCircle2, Clock, ShieldAlert, Info, ExternalLink,
} from 'lucide-react';

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Short display label for a cluster (uses first 8 chars of UUID) */
function clusterLabel(c: RiskCluster) {
  return 'CR-' + c.id.replace(/-/g, '').slice(0, 6).toUpperCase();
}

const RISK_COLOR: Record<RiskLevel, string> = {
  LOW:      'var(--risk-low)',
  MEDIUM:   'var(--risk-medium)',
  HIGH:     'var(--risk-high)',
  CRITICAL: 'var(--risk-critical)',
};

const STATUS_LABEL: Record<string, string> = {
  ACTIVE:       'Active',
  UNDER_REVIEW: 'Under Review',
  RESOLVED:     'Resolved',
};
const STATUS_VARIANT: Record<string, string> = {
  ACTIVE:       'warning',
  UNDER_REVIEW: 'info',
  RESOLVED:     'success',
};

/** Safe currency formatter — never shows NaN */
function safeExposure(v: number | null | undefined): string {
  if (v == null || isNaN(v)) return 'N/A';
  return formatCurrency(v, 'INR');
}

/** Safe number formatter */
function safeNum(v: number | null | undefined): string {
  if (v == null || isNaN(Number(v))) return '—';
  return formatNumber(v);
}

/** Safe relative time formatter — never shows "Invalid Date" */
function safeRelTime(v: string | null | undefined): string {
  if (!v) return '—';
  const d = new Date(v);
  if (isNaN(d.getTime())) return '—';
  return formatRelativeTime(v);
}

/** Derive a primary signal label from cluster shape (no fabrication) */
function deriveSignals(c: RiskCluster): string[] {
  const sigs: string[] = [];
  if (c.deviceCount > 0) sigs.push('Device reuse');
  if (c.ipCount > 0)     sigs.push('IP overlap');
  if (c.refundCount > 0) sigs.push('Refund activity');
  return sigs.length ? sigs : ['Shared infrastructure'];
}

// ─── AI Assessment panel ──────────────────────────────────────────────────────

function AiAssessmentPanel({
  assessment,
  onClose,
}: {
  assessment: AiAssessment;
  onClose: () => void;
}) {
  const sr = assessment.structuredResult;
  const action = sr?.recommendedAction ?? assessment.recommendedAction ?? 'MANUAL_REVIEW';
  const confidence = sr?.confidence ?? Math.round((assessment.confidence ?? 0) * 100);
  const summary = sr?.summary ?? '';
  const reasons = sr?.reasons ?? [];
  const limitations = sr?.limitations ?? [];
  const disclaimer = assessment.disclaimer ?? '';

  const ACTION_LABEL: Record<string, string> = {
    MANUAL_REVIEW:             'Manual Review',
    MONITOR:                   'Monitor',
    HOLD_FOR_REVIEW:           'Hold for Review',
    PREPARE_CHARGEBACK_EVIDENCE: 'Prepare Evidence',
  };

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--accent-muted)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Brain size={14} color="var(--accent)" />
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            AI Risk Assessment
          </span>
          {!assessment.aiGenerated && (
            <span style={{ fontSize: 9, background: 'var(--warning-bg)', color: 'var(--warning)', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>
              FALLBACK
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-subtle)', padding: 2 }}
          aria-label="Close AI assessment"
        >
          <X size={14} />
        </button>
      </div>

      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Assessment + Confidence */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div>
            <div style={{ fontSize: 9, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>Assessment</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--risk-high)' }}>
              {(sr?.assessment ?? 'INCONCLUSIVE').replace('_', ' ')}
            </div>
          </div>
          <div style={{ width: 1, height: 32, background: 'var(--border)' }} />
          <div>
            <div style={{ fontSize: 9, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>Confidence</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg)' }}>{confidence}%</div>
          </div>
          <div style={{ width: 1, height: 32, background: 'var(--border)' }} />
          <div>
            <div style={{ fontSize: 9, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>Action</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--warning)' }}>
              {ACTION_LABEL[action] ?? action.replace(/_/g, ' ')}
            </div>
          </div>
        </div>

        {/* Summary */}
        {summary && (
          <p style={{ fontSize: 11, color: 'var(--fg-muted)', lineHeight: 1.5, margin: 0 }}>{summary}</p>
        )}

        {/* Evidence */}
        {reasons.length > 0 && (
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
              Evidence
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {reasons.map((r, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 8, fontSize: 11 }}>
                  <span style={{ color: 'var(--accent)', flexShrink: 0, paddingTop: 1 }}>•</span>
                  <div>
                    <span style={{ color: 'var(--fg)', fontWeight: 600 }}>{r.signal}: </span>
                    <span style={{ color: 'var(--fg-muted)' }}>{r.interpretation}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Network evidence */}
        {sr?.networkEvidence?.clusterDetected && (
          <div style={{ background: 'var(--surface-2)', borderRadius: 8, padding: '8px 12px', fontSize: 11 }}>
            <span style={{ color: 'var(--accent)', fontWeight: 600 }}>Network: </span>
            <span style={{ color: 'var(--fg-muted)' }}>{sr.networkEvidence.relationshipSummary}</span>
          </div>
        )}

        {/* Limitations */}
        {limitations.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {limitations.map((l, i) => (
              <div key={i} style={{ fontSize: 10, color: 'var(--fg-subtle)', display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                <Info size={10} style={{ flexShrink: 0, marginTop: 1 }} />
                {l}
              </div>
            ))}
          </div>
        )}

        {/* Disclaimer */}
        {disclaimer && (
          <p style={{ fontSize: 10, color: 'var(--fg-subtle)', margin: 0, borderTop: '1px solid var(--border)', paddingTop: 8, lineHeight: 1.5 }}>
            {disclaimer}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Selected Cluster Panel ───────────────────────────────────────────────────

interface ClusterPanelProps {
  cluster: RiskCluster;
  onClose: () => void;
}

function SelectedClusterPanel({ cluster, onClose }: ClusterPanelProps) {
  const qc = useQueryClient();

  const [aiAssessment, setAiAssessment] = useState<AiAssessment | null>(null);
  const [investigationId, setInvestigationId] = useState<string | null>(null);

  // Check if an investigation already exists for this cluster
  const { data: existingInv } = useQuery({
    queryKey: ['cluster-investigation', cluster.id],
    queryFn: () => investigationApi.findInvestigationForCluster(cluster.id),
    enabled: true,
  });

  useEffect(() => {
    if (existingInv?.id) setInvestigationId(existingInv.id);
  }, [existingInv]);

  const aiMutation = useMutation({
    mutationFn: () => intelligenceApi.assessCluster(cluster.id, cluster.memberCount),
    onSuccess: (data) => setAiAssessment(data as AiAssessment),
  });

  const invMutation = useMutation({
    mutationFn: () => investigationApi.createInvestigationForCluster(cluster.id, cluster.riskLevel),
    onSuccess: (data: any) => {
      setInvestigationId(data.id ?? data.investigationId);
      qc.invalidateQueries({ queryKey: ['investigations'] });
    },
  });

  const signals = deriveSignals(cluster);
  const label = clusterLabel(cluster);
  const hasExposure = cluster.estimatedExposure != null && !isNaN(cluster.estimatedExposure ?? NaN);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflowY: 'auto',
        gap: 0,
      }}
      className="no-scrollbar"
    >
      {/* Panel header */}
      <div
        style={{
          padding: '14px 16px 12px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 8,
          flexShrink: 0,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'monospace', color: 'var(--fg)' }}>
              {label}
            </span>
            <Badge variant="risk" riskLevel={cluster.riskLevel} dot>
              {cluster.riskLevel} RISK
            </Badge>
            <Badge variant={STATUS_VARIANT[cluster.status] as any ?? 'default'}>
              {STATUS_LABEL[cluster.status] ?? cluster.status}
            </Badge>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 10, color: 'var(--fg-subtle)' }}>Risk score</span>
            <span
              style={{
                fontSize: 22,
                fontWeight: 800,
                color: RISK_COLOR[cluster.riskLevel],
                lineHeight: 1,
              }}
            >
              {cluster.riskScore}
            </span>
            <span style={{ fontSize: 10, color: 'var(--fg-subtle)' }}>/ 100</span>
          </div>
        </div>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-subtle)', padding: 4, flexShrink: 0 }}
          aria-label="Close cluster panel"
        >
          <X size={14} />
        </button>
      </div>

      {/* Scrollable body */}
      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>

        {/* Network size stats */}
        <section>
          <SectionLabel>Network Size</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
            {[
              { icon: Users,      label: 'Customers', val: safeNum(cluster.memberCount)    },
              { icon: Smartphone, label: 'Devices',   val: safeNum(cluster.deviceCount)   },
              { icon: Globe,      label: 'IPs',        val: safeNum(cluster.ipCount)       },
            ].map(({ icon: Icon, label: lbl, val }) => (
              <div key={lbl}
                style={{ background: 'var(--surface-2)', borderRadius: 8, padding: '8px 6px', textAlign: 'center' }}
              >
                <Icon size={11} color="var(--fg-subtle)" style={{ margin: '0 auto 4px' }} />
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--fg)' }}>{val}</div>
                <div style={{ fontSize: 9, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{lbl}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Activity */}
        <section>
          <SectionLabel>Activity</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {[
              { icon: Receipt,       label: 'Transactions', val: safeNum(cluster.transactionCount) },
              { icon: AlertTriangle, label: 'Refunds',       val: safeNum(cluster.refundCount),
                color: cluster.refundCount > 0 ? 'var(--risk-high)' : undefined },
            ].map(({ icon: Icon, label: lbl, val, color }) => (
              <div key={lbl}
                style={{ background: 'var(--surface-2)', borderRadius: 8, padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 8 }}
              >
                <Icon size={12} color={color ?? 'var(--fg-subtle)'} style={{ flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: color ?? 'var(--fg)' }}>{val}</div>
                  <div style={{ fontSize: 9, color: 'var(--fg-subtle)' }}>{lbl}</div>
                </div>
              </div>
            ))}
          </div>

          {hasExposure && (
            <div
              style={{
                marginTop: 6,
                background: 'var(--surface-2)',
                borderRadius: 8,
                padding: '8px 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ fontSize: 10, color: 'var(--fg-subtle)', display: 'flex', alignItems: 'center', gap: 4 }}>
                Associated Transaction Value
                <span title="Sum of refund amounts from cluster members. Not confirmed fraud loss." style={{ cursor: 'help' }}>
                  <Info size={10} color="var(--fg-subtle)" />
                </span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--risk-high)' }}>
                {safeExposure(cluster.estimatedExposure)}
              </div>
            </div>
          )}
        </section>

        {/* Timestamps */}
        <section>
          <SectionLabel>Timeline</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <TimeRow icon={Clock} label="First detected" value={safeRelTime(cluster.createdAt)} />
          </div>
        </section>

        {/* Why flagged */}
        <section>
          <SectionLabel>Why This Network Was Flagged</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {cluster.deviceCount > 0 && (
              <EvidenceRow
                icon={Smartphone}
                title="Shared Device"
                severity={cluster.deviceCount >= 3 ? 'HIGH' : 'MEDIUM'}
                description={`${cluster.memberCount} customers connected through ${cluster.deviceCount} device fingerprint${cluster.deviceCount > 1 ? 's' : ''}.`}
              />
            )}
            {cluster.ipCount > 0 && (
              <EvidenceRow
                icon={Globe}
                title="IP Overlap"
                severity={cluster.ipCount >= 2 ? 'HIGH' : 'MEDIUM'}
                description={`${cluster.memberCount} customers associated with ${cluster.ipCount} shared IP address${cluster.ipCount > 1 ? 'es' : ''}.`}
              />
            )}
            {cluster.refundCount > 0 && (
              <EvidenceRow
                icon={AlertTriangle}
                title="Refund Activity"
                severity={cluster.refundCount > cluster.transactionCount * 0.15 ? 'HIGH' : 'MEDIUM'}
                description={`${cluster.refundCount} refunds across ${cluster.memberCount} cluster members.`}
              />
            )}
          </div>
          <p style={{ fontSize: 9, color: 'var(--fg-subtle)', margin: '8px 0 0', lineHeight: 1.5 }}>
            Cluster detection identifies connected risk signals. It does not independently establish fraudulent intent.
          </p>
        </section>

        {/* Risk drivers */}
        <section>
          <SectionLabel>Risk Drivers</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {signals.map((sig, i) => (
              <div key={sig} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span
                  style={{
                    width: 18, height: 18, borderRadius: '50%', background: 'var(--accent-muted)',
                    color: 'var(--accent)', fontSize: 9, fontWeight: 700, display: 'flex',
                    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{sig}</div>
                  <div style={{ fontSize: 10, color: 'var(--fg-muted)', marginTop: 2 }}>
                    {sig === 'Device reuse' && `${cluster.memberCount} accounts share infrastructure.`}
                    {sig === 'IP overlap' && `Accounts connected through shared IP addresses.`}
                    {sig === 'Refund activity' && `Elevated refund count relative to member count.`}
                    {sig === 'Shared infrastructure' && `Accounts connected through shared infrastructure.`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* AI Assessment */}
        {aiAssessment && (
          <AiAssessmentPanel assessment={aiAssessment} onClose={() => setAiAssessment(null)} />
        )}

        {/* Action buttons */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {investigationId ? (
            <Link
              to={`/investigations/${investigationId}`}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '10px 16px', borderRadius: 8, fontWeight: 700, fontSize: 12,
                textDecoration: 'none',
                background: 'var(--accent)', color: 'white',
              }}
            >
              <ExternalLink size={13} />
              Open Investigation
            </Link>
          ) : (
            <button
              onClick={() => invMutation.mutate()}
              disabled={invMutation.isPending}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '10px 16px', borderRadius: 8, fontWeight: 700, fontSize: 12,
                border: 'none', cursor: invMutation.isPending ? 'default' : 'pointer',
                background: 'var(--accent)', color: 'white', opacity: invMutation.isPending ? 0.7 : 1,
              }}
            >
              {invMutation.isPending ? (
                <>
                  <span style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
                  Creating…
                </>
              ) : (
                <>
                  <FileSearch size={13} />
                  Investigate Cluster
                </>
              )}
            </button>
          )}

          {!aiAssessment && (
            <button
              onClick={() => aiMutation.mutate()}
              disabled={aiMutation.isPending}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '10px 16px', borderRadius: 8, fontWeight: 700, fontSize: 12,
                border: '1px solid var(--accent)', cursor: aiMutation.isPending ? 'default' : 'pointer',
                background: 'var(--accent-muted)', color: 'var(--accent)', opacity: aiMutation.isPending ? 0.7 : 1,
              }}
            >
              {aiMutation.isPending ? (
                <>
                  <span style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid var(--accent-muted)', borderTopColor: 'var(--accent)', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
                  Analyzing…
                </>
              ) : (
                <>
                  <Brain size={13} />
                  Generate AI Assessment
                </>
              )}
            </button>
          )}

          {aiMutation.isError && (
            <p style={{ fontSize: 10, color: 'var(--danger)', margin: 0, textAlign: 'center' }}>
              AI assessment failed. Retry or check backend.
            </p>
          )}
          {invMutation.isError && (
            <p style={{ fontSize: 10, color: 'var(--danger)', margin: 0, textAlign: 'center' }}>
              Could not create investigation.
            </p>
          )}
        </section>

        {/* Member list */}
        {cluster.members?.length > 0 && (
          <section>
            <SectionLabel>Members ({cluster.members.length})</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 140, overflowY: 'auto' }} className="no-scrollbar">
              {cluster.members.slice(0, 20).map(m => (
                <div key={m.entityId}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderRadius: 6, background: 'var(--surface-2)', fontSize: 11 }}
                >
                  <Users size={10} color="var(--fg-subtle)" />
                  <Link
                    to={`/customers/${m.entityId}`}
                    style={{ color: 'var(--accent)', textDecoration: 'none', fontFamily: 'monospace', fontSize: 10 }}
                  >
                    {m.entityId.slice(0, 8).toUpperCase()}
                  </Link>
                  <span style={{ fontSize: 9, color: 'var(--fg-subtle)', marginLeft: 'auto' }}>Customer</span>
                </div>
              ))}
              {cluster.members.length > 20 && (
                <div style={{ fontSize: 10, color: 'var(--fg-subtle)', textAlign: 'center', padding: '4px 0' }}>
                  +{cluster.members.length - 20} more members
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

// ─── Small helpers ─────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>
      {children}
    </div>
  );
}

function TimeRow({ icon: Icon, label, value }: { icon: React.ComponentType<any>; label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
      <Icon size={11} color="var(--fg-subtle)" style={{ flexShrink: 0 }} />
      <span style={{ color: 'var(--fg-subtle)', flex: 1 }}>{label}</span>
      <span style={{ color: 'var(--fg)', fontWeight: 600 }}>{value}</span>
    </div>
  );
}

const SEVERITY_COLOR: Record<string, string> = {
  HIGH:     'var(--risk-high)',
  MEDIUM:   'var(--risk-medium)',
  LOW:      'var(--risk-low)',
  CRITICAL: 'var(--risk-critical)',
};

function EvidenceRow({
  icon: Icon,
  title,
  severity,
  description,
}: {
  icon: React.ComponentType<any>;
  title: string;
  severity: string;
  description: string;
}) {
  return (
    <div
      style={{
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '8px 12px',
        display: 'flex',
        gap: 10,
      }}
    >
      <Icon size={13} color={SEVERITY_COLOR[severity] ?? 'var(--fg-subtle)'} style={{ marginTop: 1, flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg)' }}>{title}</span>
          <span
            style={{
              fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 4,
              background: SEVERITY_COLOR[severity] + '22',
              color: SEVERITY_COLOR[severity],
              letterSpacing: '0.06em',
            }}
          >
            {severity}
          </span>
        </div>
        <p style={{ fontSize: 11, color: 'var(--fg-muted)', margin: 0, lineHeight: 1.5 }}>{description}</p>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

type SignalFilter = 'ALL' | 'DEVICE' | 'IP' | 'REFUND';
type StatusFilter = 'ALL' | 'ACTIVE' | 'UNDER_REVIEW' | 'RESOLVED';
type RiskFilter   = 'ALL' | 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export function Clusters() {
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;
  const location = useLocation();
  const incomingSelectId = (location.state as any)?.selectClusterId as string | undefined;

  const [search, setSearch]           = useState('');
  const [riskFilter, setRiskFilter]   = useState<RiskFilter>('ALL');
  const [signalFilter, setSignalFilter] = useState<SignalFilter>('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');

  const [selectedCluster, setSelectedCluster] = useState<RiskCluster | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['clusters', { page, pageSize: PAGE_SIZE }],
    queryFn: () => clusterApi.getClusters({ page, pageSize: PAGE_SIZE }),
  });

  // Select the correct cluster on mount:
  // - If there's an incoming ID from ClusterDetail redirect, use that
  // - Otherwise select the first cluster
  useEffect(() => {
    if (!data?.data?.length) return;
    if (selectedCluster) return; // already set

    if (incomingSelectId) {
      const target = data.data.find(c => c.id === incomingSelectId);
      setSelectedCluster(target ?? data.data[0]);
    } else {
      setSelectedCluster(data.data[0]);
    }
  }, [data, selectedCluster, incomingSelectId]);

  const allClusters = data?.data ?? [];

  // Client-side filters (applied to already-fetched page)
  const filtered = allClusters.filter(c => {
    if (riskFilter !== 'ALL' && c.riskLevel !== riskFilter) return false;
    if (statusFilter !== 'ALL' && c.status !== statusFilter) return false;
    if (signalFilter === 'DEVICE' && c.deviceCount === 0) return false;
    if (signalFilter === 'IP'     && c.ipCount === 0) return false;
    if (signalFilter === 'REFUND' && c.refundCount === 0) return false;
    if (search) {
      const q = search.toLowerCase();
      const lbl = clusterLabel(c).toLowerCase();
      if (!lbl.includes(q) && !c.id.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // Summary metrics — computed from actual data, no hardcoding
  const totalNetworks  = data?.total ?? 0;
  const highCritical   = allClusters.filter(c => c.riskLevel === 'HIGH' || c.riskLevel === 'CRITICAL').length;
  const underReview    = allClusters.filter(c => c.status === 'UNDER_REVIEW').length;
  const totalExposure  = allClusters.reduce((sum, c) => {
    const v = c.estimatedExposure;
    return sum + (v != null && !isNaN(v) ? v : 0);
  }, 0);
  const hasExposure    = allClusters.some(c => c.estimatedExposure != null && !isNaN(c.estimatedExposure ?? NaN) && (c.estimatedExposure ?? 0) > 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Page header ─────────────────────────────────────── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Network size={18} color="var(--accent)" />
              <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--fg)', margin: 0, letterSpacing: '-0.01em' }}>
                NETWORK INTELLIGENCE
              </h1>
              <span
                style={{
                  fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
                  background: 'var(--accent-muted)', color: 'var(--accent)',
                  letterSpacing: '0.12em', textTransform: 'uppercase',
                }}
              >
                Coordinated Risk Detection
              </span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--fg-muted)', margin: 0 }}>
              Connected customers, devices and IPs exhibiting overlapping risk signals.
            </p>
          </div>
        </div>
      </div>

      {/* ── Summary row ─────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        {[
          {
            label: 'Total Networks',
            value: isLoading ? '—' : String(totalNetworks),
            icon: Network,
            accent: 'var(--accent)',
          },
          {
            label: 'High / Critical',
            value: isLoading ? '—' : String(highCritical),
            icon: ShieldAlert,
            accent: 'var(--risk-high)',
          },
          {
            label: 'Under Review',
            value: isLoading ? '—' : String(underReview),
            icon: FileSearch,
            accent: 'var(--warning)',
          },
          {
            label: hasExposure ? 'Associated Value' : 'Assoc. Tx Value',
            value: isLoading ? '—' : (hasExposure ? safeExposure(totalExposure) : 'N/A'),
            icon: AlertTriangle,
            accent: 'var(--risk-high)',
            tooltip: 'Sum of refund amounts from cluster members. Not confirmed fraud loss.',
          },
        ].map(card => (
          <div
            key={card.label}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: '12px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <div
              style={{
                width: 32, height: 32, borderRadius: 8, display: 'flex',
                alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                background: card.accent + '1a',
              }}
            >
              <card.icon size={14} color={card.accent} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '0.1em', whiteSpace: 'nowrap' }}>
                  {card.label}
                </div>
                {card.tooltip && (
                  <span title={card.tooltip} style={{ cursor: 'help', color: 'var(--fg-subtle)' }}>
                    <Info size={9} />
                  </span>
                )}
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--fg)', marginTop: 1, lineHeight: 1 }}>
                {card.value}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Investigation toolbar ────────────────────────────── */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
        }}
      >
        {/* Search */}
        <div style={{ position: 'relative', flex: '0 0 200px', minWidth: 140 }}>
          <Search size={12} color="var(--fg-subtle)" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            placeholder="Search clusters…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '6px 8px 6px 28px',
              background: 'var(--surface-2)', border: '1px solid var(--border)',
              borderRadius: 7, fontSize: 11, color: 'var(--fg)',
              outline: 'none',
            }}
            aria-label="Search clusters"
          />
        </div>

        <FilterGroup
          label="Risk"
          value={riskFilter}
          onChange={v => setRiskFilter(v as RiskFilter)}
          options={[
            { value: 'ALL', label: 'All' },
            { value: 'CRITICAL', label: 'Critical' },
            { value: 'HIGH', label: 'High' },
            { value: 'MEDIUM', label: 'Medium' },
            { value: 'LOW', label: 'Low' },
          ]}
        />

        <FilterGroup
          label="Signal"
          value={signalFilter}
          onChange={v => setSignalFilter(v as SignalFilter)}
          options={[
            { value: 'ALL',    label: 'All' },
            { value: 'DEVICE', label: 'Device reuse' },
            { value: 'IP',     label: 'IP reuse' },
            { value: 'REFUND', label: 'Refund' },
          ]}
        />

        <FilterGroup
          label="Status"
          value={statusFilter}
          onChange={v => setStatusFilter(v as StatusFilter)}
          options={[
            { value: 'ALL',          label: 'All' },
            { value: 'ACTIVE',       label: 'Active' },
            { value: 'UNDER_REVIEW', label: 'Under Review' },
            { value: 'RESOLVED',     label: 'Resolved' },
          ]}
        />

        {(search || riskFilter !== 'ALL' || signalFilter !== 'ALL' || statusFilter !== 'ALL') && (
          <button
            onClick={() => { setSearch(''); setRiskFilter('ALL'); setSignalFilter('ALL'); setStatusFilter('ALL'); }}
            style={{ fontSize: 11, color: 'var(--fg-subtle)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <X size={11} /> Clear
          </button>
        )}
      </div>

      {/* ── Main workspace ───────────────────────────────────── */}
      {isLoading ? (
        <WorkspaceLoading />
      ) : isError ? (
        <WorkspaceError onRetry={() => refetch()} />
      ) : !allClusters.length ? (
        <WorkspaceEmpty />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: selectedCluster ? '1fr 300px' : '1fr',
            gap: 12,
            minHeight: 520,
          }}
        >
          {/* ── Graph hero ─── */}
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              minHeight: 520,
            }}
          >
            {selectedCluster ? (
              <ClusterNetworkGraph
                clusterId={selectedCluster.id}
                clusterName={clusterLabel(selectedCluster)}
                riskLevel={selectedCluster.riskLevel}
              />
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  gap: 10,
                  color: 'var(--fg-subtle)',
                  padding: 40,
                }}
              >
                <Network size={32} />
                <span style={{ fontSize: 13, fontWeight: 500 }}>
                  Select a network from the table below to inspect its graph
                </span>
              </div>
            )}
          </div>

          {/* ── Selected cluster panel ─── */}
          {selectedCluster && (
            <div
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <SelectedClusterPanel
                cluster={selectedCluster}
                onClose={() => setSelectedCluster(null)}
              />
            </div>
          )}
        </div>
      )}

      {/* ── All Networks table ───────────────────────────────── */}
      {!isLoading && !isError && allClusters.length > 0 && (
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '12px 16px 10px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg)' }}>All Networks</span>
            <span style={{ fontSize: 10, color: 'var(--fg-subtle)', background: 'var(--surface-2)', padding: '1px 6px', borderRadius: 4 }}>
              {filtered.length} shown
            </span>
          </div>

          {filtered.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 80, color: 'var(--fg-subtle)', fontSize: 12 }}>
              No networks match the current filters.
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead style={{ paddingLeft: 20 }}>Cluster</TableHead>
                    <TableHead>Network</TableHead>
                    <TableHead>Activity</TableHead>
                    <TableHead>Risk</TableHead>
                    <TableHead>Key Evidence</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Detected</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(cluster => {
                    const label = clusterLabel(cluster);
                    const isSelected = selectedCluster?.id === cluster.id;
                    const sigs = deriveSignals(cluster);
                    return (
                      <TableRow
                        key={cluster.id}
                        onClick={() => {
                          setSelectedCluster(cluster);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        style={{
                          cursor: 'pointer',
                          background: isSelected ? 'var(--accent-muted)' : undefined,
                          borderLeft: isSelected ? '3px solid var(--accent)' : '3px solid transparent',
                        }}
                      >
                        <TableCell style={{ paddingLeft: 20 }}>
                          <span
                            style={{
                              fontFamily: 'monospace', fontSize: 11, fontWeight: 700,
                              padding: '2px 6px', borderRadius: 4,
                              background: isSelected ? 'var(--accent)' : 'var(--surface-2)',
                              color: isSelected ? 'white' : 'var(--fg)',
                            }}
                          >
                            {label}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div style={{ fontSize: 11, color: 'var(--fg)', fontWeight: 500 }}>
                            {safeNum(cluster.memberCount)} customers
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--fg-subtle)' }}>
                            {safeNum(cluster.deviceCount)} dev · {safeNum(cluster.ipCount)} IP
                          </div>
                        </TableCell>
                        <TableCell>
                          <div style={{ fontSize: 11, color: 'var(--fg)' }}>
                            {safeNum(cluster.transactionCount)} tx
                          </div>
                          {cluster.estimatedExposure != null && !isNaN(cluster.estimatedExposure ?? NaN) && (cluster.estimatedExposure ?? 0) > 0 && (
                            <div style={{ fontSize: 10, color: 'var(--fg-subtle)' }}>
                              {safeExposure(cluster.estimatedExposure)}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Badge variant="risk" riskLevel={cluster.riskLevel} dot>
                              {cluster.riskLevel}
                            </Badge>
                            <span style={{ fontSize: 11, fontWeight: 700, color: RISK_COLOR[cluster.riskLevel] }}>
                              {cluster.riskScore}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span style={{ fontSize: 10, color: 'var(--fg-muted)' }}>
                            {sigs[0]}
                            {sigs.length > 1 && (
                              <span style={{ color: 'var(--fg-subtle)' }}> +{sigs.length - 1}</span>
                            )}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={STATUS_VARIANT[cluster.status] as any ?? 'default'}>
                            {STATUS_LABEL[cluster.status] ?? cluster.status}
                          </Badge>
                        </TableCell>
                        <TableCell style={{ fontSize: 11, color: 'var(--fg-subtle)' }}>
                          {safeRelTime(cluster.createdAt)}
                        </TableCell>
                        <TableCell>
                          <ChevronRight size={13} color={isSelected ? 'var(--accent)' : 'var(--fg-subtle)'} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <PaginationBar
                page={page}
                pageSize={PAGE_SIZE}
                total={data?.total ?? 0}
                onPrev={() => setPage(p => Math.max(1, p - 1))}
                onNext={() => setPage(p => p + 1)}
                label="networks"
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Filter group helper ──────────────────────────────────────────────────────

function FilterGroup({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ fontSize: 10, color: 'var(--fg-subtle)', whiteSpace: 'nowrap', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        {label}
      </span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          fontSize: 11, padding: '5px 8px', background: 'var(--surface-2)',
          border: '1px solid var(--border)', borderRadius: 6, color: 'var(--fg)',
          cursor: 'pointer', outline: 'none',
        }}
        aria-label={`Filter by ${label}`}
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

// ─── Workspace states ─────────────────────────────────────────────────────────

function WorkspaceLoading() {
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: 400,
        gap: 12,
        color: 'var(--fg-subtle)',
      }}
    >
      <span style={{ width: 24, height: 24, borderRadius: '50%', border: '2.5px solid currentColor', borderTopColor: 'transparent', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
      <span style={{ fontSize: 13, fontWeight: 500 }}>Loading cluster data…</span>
    </div>
  );
}

function WorkspaceError({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--danger-bg)',
        borderRadius: 12,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: 300,
        gap: 12,
      }}
    >
      <AlertTriangle size={28} color="var(--danger)" />
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg)', marginBottom: 4 }}>
          Network Intelligence Unavailable
        </div>
        <div style={{ fontSize: 12, color: 'var(--fg-muted)' }}>Unable to load cluster data.</div>
      </div>
      <button
        onClick={onRetry}
        style={{
          padding: '8px 20px', borderRadius: 8, fontWeight: 600, fontSize: 12,
          background: 'var(--surface-2)', border: '1px solid var(--border)',
          color: 'var(--fg)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
        }}
      >
        <RefreshCw size={12} /> Retry
      </button>
    </div>
  );
}

function WorkspaceEmpty() {
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: 320,
        gap: 12,
      }}
    >
      <div
        style={{
          width: 52, height: 52, borderRadius: 14, display: 'flex', alignItems: 'center',
          justifyContent: 'center', background: 'var(--surface-2)',
        }}
      >
        <Network size={24} color="var(--fg-subtle)" />
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg)', marginBottom: 4 }}>
          No Risk Networks Detected
        </div>
        <div style={{ fontSize: 12, color: 'var(--fg-muted)', maxWidth: 340 }}>
          Zeno has not identified any connected risk clusters in the current dataset.
          Run analysis to detect coordinated risk patterns.
        </div>
      </div>
      <Link
        to="/dataset"
        style={{
          padding: '8px 20px', borderRadius: 8, fontWeight: 600, fontSize: 12,
          background: 'var(--accent)', color: 'white', textDecoration: 'none',
          display: 'flex', alignItems: 'center', gap: 6,
        }}
      >
        <CheckCircle2 size={12} /> Analyze Dataset
      </Link>
    </div>
  );
}
