// Customer API

import type { Customer, CustomerRiskDetail, PaginatedResponse } from '@/types';
import { apiRequest, apiRequestPaged, MOCK_API_ENABLED, delay } from './client';
import { mockCustomers } from './mockData';

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
          c.customerId.toLowerCase().includes(search)
        );
      }
      if (params?.riskLevel && params.riskLevel !== 'ALL') {
        filtered = filtered.filter(c => c.riskLevel === params.riskLevel);
      }
      const page = params?.page || 1;
      const pageSize = params?.pageSize || 20;
      const start = (page - 1) * pageSize;
      return { data: filtered.slice(start, start + pageSize), total: filtered.length, page, pageSize };
    }

    // Backend: page is 0-indexed, param is `size` not `pageSize`.
    // Backend now supports: search (externalCustomerId contains), riskLevel (post-filter)
    const backendPage = Math.max(0, (params?.page ?? 1) - 1);
    const qs = new URLSearchParams({
      page: String(backendPage),
      size: String(params?.pageSize ?? 20),
    });
    if (params?.search?.trim())                           qs.set('search', params.search.trim());
    if (params?.riskLevel && params.riskLevel !== 'ALL') qs.set('riskLevel', params.riskLevel);
    const result = await apiRequestPaged<Customer>(`/customers?${qs}`);
    return {
      data: result.data,
      total: result.meta.totalElements,
      page: params?.page ?? 1,
      pageSize: params?.pageSize ?? 20,
    };
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

  async getCustomerRiskAssessment(id: string): Promise<CustomerRiskDetail> {
    if (MOCK_API_ENABLED) {
      await delay();
      const customer = mockCustomers.find(c => c.customerId === id || c.id === id);
      if (!customer) throw new Error('Customer not found');
      // Return a minimal CustomerRiskDetail shape for mock mode
      return {
        assessmentId: `risk-${id}`,
        customerId: id,
        riskScore: customer.riskScore ?? 0,
        riskLevel: customer.riskLevel ?? 'LOW',
        flagged: customer.riskLevel === 'HIGH' || customer.riskLevel === 'CRITICAL',
        signals: [],
        fraudProbability: null,
        anomalyScore: null,
        modelVersion: null,
        shapContributions: null,
        aiAssessment: null,
        createdAt: customer.createdAt,
      };
    }
    return apiRequest<CustomerRiskDetail>(`/customers/${id}/risk-assessment`);
  },

  async getCustomerTransactions(customerId: string, params?: { page?: number; pageSize?: number }): Promise<import('@/types').PaginatedResponse<import('@/types').Transaction>> {
    if (MOCK_API_ENABLED) {
      await delay();
      const { mockTransactions } = await import('./mockData');
      const filtered = mockTransactions.filter(t => t.customerId === customerId);
      const page = params?.page ?? 1;
      const pageSize = params?.pageSize ?? 10;
      const start = (page - 1) * pageSize;
      return { data: filtered.slice(start, start + pageSize), total: filtered.length, page, pageSize };
    }
    const backendPage = Math.max(0, (params?.page ?? 1) - 1);
    const qs = new URLSearchParams({
      customerId,
      page: String(backendPage),
      size: String(params?.pageSize ?? 10),
    }).toString();
    const result = await apiRequestPaged<import('@/types').Transaction>(`/payments?${qs}`);
    return { data: result.data, total: result.meta.totalElements, page: params?.page ?? 1, pageSize: params?.pageSize ?? 10 };
  },
};
