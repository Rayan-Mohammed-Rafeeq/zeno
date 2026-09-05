// API Services - Central export

export { authApi } from './authApi';
export { customerApi } from './customerApi';
export { adminApi } from './adminApi';
export type { AdminUser, CreateUserRequest, AdminUserRole, AdminUserStatus } from './adminApi';
export { apiRequest, ApiError, MOCK_API_ENABLED } from './client';
export * from './mockData';

// Import remaining APIs
import type { Transaction, RiskCluster, Investigation, AuditEvent, EvaluationMetrics, SignalPerformance, FalsePositiveCase, DashboardStats, DatasetRun, ClusterGraph, PaginatedResponse, ModelMonitoringHealth, ModelMetrics, CustomerRiskDetail, ChargebackEvidence } from '@/types';
import { apiRequest, apiRequestPaged, MOCK_API_ENABLED, delay } from './client';
import { mockTransactions, mockClusters, mockInvestigations, mockAuditEvents, mockEvaluationMetrics, mockSignalPerformance, mockFalsePositives, mockDashboardStats, generateClusterGraph } from './mockData';

export const transactionApi = {
  async getTransactions(params?: { page?: number; pageSize?: number; search?: string; riskLevel?: string }): Promise<PaginatedResponse<Transaction>> {
    if (MOCK_API_ENABLED) {
      await delay();
      let filtered = [...mockTransactions];
      if (params?.search) {
        const search = params.search.toLowerCase();
        filtered = filtered.filter(t =>
          t.transactionId.toLowerCase().includes(search) ||
          t.customerName.toLowerCase().includes(search)
        );
      }
      if (params?.riskLevel && params.riskLevel !== 'ALL') {
        filtered = filtered.filter(t => t.riskLevel === params.riskLevel);
      }
      const page = params?.page || 1;
      const pageSize = params?.pageSize || 20;
      const start = (page - 1) * pageSize;
      return { data: filtered.slice(start, start + pageSize), total: filtered.length, page, pageSize };
    }
    // Backend: /payments, page 0-indexed, param `size`
    // Now supports: search (externalPaymentId contains), riskLevel (post-filter)
    const backendPage = Math.max(0, (params?.page ?? 1) - 1);
    const qs = new URLSearchParams({ page: String(backendPage), size: String(params?.pageSize ?? 20) });
    if (params?.search?.trim())                           qs.set('search', params.search.trim());
    if (params?.riskLevel && params.riskLevel !== 'ALL') qs.set('riskLevel', params.riskLevel);
    const result = await apiRequestPaged<Transaction>(`/payments?${qs}`);
    return { data: result.data, total: result.meta.totalElements, page: params?.page ?? 1, pageSize: params?.pageSize ?? 20 };
  },

  async getTransaction(id: string): Promise<Transaction> {
    if (MOCK_API_ENABLED) {
      await delay();
      const transaction = mockTransactions.find(t => t.transactionId === id || t.id === id);
      if (!transaction) throw new Error('Transaction not found');
      return transaction;
    }
    return apiRequest<Transaction>(`/payments/${id}`);
  },
};

export const clusterApi = {
  async getClusters(params?: { page?: number; pageSize?: number }): Promise<PaginatedResponse<RiskCluster>> {
    if (MOCK_API_ENABLED) {
      await delay();
      const page = params?.page || 1;
      const pageSize = params?.pageSize || 20;
      const start = (page - 1) * pageSize;
      return { data: mockClusters.slice(start, start + pageSize), total: mockClusters.length, page, pageSize };
    }
    const backendPage = Math.max(0, (params?.page ?? 1) - 1);
    const qs = new URLSearchParams({ page: String(backendPage), size: String(params?.pageSize ?? 20) });
    const result = await apiRequestPaged<RiskCluster>(`/clusters?${qs}`);
    return { data: result.data, total: result.meta.totalElements, page: params?.page ?? 1, pageSize: params?.pageSize ?? 20 };
  },

  async getCluster(id: string): Promise<RiskCluster> {
    if (MOCK_API_ENABLED) {
      await delay();
      const cluster = mockClusters.find(c => c.id === id);
      if (!cluster) throw new Error('Cluster not found');
      return cluster;
    }
    return apiRequest<RiskCluster>(`/clusters/${id}`);
  },

  async getClusterGraph(id: string): Promise<ClusterGraph> {
    if (MOCK_API_ENABLED) {
      await delay();
      return generateClusterGraph(id);
    }
    return apiRequest<ClusterGraph>(`/clusters/${id}/graph`);
  },
};

