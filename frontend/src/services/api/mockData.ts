// Mock data generators for development

import type {
  Customer,
  Transaction,
  RiskCluster,
  Investigation,
  RiskSignal,
  AuditEvent,
  EvaluationMetrics,
  SignalPerformance,
  FalsePositiveCase,
  DashboardStats,
  User,
  RiskLevel,
  GraphNode,
  GraphEdge,
  ClusterGraph,
} from '@/types';

const RISK_LEVELS: RiskLevel[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

const CUSTOMER_NAMES = [
  'Sarah Chen', 'Michael Rodriguez', 'Emma Williams', 'James Thompson', 'Lisa Anderson',
  'David Martinez', 'Jennifer Lee', 'Robert Taylor', 'Maria Garcia', 'John Wilson',
  'Amanda Brown', 'Christopher Davis', 'Jessica Miller', 'Daniel Moore', 'Ashley Jackson',
];

const SIGNAL_TYPES = [
  'REFUND_VELOCITY',
  'TRANSACTION_VELOCITY',
  'DEVICE_REUSE',
  'IP_REUSE',
  'AMOUNT_SIMILARITY',
  'COORDINATED_ACTIVITY',
] as const;

const SIGNAL_NAMES: Record<typeof SIGNAL_TYPES[number], string> = {
  REFUND_VELOCITY: 'Abnormal Refund Rate',
  TRANSACTION_VELOCITY: 'Transaction Velocity',
  DEVICE_REUSE: 'Device Reuse',
  IP_REUSE: 'IP Reuse',
  AMOUNT_SIMILARITY: 'Amount Similarity',
  COORDINATED_ACTIVITY: 'Coordinated Activity',
};

function randomDate(daysAgo: number = 30): string {
  const date = new Date();
  date.setDate(date.getDate() - Math.floor(Math.random() * daysAgo));
  return date.toISOString();
}

function randomRiskLevel(weights: number[] = [0.5, 0.3, 0.15, 0.05]): RiskLevel {
  const rand = Math.random();
  let cumulative = 0;
  for (let i = 0; i < weights.length; i++) {
    cumulative += weights[i];
    if (rand < cumulative) return RISK_LEVELS[i];
  }
  return 'LOW';
}

export const mockCustomers: Customer[] = Array.from({ length: 50 }, (_, i) => {
  const riskLevel = randomRiskLevel();
  const refundCount = riskLevel === 'CRITICAL' ? Math.floor(Math.random() * 10) + 5 :
                      riskLevel === 'HIGH' ? Math.floor(Math.random() * 7) + 3 :
                      Math.floor(Math.random() * 3);
  const transactionCount = Math.floor(Math.random() * 50) + 10;
  const refundRate = transactionCount > 0 ? (refundCount / transactionCount) * 100 : 0;

  return {
    id: `cust-${i + 1}`,
    customerId: `CUST-${String(i + 1).padStart(5, '0')}`,
    name: CUSTOMER_NAMES[i % CUSTOMER_NAMES.length] + (i >= CUSTOMER_NAMES.length ? ` ${Math.floor(i / CUSTOMER_NAMES.length) + 1}` : ''),
    email: `customer${i + 1}@example.com`,
    transactionCount,
    totalAmount: Math.floor(Math.random() * 50000) + 1000,
    refundCount,
    refundRate: Math.round(refundRate * 10) / 10,
    deviceCount: Math.floor(Math.random() * 4) + 1,
    ipCount: Math.floor(Math.random() * 5) + 1,
    riskScore: riskLevel === 'CRITICAL' ? Math.floor(Math.random() * 15) + 85 :
                riskLevel === 'HIGH' ? Math.floor(Math.random() * 15) + 70 :
                riskLevel === 'MEDIUM' ? Math.floor(Math.random() * 20) + 50 :
                Math.floor(Math.random() * 50),
    riskLevel,
    status: riskLevel === 'CRITICAL' ? 'FLAGGED' : 'ACTIVE',
    firstSeen: randomDate(90),
    lastActivity: randomDate(7),
    createdAt: randomDate(90),
  };
});

export const mockTransactions: Transaction[] = Array.from({ length: 200 }, (_, i) => {
  const customer = mockCustomers[Math.floor(Math.random() * mockCustomers.length)];
  const riskLevel = randomRiskLevel([0.6, 0.25, 0.1, 0.05]);
  const isRefunded = Math.random() < 0.15;

  return {
    id: `txn-${i + 1}`,
    transactionId: `TXN-${String(i + 1).padStart(8, '0')}`,
    customerId: customer.customerId,
    customerName: customer.name,
    amount: Math.floor(Math.random() * 5000) + 10,
    currency: 'USD',
    status: isRefunded ? 'REFUNDED' : 'COMPLETED',
    paymentMethod: ['Visa •••• 4242', 'Mastercard •••• 5555', 'Amex •••• 1234'][Math.floor(Math.random() * 3)],
    deviceId: `device-${Math.floor(Math.random() * 20) + 1}`,
    ipAddress: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
    isRefunded,
    refundAmount: isRefunded ? Math.floor(Math.random() * 5000) + 10 : undefined,
    refundDate: isRefunded ? randomDate(15) : undefined,
    riskScore: riskLevel === 'CRITICAL' ? Math.floor(Math.random() * 15) + 85 :
                riskLevel === 'HIGH' ? Math.floor(Math.random() * 15) + 70 :
                riskLevel === 'MEDIUM' ? Math.floor(Math.random() * 20) + 50 :
                Math.floor(Math.random() * 50),
    riskLevel,
    signalCount: Math.floor(Math.random() * 4) + 1,
    timestamp: randomDate(30),
    createdAt: randomDate(30),
  };
});

export const mockClusters: RiskCluster[] = Array.from({ length: 12 }, (_, i) => {
  const riskLevel = randomRiskLevel([0.2, 0.3, 0.3, 0.2]);
  const customerCount = Math.floor(Math.random() * 15) + 3;

  return {
    id: `cluster-${i + 1}`,
    clusterId: `CR-${String(i + 1).padStart(4, '0')}`,
    name: `Cluster ${i + 1}`,
    customerCount,
    deviceCount: Math.floor(Math.random() * 6) + 1,
    ipCount: Math.floor(Math.random() * 5) + 1,
    transactionCount: customerCount * (Math.floor(Math.random() * 10) + 5),
    refundCount: Math.floor(Math.random() * 20) + 5,
    totalExposure: Math.floor(Math.random() * 100000) + 10000,
    riskScore: riskLevel === 'CRITICAL' ? Math.floor(Math.random() * 15) + 85 :
                riskLevel === 'HIGH' ? Math.floor(Math.random() * 15) + 70 :
                riskLevel === 'MEDIUM' ? Math.floor(Math.random() * 20) + 50 :
                Math.floor(Math.random() * 50),
    riskLevel,
    primarySignal: SIGNAL_NAMES[SIGNAL_TYPES[Math.floor(Math.random() * SIGNAL_TYPES.length)]],
    status: ['DETECTED', 'INVESTIGATING'][Math.floor(Math.random() * 2)] as any,
    detectedAt: randomDate(14),
    createdAt: randomDate(14),
  };
});

export const mockInvestigations: Investigation[] = Array.from({ length: 25 }, (_, i) => {
  const status = ['OPEN', 'REVIEWING', 'ESCALATED', 'RESOLVED'][Math.floor(Math.random() * 4)] as any;
  const riskLevel = randomRiskLevel([0.1, 0.3, 0.4, 0.2]);

  return {
    id: `inv-${i + 1}`,
    investigationId: `INV-${String(i + 1).padStart(6, '0')}`,
    subject: mockCustomers[i % mockCustomers.length].name,
    subjectType: ['CUSTOMER', 'CLUSTER'][Math.floor(Math.random() * 2)] as any,
    subjectId: mockCustomers[i % mockCustomers.length].customerId,
    type: ['FRAUD', 'REFUND_ABUSE', 'COORDINATED_ACTIVITY', 'SUSPICIOUS_PATTERN'][Math.floor(Math.random() * 4)] as any,
    riskLevel,
    status,
    assignedTo: 'analyst-1',
    assignedToName: 'John Smith',
    notes: [],
    createdAt: randomDate(30),
    updatedAt: randomDate(7),
    resolvedAt: status === 'RESOLVED' ? randomDate(3) : undefined,
  };
});

export const mockRiskSignals: RiskSignal[] = [
  {
    id: 'signal-1',
    name: 'Refund Velocity',
    type: 'REFUND_VELOCITY',
    severity: 'HIGH',
    observedValue: '7 refunds in 14 days',
    expectedBaseline: '1.2 refunds/customer',
    contribution: 24,
    confidence: 0.87,
    evidence: 'Customer requested 7 refunds within 2 weeks, significantly exceeding merchant baseline.',
    detectedAt: randomDate(2),
  },
  {
    id: 'signal-2',
    name: 'Device Reuse',
    type: 'DEVICE_REUSE',
    severity: 'MEDIUM',
    observedValue: 'Shared device across 4 accounts',
    expectedBaseline: '1.1 accounts/device',
    contribution: 15,
    confidence: 0.92,
    evidence: 'Device fingerprint matches 4 distinct customer accounts.',
    detectedAt: randomDate(2),
  },
  {
    id: 'signal-3',
    name: 'IP Reuse',
    type: 'IP_REUSE',
    severity: 'MEDIUM',
    observedValue: '3 accounts from same IP',
    expectedBaseline: '1.3 accounts/IP',
    contribution: 12,
    confidence: 0.78,
    evidence: 'Multiple accounts accessed from IP address 192.168.1.42.',
    detectedAt: randomDate(2),
  },
];

export const mockAuditEvents: AuditEvent[] = Array.from({ length: 100 }, (_, i) => ({
  id: `event-${i + 1}`,
  eventType: ['DATASET_GENERATED', 'TRANSACTION_ANALYZED', 'RISK_SIGNAL_DETECTED', 'CLUSTER_IDENTIFIED', 'INVESTIGATION_CREATED', 'AI_ASSESSMENT_GENERATED', 'DECISION_RECOMMENDED', 'INVESTIGATION_RESOLVED'][Math.floor(Math.random() * 8)] as any,
  actor: Math.random() > 0.3 ? 'John Smith' : 'System',
  actorType: Math.random() > 0.3 ? 'USER' : 'SYSTEM',
  entityType: ['CUSTOMER', 'TRANSACTION', 'CLUSTER', 'INVESTIGATION'][Math.floor(Math.random() * 4)],
  entityId: `entity-${Math.floor(Math.random() * 100) + 1}`,
  outcome: 'SUCCESS',
  metadata: {},
  timestamp: randomDate(30),
}));

export const mockEvaluationMetrics: EvaluationMetrics = {
  datasetSize: 1000,
  positiveCases: 150,
  negativeCases: 850,
  truePositives: 127,
  trueNegatives: 798,
  falsePositives: 52,
  falseNegatives: 23,
  precision: 0.709,
  recall: 0.847,
  f1Score: 0.772,
  falsePositiveRate: 0.061,
  falsePositiveCost: 26000,
  lastEvaluationAt: randomDate(1),
};

export const mockSignalPerformance: SignalPerformance[] = [
  { signalType: 'Refund Velocity', precision: 0.82, recall: 0.91, falsePositives: 12, contribution: 28 },
  { signalType: 'Transaction Velocity', precision: 0.74, recall: 0.86, falsePositives: 18, contribution: 22 },
  { signalType: 'Device Reuse', precision: 0.68, recall: 0.79, falsePositives: 24, contribution: 18 },
  { signalType: 'IP Reuse', precision: 0.71, recall: 0.73, falsePositives: 21, contribution: 15 },
  { signalType: 'Amount Similarity', precision: 0.59, recall: 0.68, falsePositives: 31, contribution: 10 },
  { signalType: 'Coordinated Activity', precision: 0.85, recall: 0.76, falsePositives: 8, contribution: 7 },
];

export const mockFalsePositives: FalsePositiveCase[] = [
  {
    id: 'fp-1',
    customerId: 'CUST-00042',
    customerName: 'Emma Williams',
    riskScore: 73,
    predictedRisk: 'HIGH',
    actualLabel: 'LEGITIMATE',
    reason: 'Legitimate bulk purchasing for small business',
  },
  {
    id: 'fp-2',
    customerId: 'CUST-00087',
    customerName: 'James Thompson',
    riskScore: 68,
    predictedRisk: 'HIGH',
    actualLabel: 'LEGITIMATE',
    reason: 'Shared household device with family members',
  },
  {
    id: 'fp-3',
    customerId: 'CUST-00156',
    customerName: 'Lisa Anderson',
    riskScore: 71,
    predictedRisk: 'HIGH',
    actualLabel: 'LEGITIMATE',
    reason: 'VPN usage triggering IP reuse signal',
  },
];

export const mockDashboardStats: DashboardStats = {
  transactionsAnalyzed: 12847,
  highRiskCustomers: 23,
  suspiciousClusters: 8,
  openInvestigations: 12,
  detectionPrecision: 0.709,
  detectionRecall: 0.847,
};

export const mockCurrentUser: User = {
  id: 'user-1',
  email: 'analyst@zeno.dev',
  name: 'John Smith',
  role: 'ANALYST',
  merchantId: 'merchant-1',
  createdAt: randomDate(180),
};

export function generateClusterGraph(_clusterId: string): ClusterGraph {
  const customerCount = 5 + Math.floor(Math.random() * 8);
  const deviceCount = 2 + Math.floor(Math.random() * 4);
  const ipCount = 2 + Math.floor(Math.random() * 3);
  
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  // Create customer nodes
  for (let i = 0; i < customerCount; i++) {
    nodes.push({
      id: `customer-${i}`,
      type: 'CUSTOMER',
      label: CUSTOMER_NAMES[i % CUSTOMER_NAMES.length],
      data: { customerId: `CUST-${1000 + i}` },
      riskLevel: randomRiskLevel([0.3, 0.3, 0.3, 0.1]),
    });
  }

  // Create device nodes
  for (let i = 0; i < deviceCount; i++) {
    nodes.push({
      id: `device-${i}`,
      type: 'DEVICE',
      label: `Device ${i + 1}`,
      data: { deviceId: `device-${100 + i}` },
    });
  }

  // Create IP nodes
  for (let i = 0; i < ipCount; i++) {
    nodes.push({
      id: `ip-${i}`,
      type: 'IP',
      label: `192.168.1.${40 + i}`,
      data: { ipAddress: `192.168.1.${40 + i}` },
    });
  }

  // Create edges - customers to devices
  nodes.filter(n => n.type === 'CUSTOMER').forEach((customer, i) => {
    const deviceIndex = i % deviceCount;
    edges.push({
      id: `edge-${customer.id}-device-${deviceIndex}`,
      source: customer.id,
      target: `device-${deviceIndex}`,
      type: 'USED_DEVICE',
      label: 'used device',
    });
  });

  // Create edges - customers to IPs
  nodes.filter(n => n.type === 'CUSTOMER').forEach((customer, i) => {
    const ipIndex = i % ipCount;
    edges.push({
      id: `edge-${customer.id}-ip-${ipIndex}`,
      source: customer.id,
      target: `ip-${ipIndex}`,
      type: 'USED_IP',
      label: 'used IP',
    });
  });

  return { nodes, edges };
}
