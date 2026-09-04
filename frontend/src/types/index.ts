// Core domain types for Niro Risk Intelligence Platform

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type TransactionStatus = 'COMPLETED' | 'PENDING' | 'FAILED' | 'REFUNDED';
export type InvestigationStatus = 'OPEN' | 'REVIEWING' | 'ESCALATED' | 'RESOLVED';
export type DecisionType = 'ALLOW' | 'MONITOR' | 'MANUAL_REVIEW' | 'HOLD' | 'ESCALATE';
export type AuditEventType = 
  | 'DATASET_GENERATED'
  | 'TRANSACTION_ANALYZED'
  | 'RISK_SIGNAL_DETECTED'
  | 'CLUSTER_IDENTIFIED'
  | 'INVESTIGATION_CREATED'
  | 'AI_ASSESSMENT_GENERATED'
  | 'DECISION_RECOMMENDED'
  | 'INVESTIGATION_RESOLVED';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'ANALYST' | 'ADMIN' | 'VIEWER';
  merchantId: string;
  createdAt: string;
}

export interface Merchant {
  id: string;
  name: string;
  environment: 'TEST' | 'PRODUCTION';
  createdAt: string;
}

export interface Customer {
  id: string;
  customerId: string;
  name: string;
  email: string;
  transactionCount: number;
  totalAmount: number;
  refundCount: number;
  refundRate: number;
  deviceCount: number;
  ipCount: number;
  riskScore: number;
  riskLevel: RiskLevel;
  status: 'ACTIVE' | 'SUSPENDED' | 'FLAGGED';
  firstSeen: string;
  lastActivity: string;
  createdAt: string;
}

export interface Transaction {
  id: string;
  transactionId: string;
  customerId: string;
  customerName: string;
  amount: number;
  currency: string;
  status: TransactionStatus;
  paymentMethod: string;
  deviceId: string;
  ipAddress: string;
  isRefunded: boolean;
  refundAmount?: number;
  refundDate?: string;
  riskScore: number;
  riskLevel: RiskLevel;
  signalCount: number;
  timestamp: string;
  createdAt: string;
}

export interface Refund {
  id: string;
  transactionId: string;
  customerId: string;
  amount: number;
  reason: string;
  timestamp: string;
  createdAt: string;
}

export interface RiskSignal {
  id: string;
  name: string;
  type: 'REFUND_VELOCITY' | 'TRANSACTION_VELOCITY' | 'DEVICE_REUSE' | 'IP_REUSE' | 'AMOUNT_SIMILARITY' | 'COORDINATED_ACTIVITY';
  severity: RiskLevel;
  observedValue: string;
  expectedBaseline: string;
  contribution: number;
  confidence: number;
  evidence: string;
  detectedAt: string;
}

export interface RiskAssessment {
  id: string;
  entityId: string;
  entityType: 'CUSTOMER' | 'TRANSACTION' | 'CLUSTER';
  riskScore: number;
  riskLevel: RiskLevel;
  signals: RiskSignal[];
  aiAssessment?: AiAssessment;
  createdAt: string;
}

export interface RiskCluster {
  id: string;
  clusterId: string;
  name: string;
  customerCount: number;
  deviceCount: number;
  ipCount: number;
  transactionCount: number;
  refundCount: number;
  totalExposure: number;
  riskScore: number;
  riskLevel: RiskLevel;
  primarySignal: string;
  status: 'DETECTED' | 'INVESTIGATING' | 'CONFIRMED' | 'FALSE_POSITIVE';
  detectedAt: string;
  createdAt: string;
}

export interface GraphNode {
  id: string;
  type: 'CUSTOMER' | 'DEVICE' | 'IP' | 'TRANSACTION' | 'REFUND';
  label: string;
  data: Record<string, any>;
  riskLevel?: RiskLevel;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: 'USED_DEVICE' | 'USED_IP' | 'MADE_TRANSACTION' | 'RECEIVED_REFUND' | 'SHARED_ATTRIBUTE';
  label?: string;
}