function normalizeInvestigation(inv: any): Investigation {
  if (!inv) return inv;
  const shortId = inv.id ? `INV-${String(inv.id).replace(/-/g, '').slice(0, 6).toUpperCase()}` : 'INV-UNKNOWN';
  return {
    ...inv,
    investigationId: inv.investigationId || shortId,
    subject: inv.subject || `${inv.subjectType ?? 'Case'} ${inv.subjectId ? String(inv.subjectId).slice(0, 8).toUpperCase() : ''}`,
    type: inv.type || (inv.subjectType === 'CLUSTER' ? 'COORDINATED_ACTIVITY' : inv.subjectType === 'CUSTOMER' ? 'SUSPICIOUS_PATTERN' : 'FRAUD'),
    notes: inv.notes ?? [],
  };
}

export const investigationApi = {
  async getInvestigations(params?: { page?: number; pageSize?: number; status?: string }): Promise<PaginatedResponse<Investigation>> {
    if (MOCK_API_ENABLED) {
      await delay();
      let filtered = [...mockInvestigations];
      if (params?.status && params.status !== 'ALL') {
        filtered = filtered.filter(i => i.status === params.status);
      }
      const page = params?.page || 1;
      const pageSize = params?.pageSize || 20;
      const start = (page - 1) * pageSize;
      return { data: filtered.slice(start, start + pageSize).map(normalizeInvestigation), total: filtered.length, page, pageSize };
    }
    const backendPage = Math.max(0, (params?.page ?? 1) - 1);
    const qs = new URLSearchParams({ page: String(backendPage), size: String(params?.pageSize ?? 20) });
    // Only pass status if it's a real enum value (not 'ALL')
    if (params?.status && params.status !== 'ALL') qs.set('status', params.status);
    const result = await apiRequestPaged<Investigation>(`/investigations?${qs}`);
    return {
      data: (result.data || []).map(normalizeInvestigation),
      total: result.meta?.totalElements ?? result.data?.length ?? 0,
      page: params?.page ?? 1,
      pageSize: params?.pageSize ?? 20,
    };
  },

  async getInvestigation(id: string): Promise<Investigation> {
    if (MOCK_API_ENABLED) {
      await delay();
      const investigation = mockInvestigations.find(i => i.investigationId === id || i.id === id);
      if (!investigation) throw new Error('Investigation not found');
      return normalizeInvestigation(investigation);
    }
    const result = await apiRequest<Investigation>(`/investigations/${id}`);
    return normalizeInvestigation(result);
  },

  /**
   * Create an investigation scoped to a risk cluster.
   * Uses SubjectType.CLUSTER — wired in InvestigationController.
   */
  async createInvestigationForCluster(clusterId: string, riskLevel: string): Promise<Investigation> {
    if (MOCK_API_ENABLED) {
      await delay(600);
      return normalizeInvestigation({
        id: 'inv-cluster-' + Date.now(),
        investigationId: 'INV-' + String(Date.now()).slice(-6),
        subject: `Cluster ${clusterId.slice(0, 8)}`,
        subjectType: 'CLUSTER',
        subjectId: clusterId,
        type: 'COORDINATED_ACTIVITY',
        riskLevel: riskLevel as any,
        status: 'OPEN',
        notes: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    const result = await apiRequest<Investigation>('/investigations', {
      method: 'POST',
      body: JSON.stringify({
        subjectType: 'CLUSTER',
        subjectId: clusterId,
        riskLevel,
      }),
    });
    return normalizeInvestigation(result);
  },

  /**
   * Find an existing investigation for a cluster subject ID (if any).
   * Returns null when no investigation exists yet.
   */
  async findInvestigationForCluster(clusterId: string): Promise<Investigation | null> {
    if (MOCK_API_ENABLED) {
      await delay(200);
      return null;
    }
    try {
      // Fetch the first page and look for a matching cluster subject
      const result = await apiRequestPaged<Investigation>('/investigations?page=0&size=50');
      const match = (result.data || []).find(
        (inv: any) => inv.subjectType === 'CLUSTER' && String(inv.subjectId) === clusterId
      );
      return match ? normalizeInvestigation(match) : null;
    } catch {
      return null;
    }
  },
};

export const auditApi = {
  async getAuditEvents(params?: { page?: number; pageSize?: number }): Promise<PaginatedResponse<AuditEvent>> {
    if (MOCK_API_ENABLED) {
      await delay();
      const page = params?.page || 1;
      const pageSize = params?.pageSize || 50;
      const start = (page - 1) * pageSize;
      const data = mockAuditEvents.slice(start, start + pageSize);
      
      return { data, total: mockAuditEvents.length, page, pageSize };
    }
    
    const qs = new URLSearchParams({
      page: String(Math.max(0, (params?.page ?? 1) - 1)), // 0-indexed
      size: String(params?.pageSize ?? 100),
    }).toString();
    return apiRequest<PaginatedResponse<AuditEvent>>(`/audit-events?${qs}`);
  },
};

export const evaluationApi = {
  async getMetrics(): Promise<EvaluationMetrics> {
    if (MOCK_API_ENABLED) {
      await delay();
      return mockEvaluationMetrics;
    }
    return apiRequest<EvaluationMetrics>('/evaluation/metrics');
  },

  async getSignalPerformance(): Promise<SignalPerformance[]> {
    if (MOCK_API_ENABLED) {
      await delay();
      return mockSignalPerformance;
    }
    return apiRequest<SignalPerformance[]>('/evaluation/signals');
  },

  async getFalsePositives(): Promise<FalsePositiveCase[]> {
    if (MOCK_API_ENABLED) {
      await delay();
      return mockFalsePositives;
    }
    return apiRequest<FalsePositiveCase[]>('/evaluation/false-positives');
  },

  async getModelMetrics(): Promise<ModelMetrics> {
    if (MOCK_API_ENABLED) {
      await delay();
      // Return hardcoded real values when mocked — same as what the backend serves
      return {
        datasetName: 'ieee-cis-fraud-detection',
        nTrain: 105000, nTest: 22500,
        trainFraudRate: 0.0252, testFraudRate: 0.0365,
        modelVersion: 'xgboost-ieee-cis-v1', featureVersion: 'ieee-cis-1.0',
        nFeatures: 119, threshold: 0.785, fpCost: 40, fnCost: 200,
        precision: 0.6162, recall: 0.4811, f1: 0.5404, auprc: 0.5611,
        rocAuc: 0.9027, fpr: 0.0113,
        truePositives: 395, falsePositives: 246, trueNegatives: 21433, falseNegatives: 426,
        expectedLoss: 95040,
        splitStrategy: 'Temporal 70/15/15 split. Threshold frozen on validation.',
        disclaimer: 'IEEE-CIS benchmark dataset. Production performance will differ.',
      };
    }
    return apiRequest<ModelMetrics>('/evaluation/model-metrics');
  },
};

export const monitoringApi = {
  async getHealth(): Promise<ModelMonitoringHealth> {
    if (MOCK_API_ENABLED) {
      await delay();
      return {
        overallStatus: 'HEALTHY',
        modelStatus: 'READY',
        modelVersion: 'xgboost-v1',
        featureVersion: '1.0',
        nRecentPredictions: 0,
        predMean: null,
        predStd: null,
        highRiskFraction: null,
        predictionDriftLevel: 'UNKNOWN',
        dataQuality: 'GOOD',
        featureDriftLevel: 'UNKNOWN',
        mlServiceEnabled: false,
        mlServiceReachable: false,
        disclaimer: 'ML service disabled — rule-based scoring in use.',
      };
    }
    return apiRequest<ModelMonitoringHealth>('/monitoring/health');
  },
};

export const riskApi = {
  /** Run full risk analysis + cluster detection for the current merchant. */
  async analyzeAll(): Promise<{ assessed: number }> {
    if (MOCK_API_ENABLED) {
      await delay(800);
      return { assessed: 50 };
    }
    const result = await apiRequest<{ assessed: number }>('/risk/analyze', { method: 'POST' });
    return result;
  },
  async detectClusters(): Promise<{ clustersDetected: number }> {
    if (MOCK_API_ENABLED) {
      await delay(400);
      return { clustersDetected: 5 };
    }
    const result = await apiRequest<{ clustersDetected: number }>('/clusters/detect', { method: 'POST' });
    return result;
  },
};

export const dashboardApi = {
  async getStats(): Promise<DashboardStats> {
    if (MOCK_API_ENABLED) {
      await delay();
      return mockDashboardStats;
    }
    
    return apiRequest<DashboardStats>('/dashboard');
  },
};

export const datasetApi = {
  async generateDataset(recordCount: number): Promise<DatasetRun> {
    if (MOCK_API_ENABLED) {
      await delay(1000);
      return {
        id: 'run-' + Date.now(),
        recordCount,
        status: 'COMPLETED',
        steps: [
          { name: 'Dataset generated', status: 'COMPLETED', completedAt: new Date().toISOString() },
          { name: 'Risk signals calculated', status: 'COMPLETED', completedAt: new Date().toISOString() },
          { name: 'Relationships analyzed', status: 'COMPLETED', completedAt: new Date().toISOString() },
          { name: 'Clusters detected', status: 'COMPLETED', completedAt: new Date().toISOString() },
          { name: 'Evaluation completed', status: 'COMPLETED', completedAt: new Date().toISOString() },
        ],
        createdAt: new Date().toISOString(),
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      };
    }
    
    return apiRequest<DatasetRun>('/datasets/generate', {
      method: 'POST',
      body: JSON.stringify({ recordCount }),
    });
  },

  async getCurrentRun(): Promise<DatasetRun | null> {
    if (MOCK_API_ENABLED) {
      await delay();
      return {
        id: 'run-current',
        recordCount: 1000,
        status: 'COMPLETED',
        steps: [
          { name: 'Dataset generated', status: 'COMPLETED', completedAt: new Date().toISOString() },
          { name: 'Risk signals calculated', status: 'COMPLETED', completedAt: new Date().toISOString() },
          { name: 'Relationships analyzed', status: 'COMPLETED', completedAt: new Date().toISOString() },
          { name: 'Clusters detected', status: 'COMPLETED', completedAt: new Date().toISOString() },
          { name: 'Evaluation completed', status: 'COMPLETED', completedAt: new Date().toISOString() },
        ],
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        startedAt: new Date(Date.now() - 3600000).toISOString(),
        completedAt: new Date().toISOString(),
      };
    }
    try {
      return await apiRequest<DatasetRun>('/datasets/current');
    } catch {
      return null; // 404 = no dataset yet — normal on a fresh instance
    }
  },
};

export const intelligenceApi = {
  /**
   * Generate an AI evidence assessment for a customer.
   * Sends subject ID/type to the backend which assembles the full evidence bundle
   * (risk signals, ML probability, SHAP, graph/cluster data) and queries OpenRouter.
   */
  async assessCustomer(customerId: string, clusterSize?: number): Promise<CustomerRiskDetail['aiAssessment']> {
    if (MOCK_API_ENABLED) {
      await delay(1500);
      return {
        id: 'ai-mock-' + Date.now(),
        assessmentType: 'POTENTIAL_COORDINATED_REFUND_ABUSE',
        confidence: 0.87,
        recommendedAction: 'MANUAL_REVIEW',
        provider: 'rule-based-fallback',
        aiGenerated: false,
        disclaimer: 'AI-generated evidence summary. Requires analyst verification.',
        createdAt: new Date().toISOString(),
        structuredResult: {
          assessment: 'HIGH_RISK',
          confidence: 87,
          recommendedAction: 'MANUAL_REVIEW',
          summary: 'Mock assessment — run against real backend for live AI output.',
          reasons: [
            { signal: 'Refund rate', observed: '34.2%', baseline: '4.1%', interpretation: 'Refund rate is 8.3x above merchant baseline.' },
            { signal: 'Device sharing', observed: '5 accounts', baseline: '< 2', interpretation: 'Device shared with 5 other accounts, consistent with coordinated activity.' },
          ],
          mlEvidence: { fraudProbability: 0.82, topShapDrivers: ['device_velocity (+0.43)', 'transaction_amount (+0.27)'], modelVersion: 'xgboost-v1', disclaimer: 'SHAP explains model prediction, not ground truth.' },
          networkEvidence: { clusterDetected: true, clusterSize: 5, relationshipSummary: 'Member of 5-entity cluster via shared device fingerprint.' },
          limitations: ['AI assessment does not independently establish fraud.', 'Analyst verification required.'],
          analystNote: 'Review device-sharing cluster. Consider HOLD_FOR_REVIEW if refunds continue.',
          aiGenerated: false,
        },
      };
    }
    const resp = await apiRequest<CustomerRiskDetail['aiAssessment']>('/intelligence/assess', {
      method: 'POST',
      body: JSON.stringify({
        subjectType: 'CUSTOMER',
        subjectId: customerId,
        clusterSize: clusterSize ?? null,
      }),
    });
    return resp;
  },

  /**
   * Generate an AI evidence assessment for a cluster.
   * Passes subjectType=CLUSTER so the IntelligenceService performs the cluster
   * member lookup and assembles graph + signal evidence before querying the LLM.
   */
  async assessCluster(clusterId: string, memberCount: number): Promise<CustomerRiskDetail['aiAssessment']> {
    if (MOCK_API_ENABLED) {
      await delay(1500);
      return {
        id: 'ai-cluster-mock-' + Date.now(),
        assessmentType: 'POTENTIAL_COORDINATED_ACTIVITY',
        confidence: 0.84,
        recommendedAction: 'MANUAL_REVIEW',
        provider: 'rule-based-fallback',
        aiGenerated: false,
        disclaimer: 'AI-generated evidence summary. Requires analyst verification.',
        createdAt: new Date().toISOString(),
        structuredResult: {
          assessment: 'HIGH_RISK',
          confidence: 84,
          recommendedAction: 'MANUAL_REVIEW',
          summary: 'Mock cluster assessment — connect to real backend for live AI output.',
          reasons: [
            { signal: 'Device reuse', observed: 'Shared across multiple accounts', baseline: '< 2 accounts/device', interpretation: 'Multiple customers are connected through a common device fingerprint, consistent with coordinated activity.' },
            { signal: 'IP overlap', observed: 'Shared across accounts', baseline: '< 2 accounts/IP', interpretation: 'Accounts share IP address — possible shared infrastructure or coordinated access.' },
          ],
          mlEvidence: null,
          networkEvidence: { clusterDetected: true, clusterSize: memberCount, relationshipSummary: `Cluster of ${memberCount} customers connected via shared device/IP infrastructure.` },
          limitations: ['AI assessment does not independently establish fraud.', 'Analyst verification required before any action.'],
          analystNote: 'Review shared device and IP relationships. Escalate if coordinated timing confirmed.',
          aiGenerated: false,
        },
      };
    }
    return apiRequest<CustomerRiskDetail['aiAssessment']>('/intelligence/assess', {
      method: 'POST',
      body: JSON.stringify({
        subjectType: 'CLUSTER',
        subjectId: clusterId,
        clusterSize: memberCount,
      }),
    });
  },

  /**
   * Generate a defensive chargeback evidence package for a customer.
   */
  async chargebackEvidence(customerId: string): Promise<ChargebackEvidence> {
    if (MOCK_API_ENABLED) {
      await delay(1000);
      return {
        subjectId: customerId,
        subjectType: 'CUSTOMER',
        caseSummary: 'Mock chargeback evidence — connect to real backend for live data.',
        totalTransactions: 12,
        totalAmountInr: 45000,
        totalRefunds: 4,
        refundRate: 0.33,
        merchantBaselineRefundRate: 0.04,
        riskScore: 85,
        riskLevel: 'HIGH',
        triggeredSignals: ['REFUND_RATE_ANOMALY', 'DEVICE_REUSE'],
        fraudProbability: 0.82,
        modelVersion: 'xgboost-v1',
        topShapDrivers: ['device_velocity (+0.43)', 'transaction_amount (+0.27)'],
        clusterSize: 5,
        networkSummary: 'Member of 5-entity cluster via shared device.',
        recommendedAction: 'HOLD_FOR_REVIEW',
        evidenceGeneratedAt: new Date().toISOString(),
        limitations: ['Requires analyst verification before use in any dispute process.'],
        disclaimer: 'AI-generated evidence summary. Requires analyst verification.',
      };
    }
    return apiRequest<ChargebackEvidence>('/intelligence/chargeback-evidence', {
      method: 'POST',
      body: JSON.stringify({ subjectId: customerId, subjectType: 'CUSTOMER' }),
    });
  },

  /**
   * Record an analyst decision for a customer.
   * Uses the existing /decisions/recommend endpoint with an override.
   */
  async recordDecision(customerId: string, decision: string, reason: string): Promise<void> {
    if (MOCK_API_ENABLED) {
      await delay(500);
      return;
    }
    await apiRequest('/decisions/recommend', {
      method: 'POST',
      body: JSON.stringify({
        subjectType: 'CUSTOMER',
        subjectId: customerId,
        overrideDecision: decision,
        overrideReason: reason,
      }),
    });
  },
};

// ─── Webhook / Live Events API ───────────────────────────────────────────────

export interface WebhookEventRecord {
  id: string;
  merchantId: string;
  razorpayEventId: string;
  eventType: string;
  status: 'RECEIVED' | 'PROCESSED' | 'DUPLICATE' | 'IGNORED' | 'FAILED';
  paymentId: string | null;
  refundId: string | null;
  riskScore: number | null;
  riskLevel: string | null;
  errorMessage: string | null;
  source: string;          // always "RAZORPAY_TEST"
  createdAt: string;
}

export const webhookApi = {
  /**
   * List recent Razorpay Test Mode webhook events for the live monitoring UI.
   * Requires JWT auth — calls GET /api/v1/webhooks/razorpay/events.
   */
  async listEvents(params?: { page?: number; size?: number }): Promise<PaginatedResponse<WebhookEventRecord>> {
    if (MOCK_API_ENABLED) {
      await delay(300);
      return { data: [], total: 0, page: 1, pageSize: 20 };
    }
    const qs = new URLSearchParams({
      page: String(params?.page ?? 0),
      size: String(params?.size ?? 20),
    });
    const result = await apiRequestPaged<WebhookEventRecord>(`/webhooks/razorpay/events?${qs}`);
    return {
      data: result.data,
      total: result.meta.totalElements,
      page: (params?.page ?? 0) + 1,
      pageSize: params?.size ?? 20,
    };
  },
};

// ─── Razorpay Standard Checkout API ─────────────────────────────────────────

export interface RazorpayOrderResult {
  orderId:  string;
  amount:   number;
  currency: string;
  receipt:  string;
  status:   string;
}

export interface RazorpayVerifyResult {
  verified:  boolean;
  message:   string;
  paymentId: string | null;
}

export const razorpayApi = {
  /**
   * Create a Razorpay order on the backend.
   * Returns the orderId needed to open the checkout modal.
   */
  async createOrder(params: {
    amount: number;
    currency?: string;
    receipt?: string;
    description?: string;
  }): Promise<RazorpayOrderResult> {
    const result = await apiRequest<RazorpayOrderResult>('/payments/razorpay/order', {
      method: 'POST',
      body: JSON.stringify({
        amount:      params.amount,
        currency:    params.currency    ?? 'INR',
        receipt:     params.receipt     ?? `rcpt_${Date.now()}`,
        description: params.description ?? 'Zeno payment',
      }),
    });
    return result;
  },

  /**
   * Verify the payment signature returned by the checkout modal.
   * MUST be called before treating any payment as successful.
   */
  async verifyPayment(params: {
    razorpayOrderId:   string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  }): Promise<RazorpayVerifyResult> {
    const result = await apiRequest<RazorpayVerifyResult>('/payments/razorpay/verify', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    return result;
  },
};
