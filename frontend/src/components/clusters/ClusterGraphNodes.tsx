import { Handle, Position, type NodeProps } from 'reactflow';
import { Users, Smartphone, Globe, ShieldCheck, ShieldAlert } from 'lucide-react';
import type { RiskLevel } from '@/types';

// ─── Visual Tokens ────────────────────────────────────────────────────────────

const RISK_BADGE_STYLE: Record<RiskLevel, { bg: string; text: string; border: string }> = {
  LOW:      { bg: 'var(--risk-low-bg)',      text: 'var(--risk-low)',      border: 'rgba(22, 163, 74, 0.4)' },
  MEDIUM:   { bg: 'var(--risk-medium-bg)',   text: 'var(--risk-medium)',   border: 'rgba(217, 119, 6, 0.4)' },
  HIGH:     { bg: 'var(--risk-high-bg)',     text: 'var(--risk-high)',     border: 'rgba(234, 88, 12, 0.45)' },
  CRITICAL: { bg: 'var(--risk-critical-bg)', text: 'var(--risk-critical)', border: 'rgba(220, 38, 38, 0.5)' },
};

export interface CustomerNodeData {
  nodeType: 'CUSTOMER';
  label: string;
  customerId: string;
  riskScore: number;
  riskLevel: RiskLevel;
  connectedCount: number;
  selected?: boolean;
}

export interface DeviceNodeData {
  nodeType: 'DEVICE';
  label: string;
  deviceId: string;
  connectedCount: number;
  selected?: boolean;
}

export interface IpNodeData {
  nodeType: 'IP';
  label: string;
  ip: string;
  connectedCount: number;
  selected?: boolean;
}

// ─── Customer Node ────────────────────────────────────────────────────────────

