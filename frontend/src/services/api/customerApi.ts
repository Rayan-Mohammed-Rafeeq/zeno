// Customer API

import type { Customer, RiskAssessment, PaginatedResponse } from '@/types';
import { apiRequest, MOCK_API_ENABLED, delay } from './client';
import { mockCustomers, mockRiskSignals } from './mockData';

export const customerApi = {
  async getCustomers(params?: {
    page?: number;
    pageSize?: number;
    search?: string;
    riskLevel?: string;
  }): Promise<PaginatedResponse<Customer>> {
    if (MOCK_API_ENABLED) {
      await delay();
      let filtered = [...mockCustomers];
      
      if (params?.search) {
        const search = params.search.toLowerCase();
        filtered = filtered.filter(c => 
          c.name.toLowerCase().includes(search) ||
          c.customerId.toLowerCase().includes(search) ||
          c.email.toLowerCase().includes(search)
        );
      }
      
      if (params?.riskLevel && params.riskLevel !== 'ALL') {
        filtered = filtered.filter(c => c.riskLevel === params.riskLevel);
      }
      
      const page = params?.page || 1;
      const pageSize = params?.pageSize || 20;
      const start = (page - 1) * pageSize;
      const data = filtered.slice(start, start + pageSize);
      
      return {
        data,
        total: filtered.length,
        page,
        pageSize,
      };
    }
    
    const query = new URLSearchParams(params as any).toString();
    return apiRequest<PaginatedResponse<Customer>>(`/customers?${query}`);
  },

  async getCustomer(id: string): Promise<Customer> {
    if (MOCK_API_ENABLED) {
      await delay();
      const customer = mockCustomers.find(c => c.customerId === id || c.id === id);
      if (!customer) throw new Error('Customer not found');
      return customer;
    }
    
    return apiRequest<Customer>(`/customers/${id}`);
  },

  async getCustomerRiskAssessment(id: string): Promise<RiskAssessment> {
    if (MOCK_API_ENABLED) {
      await delay();
      const customer = mockCustomers.find(c => c.customerId === id || c.id === id);
      if (!customer) throw new Error('Customer not found');
      
      return {
        id: `risk-${id}`,
        entityId: customer.id,
        entityType: 'CUSTOMER',
        riskScore: customer.riskScore,
        riskLevel: customer.riskLevel,
        signals: mockRiskSignals,
        aiAssessment: customer.riskLevel === 'HIGH' || customer.riskLevel === 'CRITICAL' ? {
          id: 'ai-1',
          summary: 'Potential coordinated refund behavior detected',
          reasoning: 'Analysis of transaction patterns reveals unusual refund velocity and device sharing behavior that exceeds merchant baseline by significant margin. Multiple risk signals correlate temporally.',
          confidence: 0.87,
          evidenceConsidered: [
            'Refund velocity 5.8x above baseline',
            'Shared device fingerprint with 3 other flagged accounts',
            'IP address clustering with known fraudulent patterns',
          ],
          recommendedAction: 'MANUAL_REVIEW',
          limitations: 'AI assessment supports analyst review and does not independently establish fraud. False positive rate on this signal combination is approximately 6.1%.',
          createdAt: new Date().toISOString(),
        } : undefined,
        createdAt: customer.createdAt,
      };
    }
    
    return apiRequest<RiskAssessment>(`/customers/${id}/risk-assessment`);
  },
};
