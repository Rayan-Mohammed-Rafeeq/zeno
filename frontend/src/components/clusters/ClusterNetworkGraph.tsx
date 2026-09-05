import { useState, useEffect, useCallback, useMemo } from 'react';
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  MarkerType,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  type Node,
  type Edge,
  type NodeMouseHandler,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  clusterNodeTypes,
  type CustomerNodeData,
  type DeviceNodeData,
  type IpNodeData,
} from './ClusterGraphNodes';
import { clusterApi } from '@/services/api';
import type { RiskLevel } from '@/types';
import {
  Network,
  Users,
  Smartphone,
  Globe,
  Maximize2,
  RotateCcw,
  LayoutGrid,
  CircleDot,
  ExternalLink,
  X,
  AlertTriangle,
} from 'lucide-react';

export type SelectedNodeInfo = CustomerNodeData | DeviceNodeData | IpNodeData;

export type LayoutMode = 'COLUMNS' | 'RADIAL';
export type FilterNodeType = 'ALL' | 'CUSTOMER' | 'DEVICE' | 'IP';

interface RawNode {
  id: string;
  type: string;
  label: string;
  data: Record<string, any>;
  riskLevel?: RiskLevel;
}

interface RawEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  label?: string;
}

// ─── Layout calculation ───────────────────────────────────────────────────────