export function CustomerNode({ data, selected }: NodeProps<CustomerNodeData>) {
  const risk = data.riskLevel ?? 'LOW';
  const badgeStyle = RISK_BADGE_STYLE[risk];
  const isHighRisk = risk === 'HIGH' || risk === 'CRITICAL';

  return (
    <div
      style={{
        width: 190,
        borderRadius: 12,
        background: 'var(--surface)',
        border: selected
          ? '2px solid var(--accent)'
          : isHighRisk
          ? `2px solid ${badgeStyle.text}`
          : '1px solid var(--border-strong)',
        boxShadow: selected
          ? '0 0 0 4px rgba(94, 91, 193, 0.25), 0 8px 24px rgba(0, 0, 0, 0.2)'
          : isHighRisk
          ? `0 4px 16px ${badgeStyle.text}22`
          : '0 2px 8px rgba(0, 0, 0, 0.08)',
        transition: 'all 0.2s ease',
        cursor: 'pointer',
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      {/* Connector Handles */}
      <Handle
        type="target"
        position={Position.Left}
        id="c-left"
        style={{ width: 8, height: 8, background: 'var(--accent)', border: '2px solid var(--surface)' }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="c-right"
        style={{ width: 8, height: 8, background: 'var(--accent)', border: '2px solid var(--surface)' }}
      />
      <Handle
        type="target"
        position={Position.Top}
        id="c-top"
        style={{ width: 8, height: 8, background: 'var(--accent)', border: '2px solid var(--surface)', opacity: 0 }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="c-bottom"
        style={{ width: 8, height: 8, background: 'var(--accent)', border: '2px solid var(--surface)', opacity: 0 }}
      />

      {/* Header bar */}
      <div
        style={{
          padding: '6px 10px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface-2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div
            style={{
              width: 18,
              height: 18,
              borderRadius: 6,
              background: 'rgba(94, 91, 193, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent)',
            }}
          >
            <Users size={11} />
          </div>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--fg-muted)', letterSpacing: '0.04em' }}>
            CUSTOMER
          </span>
        </div>

        {/* Risk score pill */}
        <span
          style={{
            fontSize: 9,
            fontWeight: 800,
            padding: '1px 6px',
            borderRadius: 100,
            background: badgeStyle.bg,
            color: badgeStyle.text,
            border: `1px solid ${badgeStyle.border}`,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 3,
          }}
        >
          {isHighRisk ? <ShieldAlert size={9} /> : <ShieldCheck size={9} />}
          {data.riskScore != null ? `${data.riskScore} ${risk}` : risk}
        </span>
      </div>

      {/* Body */}
      <div style={{ padding: '8px 10px' }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: 'var(--fg)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
          title={data.label}
        >
          {data.label}
        </div>
        <div
          style={{
            fontSize: 10,
            color: 'var(--fg-subtle)',
            marginTop: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>ID: {data.customerId ? data.customerId.slice(0, 8).toUpperCase() : '—'}</span>
          <span>{data.connectedCount} links</span>
        </div>
      </div>
    </div>
  );
}

// ─── Device Node ──────────────────────────────────────────────────────────────

export function DeviceNode({ data, selected }: NodeProps<DeviceNodeData>) {
  return (
    <div
      style={{
        width: 190,
        borderRadius: 12,
        background: 'var(--surface)',
        border: selected
          ? '2px solid #10b981'
          : '1px solid rgba(16, 185, 129, 0.4)',
        boxShadow: selected
          ? '0 0 0 4px rgba(16, 185, 129, 0.22), 0 8px 24px rgba(0, 0, 0, 0.2)'
          : '0 2px 8px rgba(0, 0, 0, 0.08)',
        transition: 'all 0.2s ease',
        cursor: 'pointer',
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      {/* Connector Handles */}
      <Handle
        type="target"
        position={Position.Left}
        id="d-left"
        style={{ width: 8, height: 8, background: '#10b981', border: '2px solid var(--surface)' }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="d-right"
        style={{ width: 8, height: 8, background: '#10b981', border: '2px solid var(--surface)' }}
      />
      <Handle
        type="target"
        position={Position.Top}
        id="d-top"
        style={{ width: 8, height: 8, background: '#10b981', border: '2px solid var(--surface)', opacity: 0 }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="d-bottom"
        style={{ width: 8, height: 8, background: '#10b981', border: '2px solid var(--surface)', opacity: 0 }}
      />

      {/* Header bar */}
      <div
        style={{
          padding: '6px 10px',
          borderBottom: '1px solid var(--border)',
          background: 'rgba(16, 185, 129, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div
            style={{
              width: 18,
              height: 18,
              borderRadius: 6,
              background: 'rgba(16, 185, 129, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#10b981',
            }}
          >
            <Smartphone size={11} />
          </div>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#10b981', letterSpacing: '0.04em' }}>
            DEVICE
          </span>
        </div>

        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            padding: '1px 6px',
            borderRadius: 100,
            background: 'rgba(16, 185, 129, 0.15)',
            color: '#10b981',
          }}
        >
          Shared Hub
        </span>
      </div>

      {/* Body */}
      <div style={{ padding: '8px 10px' }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: 'var(--fg)',
            fontFamily: 'monospace',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
          title={data.deviceId || data.label}
        >
          {data.deviceId ? data.deviceId.slice(0, 14) : data.label}
        </div>
        <div style={{ fontSize: 10, color: 'var(--fg-subtle)', marginTop: 2 }}>
          {data.connectedCount} accounts sharing
        </div>
      </div>
    </div>
  );
}

// ─── IP Node ──────────────────────────────────────────────────────────────────

export function IpNode({ data, selected }: NodeProps<IpNodeData>) {
  return (
    <div
      style={{
        width: 190,
        borderRadius: 12,
        background: 'var(--surface)',
        border: selected
          ? '2px solid #0284c7'
          : '1px solid rgba(2, 132, 199, 0.4)',
        boxShadow: selected
          ? '0 0 0 4px rgba(2, 132, 199, 0.22), 0 8px 24px rgba(0, 0, 0, 0.2)'
          : '0 2px 8px rgba(0, 0, 0, 0.08)',
        transition: 'all 0.2s ease',
        cursor: 'pointer',
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      {/* Connector Handles */}
      <Handle
        type="target"
        position={Position.Left}
        id="ip-left"
        style={{ width: 8, height: 8, background: '#0284c7', border: '2px solid var(--surface)' }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="ip-right"
        style={{ width: 8, height: 8, background: '#0284c7', border: '2px solid var(--surface)' }}
      />
      <Handle
        type="target"
        position={Position.Top}
        id="ip-top"
        style={{ width: 8, height: 8, background: '#0284c7', border: '2px solid var(--surface)', opacity: 0 }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="ip-bottom"
        style={{ width: 8, height: 8, background: '#0284c7', border: '2px solid var(--surface)', opacity: 0 }}
      />

      {/* Header bar */}
      <div
        style={{
          padding: '6px 10px',
          borderBottom: '1px solid var(--border)',
          background: 'rgba(2, 132, 199, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div
            style={{
              width: 18,
              height: 18,
              borderRadius: 6,
              background: 'rgba(2, 132, 199, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#0284c7',
            }}
          >
            <Globe size={11} />
          </div>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#0284c7', letterSpacing: '0.04em' }}>
            IP ADDRESS
          </span>
        </div>

        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            padding: '1px 6px',
            borderRadius: 100,
            background: 'rgba(2, 132, 199, 0.15)',
            color: '#0284c7',
          }}
        >
          Network
        </span>
      </div>

      {/* Body */}
      <div style={{ padding: '8px 10px' }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: 'var(--fg)',
            fontFamily: 'monospace',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
          title={data.ip || data.label}
        >
          {data.ip || data.label}
        </div>
        <div style={{ fontSize: 10, color: 'var(--fg-subtle)', marginTop: 2 }}>
          {data.connectedCount} accounts sharing
        </div>
      </div>
    </div>
  );
}

// ─── Exported React Flow Node Types ───────────────────────────────────────────

export const clusterNodeTypes = {
  customerNode: CustomerNode,
  deviceNode: DeviceNode,
  ipNode: IpNode,
};