export interface ClusterGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface Investigation {
  id: string;
  investigationId: string;
  subject: string;
  subjectType: 'CUSTOMER' | 'CLUSTER' | 'TRANSACTION';
  subjectId: string;
  type: 'FRAUD' | 'REFUND_ABUSE' | 'COORDINATED_ACTIVITY' | 'SUSPICIOUS_PATTERN';
  riskLevel: RiskLevel;
  status: InvestigationStatus;
  assignedTo?: string;
  assignedToName?: string;
  notes: InvestigationNote[];
  decision?: Decision;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
}

export interface InvestigationNote {
  id: string;
  investigationId: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
}

export interface AiAssessment {
  id: string;
  summary: string;
  reasoning: string;
  confidence: number;
  evidenceConsidered: string[];
  recommendedAction: DecisionType;
  limitations: string;
  createdAt: string;
}

export interface Decision {
  id: string;
  type: DecisionType;
  reasoning: string;
  authorId: string;
  authorName: string;
  createdAt: string;
}

export interface EvaluationMetrics {
  datasetSize: number;
  positiveCases: number;
  negativeCases: number;
  truePositives: number;
  trueNegatives: number;
  falsePositives: number;
  falseNegatives: number;
  precision: number;
  recall: number;
  f1Score: number;
  falsePositiveRate: number;
  falsePositiveCost: number;
  lastEvaluationAt: string;
}

export interface SignalPerformance {
  signalType: string;
  precision: number;
  recall: number;
  falsePositives: number;
  contribution: number;
}

export interface FalsePositiveCase {
  id: string;
  customerId: string;
  customerName: string;
  riskScore: number;
  predictedRisk: RiskLevel;
  actualLabel: 'LEGITIMATE';
  reason: string;
}

export interface AuditEvent {
  id: string;
  eventType: AuditEventType;
  actor: string;
  actorType: 'USER' | 'SYSTEM';
  entityType: string;
  entityId: string;
  outcome: string;
  metadata: Record<string, any>;
  timestamp: string;
}

export interface DatasetRun {
  id: string;
  recordCount: number;
  status: 'GENERATING' | 'ANALYZING' | 'COMPLETED' | 'FAILED';
  steps: DatasetStep[];
  startedAt: string;
  completedAt?: string;
}

export interface DatasetStep {
  name: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  completedAt?: string;
}

export interface DashboardStats {
  transactionsAnalyzed: number;
  customersAnalyzed: number;
  highRiskCustomers: number;
  suspiciousClusters: number;
  openInvestigations: number;
  // ML evaluation metrics — null if no evaluation run yet
  precision: number | null;
  recall: number | null;
  f1: number | null;
  falsePositiveRate: number | null;
  riskDistribution: Record<string, number>;
  topSignals: { signalType: string; count: number }[];
  recentClusters: { id: string; riskLevel: string; memberCount: number; riskScore: number }[];
  recentInvestigations: { id: string; subjectType: string; status: string; riskLevel: string }[];
  dataDisclaimer: string;
  // Backwards-compat aliases
  detectionPrecision?: number;
  detectionRecall?: number;
}

export interface ModelMonitoringHealth {
  overallStatus:        'HEALTHY' | 'DEGRADED' | 'CRITICAL' | 'UNAVAILABLE';
  modelStatus:          string;
  modelVersion:         string | null;
  featureVersion:       string | null;
  nRecentPredictions:   number;
  predMean:             number | null;
  predStd:              number | null;
  highRiskFraction:     number | null;
  predictionDriftLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
  dataQuality:          'GOOD' | 'DEGRADED' | 'POOR' | 'UNKNOWN';
  featureDriftLevel:    'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
  mlServiceEnabled:     boolean;
  mlServiceReachable:   boolean;
  disclaimer:           string;
}

// API Response types
export interface ApiResponse<T> {
  data: T;
  message?: string;
}
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

// Auth types
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  merchantName: string;
}

export interface VerifyEmailRequest {
  token: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
  confirmPassword: string;
}
