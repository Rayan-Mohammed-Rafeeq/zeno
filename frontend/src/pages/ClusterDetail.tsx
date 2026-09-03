import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  MarkerType,
  type Connection,
  type Node,
  type Edge,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { clusterApi } from '@/services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatNumber, formatCurrency, formatRelativeTime } from '@/lib/utils';
import { ArrowLeft, Network, Users, Smartphone, Globe, Receipt, AlertTriangle } from 'lucide-react';
import type { GraphNode } from '@/types';

/* ── Node type colours ─────────────────────────────────────────── */
const NODE_COLORS: Record<GraphNode['type'], { bg: string; border: string; text: string }> = {
  CUSTOMER:    { bg: '#1e2040', border: '#8588e6', text: '#a5a8f0' },
  DEVICE:      { bg: '#1a2a1a', border: '#4ade80', text: '#86efac' },
  IP:          { bg: '#1a2030', border: '#38bdf8', text: '#7dd3fc' },
  TRANSACTION: { bg: '#2a1a1a', border: '#fb923c', text: '#fdba74' },
  REFUND:      { bg: '#2a1a2a', border: '#f87171', text: '#fca5a5' },
};

const NODE_ICONS: Record<GraphNode['type'], string> = {
  CUSTOMER:    '👤',
  DEVICE:      '📱',
  IP:          '🌐',
  TRANSACTION: '💳',
  REFUND:      '↩️',
};

function buildFlowNodes(graphNodes: GraphNode[]): Node[] {
  const cols: Record<GraphNode['type'], number> = {
    CUSTOMER: 0, DEVICE: 1, IP: 2, TRANSACTION: 3, REFUND: 4,
  };
  const counts: Partial<Record<GraphNode['type'], number>> = {};

  return graphNodes.map((n) => {
    const col = cols[n.type] ?? 0;
    const row = counts[n.type] ?? 0;
    counts[n.type] = row + 1;
    const c = NODE_COLORS[n.type];

    return {
      id: n.id,
      position: { x: col * 220 + 40, y: row * 100 + 40 },
      data: {
        label: (
          <div style={{ textAlign: 'center', padding: '4px 8px' }}>
            <div style={{ fontSize: 16 }}>{NODE_ICONS[n.type]}</div>
            <div style={{ fontSize: 10, fontWeight: 600, color: c.text, marginTop: 2 }}>
              {n.label.length > 16 ? n.label.slice(0, 15) + '…' : n.label}
            </div>
            <div style={{ fontSize: 9, color: c.text, opacity: 0.6, marginTop: 1 }}>{n.type}</div>
          </div>
        ),
      },
      style: {
        background: c.bg,
        border: `1.5px solid ${c.border}`,
        borderRadius: 12,
        width: 100,
        cursor: 'default',
      },
    };
  });
}

function buildFlowEdges(graphEdges: { id: string; source: string; target: string; type: string; label?: string }[]): Edge[] {
  return graphEdges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.label,
    style: { stroke: '#3d4158', strokeWidth: 1.5 },
    labelStyle: { fill: '#9da3ae', fontSize: 9 },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#3d4158' },
  }));
}

