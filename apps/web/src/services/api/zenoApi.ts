// Zeno API Client Service for Prescription Refill Resolution Platform

import type {
  DashboardSummary,
  DashboardRefillItem,
  RefillRequest,
  ResolutionCase,
  ResolutionAction,
  RefillEvent,
  Prescription,
  Patient,
} from '@/types/zeno';

export interface CreateActionDto {
  actionType: string;
  assignedRole?: string;
  assignedUserId?: number;
  description: string;
  dueAt?: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

async function fetchWithAuth<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('accessToken');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(errorBody?.message || errorBody?.error || `HTTP ${res.status}`);
  }

  return res.json();
}

export const zenoApi = {
  // ── Dashboard ─────────────────────────────────────────────────────────────
  async getDashboardSummary(): Promise<DashboardSummary> {
    return fetchWithAuth<DashboardSummary>('/api/dashboard/summary');
  },

  async getDashboardRefills(): Promise<DashboardRefillItem[]> {
    return fetchWithAuth<DashboardRefillItem[]>('/api/dashboard/refills');
  },

  async getDashboardBlockers(): Promise<DashboardRefillItem[]> {
    return fetchWithAuth<DashboardRefillItem[]>('/api/dashboard/blockers');
  },

  // ── Refill Requests ────────────────────────────────────────────────────────
  async getRefills(): Promise<RefillRequest[]> {
    return fetchWithAuth<RefillRequest[]>('/api/refills');
  },

  async getRefillById(id: number): Promise<RefillRequest> {
    return fetchWithAuth<RefillRequest>(`/api/refills/${id}`);
  },

  async createRefill(dto: { prescriptionId: number; pharmacyId: number; priority: string; notes?: string }): Promise<RefillRequest> {
    return fetchWithAuth<RefillRequest>('/api/refills', {
      method: 'POST',
      body: JSON.stringify(dto),
    });
  },

  async triageRefill(id: number): Promise<RefillRequest> {
    return fetchWithAuth<RefillRequest>(`/api/refills/${id}/triage`, {
      method: 'POST',
    });
  },

  async completeRefill(id: number): Promise<RefillRequest> {
    return fetchWithAuth<RefillRequest>(`/api/refills/${id}/complete`, {
      method: 'POST',
    });
  },

  async cancelRefill(id: number, reason: string): Promise<RefillRequest> {
    return fetchWithAuth<RefillRequest>(`/api/refills/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  async getRefillTimeline(id: number): Promise<RefillEvent[]> {
    return fetchWithAuth<RefillEvent[]>(`/api/refills/${id}/timeline`);
  },

  // ── Resolution Cases & Actions ─────────────────────────────────────────────
  async getResolutions(): Promise<ResolutionCase[]> {
    return fetchWithAuth<ResolutionCase[]>('/api/resolutions');
  },

  async getResolutionById(id: number): Promise<ResolutionCase> {
    return fetchWithAuth<ResolutionCase>(`/api/resolutions/${id}`);
  },

  async getResolutionByRefillId(refillId: number): Promise<ResolutionCase> {
    return fetchWithAuth<ResolutionCase>(`/api/resolutions/refill/${refillId}`);
  },

  async requestRecommendation(caseId: number): Promise<{ available: boolean; message?: string; recommendation?: any }> {
    return fetchWithAuth(`/api/resolutions/${caseId}/recommendation`, { method: 'POST' });
  },

  async getPersistedRecommendation(caseId: number): Promise<{ available: boolean; message?: string; recommendation?: any }> {
    return fetchWithAuth(`/api/resolutions/${caseId}/recommendation`);
  },

  async getResolutionActions(caseId: number): Promise<ResolutionAction[]> {
    return fetchWithAuth<ResolutionAction[]>(`/api/resolutions/${caseId}/actions`);
  },

  async createAction(caseId: number, dto: CreateActionDto): Promise<ResolutionAction> {
    return fetchWithAuth<ResolutionAction>(`/api/resolutions/${caseId}/actions`, {
      method: 'POST',
      body: JSON.stringify(dto),
    });
  },

  async completeAction(caseId: number, actionId: number, notes: string): Promise<ResolutionAction> {
    return fetchWithAuth<ResolutionAction>(`/api/resolutions/${caseId}/actions/${actionId}/complete`, {
      method: 'POST',
      body: JSON.stringify({ notes }),
    });
  },

  async resolveCase(caseId: number, resolutionSummary: string): Promise<ResolutionCase> {
    return fetchWithAuth<ResolutionCase>(`/api/resolutions/${caseId}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ resolutionSummary }),
    });
  },

  async escalateCase(caseId: number, reason: string): Promise<ResolutionCase> {
    return fetchWithAuth<ResolutionCase>(`/api/resolutions/${caseId}/escalate`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  // ── Prescriptions & Patients ───────────────────────────────────────────────
  async getPrescriptions(): Promise<Prescription[]> {
    return fetchWithAuth<Prescription[]>('/api/prescriptions');
  },

  async getPatients(): Promise<Patient[]> {
    return fetchWithAuth<Patient[]>('/api/patients');
  },
};