function calculateGraphLayout(
  rawNodes: RawNode[],
  rawEdges: RawEdge[],
  layoutMode: LayoutMode,
  filterType: FilterNodeType,
  selectedNodeId?: string | null
): { nodes: Node[]; edges: Edge[] } {
  // Filter nodes if requested
  const visibleRawNodes = rawNodes.filter(n => {
    if (filterType === 'ALL') return true;
    return n.type === filterType;
  });

  const visibleNodeIds = new Set(visibleRawNodes.map(n => n.id));

  // Filter edges where both endpoints are visible
  const visibleRawEdges = rawEdges.filter(
    e => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target)
  );

  // Pre-calculate connection counts per node
  const degreeMap = new Map<string, number>();
  visibleRawEdges.forEach(e => {
    degreeMap.set(e.source, (degreeMap.get(e.source) ?? 0) + 1);
    degreeMap.set(e.target, (degreeMap.get(e.target) ?? 0) + 1);
  });

  const customers = visibleRawNodes.filter(n => n.type === 'CUSTOMER');
  const devices = visibleRawNodes.filter(n => n.type === 'DEVICE');
  const ips = visibleRawNodes.filter(n => n.type === 'IP');

  const nodes: Node[] = [];

  if (layoutMode === 'COLUMNS') {
    // ── Three-column hierarchical layout ──
    const COL_GAP = 280;
    const ROW_GAP = 96;

    const maxRows = Math.max(customers.length, devices.length, ips.length, 1);
    const getOffsetY = (count: number) => ((maxRows - count) / 2) * ROW_GAP;

    // Column 0: Customers
    customers.forEach((c, idx) => {
      const riskScore = Number(c.data?.riskScore ?? 0);
      const rl: RiskLevel =
        c.riskLevel ??
        (riskScore >= 90 ? 'CRITICAL' : riskScore >= 70 ? 'HIGH' : riskScore >= 40 ? 'MEDIUM' : 'LOW');
      const custId = String(c.data?.customerId ?? c.id);

      nodes.push({
        id: c.id,
        type: 'customerNode',
        position: { x: 40, y: 40 + idx * ROW_GAP + getOffsetY(customers.length) },
        data: {
          nodeType: 'CUSTOMER',
          label: c.label || `Customer ${idx + 1}`,
          customerId: custId,
          riskScore,
          riskLevel: rl,
          connectedCount: degreeMap.get(c.id) ?? 0,
          selected: c.id === selectedNodeId,
        } as CustomerNodeData,
      });
    });

    // Column 1: Devices
    devices.forEach((d, idx) => {
      const devId = String(d.data?.deviceId ?? d.id);
      nodes.push({
        id: d.id,
        type: 'deviceNode',
        position: { x: 40 + COL_GAP, y: 40 + idx * ROW_GAP + getOffsetY(devices.length) },
        data: {
          nodeType: 'DEVICE',
          label: d.label || `Device ${idx + 1}`,
          deviceId: devId,
          connectedCount: degreeMap.get(d.id) ?? 0,
          selected: d.id === selectedNodeId,
        } as DeviceNodeData,
      });
    });

    // Column 2: IPs
    ips.forEach((ip, idx) => {
      const ipAddress = String(ip.data?.ip ?? ip.data?.ipAddress ?? ip.label);
      nodes.push({
        id: ip.id,
        type: 'ipNode',
        position: { x: 40 + COL_GAP * 2, y: 40 + idx * ROW_GAP + getOffsetY(ips.length) },
        data: {
          nodeType: 'IP',
          label: ip.label || ipAddress,
          ip: ipAddress,
          connectedCount: degreeMap.get(ip.id) ?? 0,
          selected: ip.id === selectedNodeId,
        } as IpNodeData,
      });
    });
  } else {
    // ── Radial / Hub & Spoke Layout ──
    const hubs = [...devices, ...ips];
    const hubCount = Math.max(hubs.length, 1);
    const customerCount = Math.max(customers.length, 1);

    const centerX = 360;
    const centerY = 300;
    const innerRadius = Math.min(100, hubCount * 45);
    const outerRadius = Math.max(260, customerCount * 32);

    // Place shared hubs in inner circle
    hubs.forEach((hub, idx) => {
      const angle = (idx / hubCount) * 2 * Math.PI - Math.PI / 2;
      const x = centerX + (hubCount === 1 ? 0 : innerRadius * Math.cos(angle)) - 95;
      const y = centerY + (hubCount === 1 ? 0 : innerRadius * Math.sin(angle)) - 32;

      if (hub.type === 'DEVICE') {
        const devId = String(hub.data?.deviceId ?? hub.id);
        nodes.push({
          id: hub.id,
          type: 'deviceNode',
          position: { x, y },
          data: {
            nodeType: 'DEVICE',
            label: hub.label || `Device ${idx + 1}`,
            deviceId: devId,
            connectedCount: degreeMap.get(hub.id) ?? 0,
            selected: hub.id === selectedNodeId,
          } as DeviceNodeData,
        });
      } else {
        const ipAddress = String(hub.data?.ip ?? hub.data?.ipAddress ?? hub.label);
        nodes.push({
          id: hub.id,
          type: 'ipNode',
          position: { x, y },
          data: {
            nodeType: 'IP',
            label: hub.label || ipAddress,
            ip: ipAddress,
            connectedCount: degreeMap.get(hub.id) ?? 0,
            selected: hub.id === selectedNodeId,
          } as IpNodeData,
        });
      }
    });

    // Place customers in outer circle
    customers.forEach((c, idx) => {
      const angle = (idx / customerCount) * 2 * Math.PI - Math.PI / 2;
      const x = centerX + outerRadius * Math.cos(angle) - 95;
      const y = centerY + outerRadius * Math.sin(angle) - 32;

      const riskScore = Number(c.data?.riskScore ?? 0);
      const rl: RiskLevel =
        c.riskLevel ??
        (riskScore >= 90 ? 'CRITICAL' : riskScore >= 70 ? 'HIGH' : riskScore >= 40 ? 'MEDIUM' : 'LOW');
      const custId = String(c.data?.customerId ?? c.id);

      nodes.push({
        id: c.id,
        type: 'customerNode',
        position: { x, y },
        data: {
          nodeType: 'CUSTOMER',
          label: c.label || `Customer ${idx + 1}`,
          customerId: custId,
          riskScore,
          riskLevel: rl,
          connectedCount: degreeMap.get(c.id) ?? 0,
          selected: c.id === selectedNodeId,
        } as CustomerNodeData,
      });
    });
  }

  // ── Build stylized edges ──
  const edges: Edge[] = visibleRawEdges.map(e => {
    const isDevice = e.type === 'USED_DEVICE' || e.target.toLowerCase().includes('device');
    const edgeColor = isDevice ? '#10b981' : '#0284c7';

    const isConnectedToSelected =
      selectedNodeId != null && (e.source === selectedNodeId || e.target === selectedNodeId);

    const opacity = selectedNodeId == null ? 0.75 : isConnectedToSelected ? 1 : 0.15;
    const strokeWidth = isConnectedToSelected ? 2.5 : 1.8;

    return {
      id: e.id,
      source: e.source,
      target: e.target,
      type: 'smoothstep',
      animated: isConnectedToSelected,
      label: e.label || (isDevice ? 'shared device' : 'shared IP'),
      style: {
        stroke: isConnectedToSelected ? 'var(--accent)' : edgeColor,
        strokeWidth,
        opacity,
        transition: 'all 0.2s ease',
      },
      labelStyle: {
        fontSize: 9,
        fill: isConnectedToSelected ? 'var(--accent)' : 'var(--fg-muted)',
        fontWeight: isConnectedToSelected ? 700 : 500,
      },
      labelBgStyle: {
        fill: 'var(--surface)',
        fillOpacity: 0.95,
        rx: 4,
        ry: 4,
      },
      labelBgPadding: [4, 2] as [number, number],
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: isConnectedToSelected ? 'var(--accent)' : edgeColor,
        width: 14,
        height: 14,
      },
    };
  });

  return { nodes, edges };
}

