// API Services - Central export

export { authApi } from './authApi';
export { customerApi } from './customerApi';
export { apiRequest, ApiError, MOCK_API_ENABLED } from './client';
export * from './mockData';

// Import remaining APIs
import type { Transaction, RiskCluster, Investigation, AuditEvent, EvaluationMetrics, SignalPerformance, FalsePositiveCase, DashboardStats, DatasetRun, ClusterGraph, PaginatedResponse } from '@/types';
import { apiRequest, MOCK_API_ENABLED, delay } from './client';
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
      const data = filtered.slice(start, start + pageSize);
      
      return { data, total: filtered.length, page, pageSize };
    }
    
    const query = new URLSearchParams(params as any).toString();
    return apiRequest<PaginatedResponse<Transaction>>(`/transactions?${query}`);
  },

  async getTransaction(id: string): Promise<Transaction> {
    if (MOCK_API_ENABLED) {
      await delay();
      const transaction = mockTransactions.find(t => t.transactionId === id || t.id === id);
      if (!transaction) throw new Error('Transaction not found');
      return transaction;
    }
    
    return apiRequest<Transaction>(`/transactions/${id}`);
  },
};

export const clusterApi = {
  async getClusters(params?: { page?: number; pageSize?: number }): Promise<PaginatedResponse<RiskCluster>> {
    if (MOCK_API_ENABLED) {
      await delay();
      const page = params?.page || 1;
      const pageSize = params?.pageSize || 20;
      const start = (page - 1) * pageSize;
      const data = mockClusters.slice(start, start + pageSize);
      
      return { data, total: mockClusters.length, page, pageSize };
    }
    
    const query = new URLSearchParams(params as any).toString();
    return apiRequest<PaginatedResponse<RiskCluster>>(`/clusters?${query}`);
  },

  async getCluster(id: string): Promise<RiskCluster> {
    if (MOCK_API_ENABLED) {
      await delay();
      const cluster = mockClusters.find(c => c.clusterId === id || c.id === id);
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
      const data = filtered.slice(start, start + pageSize);
      
      return { data, total: filtered.length, page, pageSize };
    }
    
    const query = new URLSearchParams(params as any).toString();
    return apiRequest<PaginatedResponse<Investigation>>(`/investigations?${query}`);
  },

  async getInvestigation(id: string): Promise<Investigation> {
    if (MOCK_API_ENABLED) {
      await delay();
      const investigation = mockInvestigations.find(i => i.investigationId === id || i.id === id);
      if (!investigation) throw new Error('Investigation not found');
      return investigation;
    }
    
    return apiRequest<Investigation>(`/investigations/${id}`);
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
    
    const query = new URLSearchParams(params as any).toString();
    return apiRequest<PaginatedResponse<AuditEvent>>(`/audit?${query}`);
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
};

export const dashboardApi = {
  async getStats(): Promise<DashboardStats> {
    if (MOCK_API_ENABLED) {
      await delay();
      return mockDashboardStats;
    }
    
    return apiRequest<DashboardStats>('/dashboard/stats');
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
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      };
    }
    
    return apiRequest<DatasetRun>('/dataset/generate', {
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
        startedAt: new Date(Date.now() - 3600000).toISOString(),
        completedAt: new Date().toISOString(),
      };
    }
    
    return apiRequest<DatasetRun>('/dataset/current');
  },
};