export function ClusterDetail() {
  const { id } = useParams<{ id: string }>();

  const { data: cluster, isLoading: clusterLoading } = useQuery({
    queryKey: ['cluster', id],
    queryFn: () => clusterApi.getCluster(id!),
    enabled: !!id,
  });

  const { data: graph, isLoading: graphLoading } = useQuery({
    queryKey: ['cluster-graph', id],
    queryFn: () => clusterApi.getClusterGraph(id!),
    enabled: !!id,
  });

  const [_nodes, , onNodesChange] = useNodesState(
    graph ? buildFlowNodes(graph.nodes) : [],
  );
  const [_edges, setEdges, onEdgesChange] = useEdgesState(
    graph ? buildFlowEdges(graph.edges) : [],
  );
  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
    [setEdges],
  );

  // Re-init when graph loads
  const flowNodes = graph ? buildFlowNodes(graph.nodes) : [];
  const flowEdges = graph ? buildFlowEdges(graph.edges) : [];

  if (clusterLoading) {
    return (
      <div className="flex items-center justify-center h-64 gap-3" style={{ color: 'var(--fg-subtle)' }}>
        <span className="h-5 w-5 border-2 border-current/20 border-t-current rounded-full animate-spin" />
        Loading cluster…
      </div>
    );
  }

  if (!cluster) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-2">
        <Network className="h-10 w-10" style={{ color: 'var(--fg-subtle)' }} />
        <p style={{ color: 'var(--fg-muted)' }}>Cluster not found</p>
        <Link to="/clusters" className="text-sm hover:underline" style={{ color: 'var(--accent)' }}>Back to clusters</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link to="/clusters" className="inline-flex items-center gap-2 text-sm hover:underline" style={{ color: 'var(--accent)' }}>
        <ArrowLeft className="h-4 w-4" />Back to clusters
      </Link>

      {/* Header card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
            <div>
              <div className="flex items-center gap-3 flex-wrap mb-2">
                <h1 className="text-2xl font-bold" style={{ color: 'var(--fg)' }}>{cluster.clusterId}</h1>
                <Badge variant="risk" riskLevel={cluster.riskLevel}>{cluster.riskLevel} RISK</Badge>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-md"
                  style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}>
                  {cluster.status}
                </span>
              </div>
              <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>
                Primary signal: <strong style={{ color: 'var(--fg)' }}>{cluster.primarySignal}</strong>
                {' '}· Detected {formatRelativeTime(cluster.detectedAt)}
              </p>
            </div>
            <div className="text-right">
              <div className="text-xs" style={{ color: 'var(--fg-subtle)' }}>Total Exposure</div>
              <div className="text-3xl font-bold" style={{ color: 'var(--risk-high)' }}>
                {formatCurrency(cluster.totalExposure)}
              </div>
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { icon: Users,   label: 'Customers',    val: cluster.customerCount    },
              { icon: Smartphone, label: 'Devices',   val: cluster.deviceCount      },
              { icon: Globe,   label: 'IPs',          val: cluster.ipCount          },
              { icon: Receipt, label: 'Transactions', val: formatNumber(cluster.transactionCount) },
              { icon: AlertTriangle, label: 'Refunds', val: cluster.refundCount,
                color: cluster.refundCount > 10 ? 'var(--risk-high)' : undefined },
            ].map(({ icon: Icon, label, val, color }) => (
              <div key={label} className="rounded-xl p-4 text-center"
                style={{ background: 'var(--surface-2)' }}>
                <Icon className="h-4 w-4 mx-auto mb-2" style={{ color: color ?? 'var(--fg-subtle)' }} />
                <div className="text-xl font-bold" style={{ color: color ?? 'var(--fg)' }}>{val}</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--fg-subtle)' }}>{label}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Graph */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle>Relationship Graph</CardTitle>
            <div className="flex items-center gap-3 flex-wrap">
              {(['CUSTOMER', 'DEVICE', 'IP'] as const).map((t) => (
                <div key={t} className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--fg-muted)' }}>
                  <span className="h-2.5 w-2.5 rounded-full"
                    style={{ background: NODE_COLORS[t].border }} />
                  {t}
                </div>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {graphLoading ? (
            <div className="flex items-center justify-center h-64 gap-3" style={{ color: 'var(--fg-subtle)' }}>
              <span className="h-5 w-5 border-2 border-current/20 border-t-current rounded-full animate-spin" />
              Building graph…
            </div>
          ) : (
            <div style={{ height: 480, borderRadius: '0 0 12px 12px', overflow: 'hidden' }}>
              <ReactFlow
                nodes={flowNodes}
                edges={flowEdges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                fitView
                style={{ background: 'var(--surface-2)' }}
                nodesDraggable
                nodesConnectable={false}
              >
                <Background color="var(--border)" gap={24} size={1} />
                <Controls style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }} />
                <MiniMap
                  style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}
                  nodeColor={(n) => {
                    const type = (n.data as any)?.type ?? 'CUSTOMER';
                    return NODE_COLORS[type as GraphNode['type']]?.border ?? '#8588e6';
                  }}
                />
              </ReactFlow>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Evidence banner */}
      <Card>
        <CardHeader><CardTitle>Why this cluster was flagged</CardTitle></CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-3 gap-3">
            {[
              { title: 'Shared Device Fingerprints', desc: `${cluster.deviceCount} devices used across ${cluster.customerCount} accounts — indicates coordinated account creation or shared infrastructure.` },
              { title: 'IP Address Clustering',      desc: `${cluster.ipCount} IP addresses show repeated use across multiple customer accounts, consistent with coordinated fraud patterns.` },
              { title: 'Elevated Refund Activity',   desc: `${cluster.refundCount} refunds across ${formatNumber(cluster.transactionCount)} transactions — significantly above the merchant baseline.` },
            ].map((e) => (
              <div key={e.title} className="rounded-xl p-4"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                <div className="flex items-start gap-2 mb-2">
                  <span className="h-1.5 w-1.5 rounded-full mt-1.5 shrink-0" style={{ background: 'var(--accent)' }} />
                  <span className="text-sm font-semibold" style={{ color: 'var(--fg)' }}>{e.title}</span>
                </div>
                <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>{e.desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