// ─── Inner Canvas Component ───────────────────────────────────────────────────

function ClusterCanvas({
  clusterId,
  clusterName,
  riskLevel,
  onSelectNode,
}: {
  clusterId: string;
  clusterName?: string;
  riskLevel?: RiskLevel;
  onSelectNode?: (data: SelectedNodeInfo | null) => void;
}) {
  const { fitView } = useReactFlow();

  const { data: graphData, isLoading, isError, refetch } = useQuery({
    queryKey: ['cluster-graph', clusterId],
    queryFn: () => clusterApi.getClusterGraph(clusterId),
    enabled: !!clusterId,
  });

  const [layoutMode, setLayoutMode] = useState<LayoutMode>('COLUMNS');
  const [filterType, setFilterType] = useState<FilterNodeType>('ALL');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedNodeData, setSelectedNodeData] = useState<SelectedNodeInfo | null>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Compute layout when graph data, layout mode, filter, or selected node changes
  const computed = useMemo(() => {
    if (!graphData || !graphData.nodes) return { nodes: [], edges: [] };
    return calculateGraphLayout(
      graphData.nodes as RawNode[],
      graphData.edges as RawEdge[],
      layoutMode,
      filterType,
      selectedNodeId
    );
  }, [graphData, layoutMode, filterType, selectedNodeId]);

  // Sync to React Flow state
  useEffect(() => {
    setNodes(computed.nodes);
    setEdges(computed.edges);
  }, [computed, setNodes, setEdges]);

  // Auto fit-view on data or layout change
  useEffect(() => {
    const timer = setTimeout(() => {
      fitView({ padding: 0.25, duration: 400 });
    }, 50);
    return () => clearTimeout(timer);
  }, [clusterId, layoutMode, filterType, fitView]);

  // Node click handler
  const onNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      const data = node.data as SelectedNodeInfo;
      if (selectedNodeId === node.id) {
        // Deselect
        setSelectedNodeId(null);
        setSelectedNodeData(null);
        onSelectNode?.(null);
      } else {
        setSelectedNodeId(node.id);
        setSelectedNodeData(data);
        onSelectNode?.(data);
      }
    },
    [selectedNodeId, onSelectNode]
  );

  // Pane click handler (deselect when clicking empty canvas)
  const onPaneClick = useCallback(() => {
    if (selectedNodeId != null) {
      setSelectedNodeId(null);
      setSelectedNodeData(null);
      onSelectNode?.(null);
    }
  }, [selectedNodeId, onSelectNode]);

  // Reset node positions back to clean automated layout
  const handleResetLayout = useCallback(() => {
    if (!graphData || !graphData.nodes) return;
    const fresh = calculateGraphLayout(
      graphData.nodes as RawNode[],
      graphData.edges as RawEdge[],
      layoutMode,
      filterType,
      selectedNodeId
    );
    setNodes(fresh.nodes);
    setEdges(fresh.edges);
    setTimeout(() => {
      fitView({ padding: 0.25, duration: 400 });
    }, 30);
  }, [graphData, layoutMode, filterType, selectedNodeId, setNodes, setEdges, fitView]);

  // MiniMap node color mapper
  const getMiniMapColor = useCallback((node: Node) => {
    if (node.type === 'customerNode') {
      const rl = (node.data as CustomerNodeData).riskLevel;
      if (rl === 'CRITICAL') return '#dc2626';
      if (rl === 'HIGH') return '#ea580c';
      if (rl === 'MEDIUM') return '#d97706';
      return '#818cf8';
    }
    if (node.type === 'deviceNode') return '#10b981';
    if (node.type === 'ipNode') return '#0284c7';
    return '#9ca3af';
  }, []);

  const totalCustomers = (graphData?.nodes ?? []).filter(n => n.type === 'CUSTOMER').length;
  const totalDevices = (graphData?.nodes ?? []).filter(n => n.type === 'DEVICE').length;
  const totalIps = (graphData?.nodes ?? []).filter(n => n.type === 'IP').length;

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          gap: 12,
          color: 'var(--fg-subtle)',
          background: 'var(--surface-2)',
        }}
      >
        <span
          style={{
            width: 26,
            height: 26,
            borderRadius: '50%',
            border: '2.5px solid var(--accent)',
            borderTopColor: 'transparent',
            animation: 'spin 0.7s linear infinite',
          }}
        />
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-muted)' }}>
          Constructing network relationships…
        </span>
      </div>
    );
  }

  if (isError) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          gap: 12,
          color: 'var(--fg-subtle)',
          background: 'var(--surface-2)',
        }}
      >
        <AlertTriangle size={28} color="var(--danger)" />
        <span style={{ fontSize: 13, color: 'var(--fg-muted)' }}>Failed to load cluster network</span>
        <button
          onClick={() => refetch()}
          style={{
            padding: '6px 14px',
            borderRadius: 8,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!graphData || !graphData.nodes?.length) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          gap: 8,
          color: 'var(--fg-subtle)',
          background: 'var(--surface-2)',
        }}
      >
        <Network size={28} />
        <span style={{ fontSize: 13 }}>No graph connections detected for this cluster</span>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', display: 'flex', flexDirection: 'column' }}>
      {/* ── Toolbar Header ── */}
      <div
        style={{
          padding: '8px 14px',
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 10,
          zIndex: 10,
        }}
      >
        {/* Left: Cluster Title & Counts */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--fg)',
            }}
          >
            <Network size={15} color="var(--accent)" />
            <span>{clusterName || `Cluster ${clusterId.slice(0, 8)}`}</span>
            {riskLevel && (
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 800,
                  padding: '1px 6px',
                  borderRadius: 100,
                  background:
                    riskLevel === 'CRITICAL'
                      ? 'var(--risk-critical-bg)'
                      : riskLevel === 'HIGH'
                      ? 'var(--risk-high-bg)'
                      : riskLevel === 'MEDIUM'
                      ? 'var(--risk-medium-bg)'
                      : 'var(--risk-low-bg)',
                  color:
                    riskLevel === 'CRITICAL'
                      ? 'var(--risk-critical)'
                      : riskLevel === 'HIGH'
                      ? 'var(--risk-high)'
                      : riskLevel === 'MEDIUM'
                      ? 'var(--risk-medium)'
                      : 'var(--risk-low)',
                  border: '1px solid currentColor',
                }}
              >
                {riskLevel}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--fg-subtle)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <Users size={11} color="var(--accent)" /> {totalCustomers}
            </span>
            <span>•</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <Smartphone size={11} color="#10b981" /> {totalDevices}
            </span>
            <span>•</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <Globe size={11} color="#0284c7" /> {totalIps}
            </span>
          </div>
        </div>

        {/* Center: Entity Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--surface-2)', padding: 2, borderRadius: 8 }}>
          {(['ALL', 'CUSTOMER', 'DEVICE', 'IP'] as FilterNodeType[]).map(type => {
            const active = filterType === type;
            const label =
              type === 'ALL'
                ? 'All Entities'
                : type === 'CUSTOMER'
                ? `Customers (${totalCustomers})`
                : type === 'DEVICE'
                ? `Devices (${totalDevices})`
                : `IPs (${totalIps})`;

            return (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                style={{
                  padding: '3px 9px',
                  borderRadius: 6,
                  border: 'none',
                  background: active ? 'var(--surface)' : 'transparent',
                  color: active ? 'var(--fg)' : 'var(--fg-muted)',
                  fontWeight: active ? 700 : 500,
                  fontSize: 11,
                  cursor: 'pointer',
                  boxShadow: active ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Right: Layout & View Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Layout mode switcher */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: 'var(--surface-2)', padding: 2, borderRadius: 8 }}>
            <button
              onClick={() => setLayoutMode('COLUMNS')}
              title="Hierarchical Column Layout"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '3px 8px',
                borderRadius: 6,
                border: 'none',
                background: layoutMode === 'COLUMNS' ? 'var(--surface)' : 'transparent',
                color: layoutMode === 'COLUMNS' ? 'var(--accent)' : 'var(--fg-muted)',
                fontWeight: 600,
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              <LayoutGrid size={12} />
              Columns
            </button>
            <button
              onClick={() => setLayoutMode('RADIAL')}
              title="Hub & Spoke Radial Layout"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '3px 8px',
                borderRadius: 6,
                border: 'none',
                background: layoutMode === 'RADIAL' ? 'var(--surface)' : 'transparent',
                color: layoutMode === 'RADIAL' ? 'var(--accent)' : 'var(--fg-muted)',
                fontWeight: 600,
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              <CircleDot size={12} />
              Radial
            </button>
          </div>

          {/* Reset positions */}
          <button
            onClick={handleResetLayout}
            title="Reset Positions & Tidy Layout"
            style={{
              padding: '5px 8px',
              borderRadius: 6,
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              color: 'var(--fg-muted)',
              fontSize: 11,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <RotateCcw size={12} />
            Reset
          </button>

          {/* Fit view */}
          <button
            onClick={() => fitView({ padding: 0.25, duration: 400 })}
            title="Fit Graph to Screen"
            style={{
              padding: '5px 8px',
              borderRadius: 6,
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              color: 'var(--fg-muted)',
              fontSize: 11,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Maximize2 size={12} />
            Fit
          </button>
        </div>
      </div>

      {/* ── React Flow Canvas ── */}
      <div style={{ flex: 1, position: 'relative', width: '100%' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={clusterNodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          nodesDraggable
          nodesConnectable={false}
          fitView
          fitViewOptions={{ padding: 0.25 }}
          proOptions={{ hideAttribution: true }}
          style={{ background: 'var(--surface-2)' }}
        >
          <Background variant={BackgroundVariant.Dots} gap={24} size={1.2} color="var(--border)" />

          <Controls
            showInteractive={false}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            }}
          />

          <MiniMap
            nodeColor={getMiniMapColor}
            nodeStrokeWidth={2}
            nodeBorderRadius={4}
            maskColor="rgba(0, 0, 0, 0.4)"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              width: 130,
              height: 90,
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            }}
          />
        </ReactFlow>

        {/* ── Selected Node Inspector Drawer (Bottom of Canvas) ── */}
        {selectedNodeData && (
          <div
            style={{
              position: 'absolute',
              bottom: 12,
              left: 14,
              right: 154, // Leave space for MiniMap on the right
              zIndex: 20,
              background: 'var(--surface)',
              border: '1px solid var(--border-strong)',
              borderRadius: 12,
              padding: '12px 16px',
              boxShadow: '0 8px 28px rgba(0, 0, 0, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
            }}
          >
            {/* Left Info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background:
                    selectedNodeData.nodeType === 'CUSTOMER'
                      ? 'rgba(94, 91, 193, 0.18)'
                      : selectedNodeData.nodeType === 'DEVICE'
                      ? 'rgba(16, 185, 129, 0.18)'
                      : 'rgba(2, 132, 199, 0.18)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color:
                    selectedNodeData.nodeType === 'CUSTOMER'
                      ? 'var(--accent)'
                      : selectedNodeData.nodeType === 'DEVICE'
                      ? '#10b981'
                      : '#0284c7',
                  flexShrink: 0,
                }}
              >
                {selectedNodeData.nodeType === 'CUSTOMER' && <Users size={18} />}
                {selectedNodeData.nodeType === 'DEVICE' && <Smartphone size={18} />}
                {selectedNodeData.nodeType === 'IP' && <Globe size={18} />}
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--fg)' }}>
                    {selectedNodeData.label}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '2px 7px',
                      borderRadius: 100,
                      background: 'var(--surface-2)',
                      color: 'var(--fg-muted)',
                      textTransform: 'uppercase',
                    }}
                  >
                    {selectedNodeData.nodeType}
                  </span>
                  {selectedNodeData.nodeType === 'CUSTOMER' && selectedNodeData.riskLevel && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        padding: '2px 7px',
                        borderRadius: 100,
                        background:
                          selectedNodeData.riskLevel === 'CRITICAL'
                            ? 'var(--risk-critical-bg)'
                            : selectedNodeData.riskLevel === 'HIGH'
                            ? 'var(--risk-high-bg)'
                            : selectedNodeData.riskLevel === 'MEDIUM'
                            ? 'var(--risk-medium-bg)'
                            : 'var(--risk-low-bg)',
                        color:
                          selectedNodeData.riskLevel === 'CRITICAL'
                            ? 'var(--risk-critical)'
                            : selectedNodeData.riskLevel === 'HIGH'
                            ? 'var(--risk-high)'
                            : selectedNodeData.riskLevel === 'MEDIUM'
                            ? 'var(--risk-medium)'
                            : 'var(--risk-low)',
                      }}
                    >
                      {selectedNodeData.riskScore != null
                        ? `${selectedNodeData.riskScore} ${selectedNodeData.riskLevel}`
                        : selectedNodeData.riskLevel}
                    </span>
                  )}
                </div>

                <div style={{ fontSize: 11, color: 'var(--fg-subtle)', marginTop: 2 }}>
                  {selectedNodeData.nodeType === 'CUSTOMER' && (
                    <span>ID: {selectedNodeData.customerId} • Connected to {selectedNodeData.connectedCount} shared resources</span>
                  )}
                  {selectedNodeData.nodeType === 'DEVICE' && (
                    <span>Fingerprint: {selectedNodeData.deviceId} • Shared across {selectedNodeData.connectedCount} customer accounts</span>
                  )}
                  {selectedNodeData.nodeType === 'IP' && (
                    <span>IP Address: {selectedNodeData.ip} • Shared across {selectedNodeData.connectedCount} customer accounts</span>
                  )}
                </div>
              </div>
            </div>

            {/* Right Action & Close */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {selectedNodeData.nodeType === 'CUSTOMER' && (
                <Link
                  to={`/customers/${selectedNodeData.customerId}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '6px 12px',
                    borderRadius: 8,
                    background: 'var(--accent)',
                    color: '#ffffff',
                    fontSize: 11,
                    fontWeight: 600,
                    textDecoration: 'none',
                    boxShadow: '0 2px 8px rgba(94, 91, 193, 0.3)',
                  }}
                >
                  Inspect Customer
                  <ExternalLink size={12} />
                </Link>
              )}

              <button
                onClick={() => {
                  setSelectedNodeId(null);
                  setSelectedNodeData(null);
                  onSelectNode?.(null);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--fg-subtle)',
                  cursor: 'pointer',
                  padding: 4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="Dismiss"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Exported Component with Provider Wrapper ─────────────────────────────────

export function ClusterNetworkGraph({
  clusterId,
  clusterName,
  riskLevel,
  onSelectNode,
}: {
  clusterId: string;
  clusterName?: string;
  riskLevel?: RiskLevel;
  onSelectNode?: (data: SelectedNodeInfo | null) => void;
}) {
  return (
    <ReactFlowProvider>
      <ClusterCanvas
        clusterId={clusterId}
        clusterName={clusterName}
        riskLevel={riskLevel}
        onSelectNode={onSelectNode}
      />
    </ReactFlowProvider>
  );
}
