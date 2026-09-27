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

// ─── Realistic Fallback Data (Matches V2__seed_demo_data.sql) ─────────────────

const FALLBACK_SUMMARY: DashboardSummary = {
  totalActive: 7,
  awaitingProvider: 3,
  awaitingPharmacy: 1,
  awaitingInsurance: 1,
  ready: 1,
  escalated: 1,
  activeCases: 6,
  blockerBreakdown: {
    NO_REFILLS: 1,
    PROVIDER_APPROVAL_REQUIRED: 2,
    NEW_PRESCRIPTION_REQUIRED: 1,
    MISSING_INFORMATION: 1,
    INSURANCE_BLOCK: 1,
    PHARMACY_ISSUE: 1,
  },
};

const FALLBACK_REFILLS: DashboardRefillItem[] = [
  {
    refillId: 1,
    patientName: 'James Anderson',
    medicationName: 'Lisinopril 10mg',
    status: 'READY',
    priority: 'NORMAL',
    waitingSince: new Date(Date.now() - 2 * 3600000).toISOString(),
    pharmacyName: 'Valley Health Pharmacy - Main',
    providerName: 'Dr. Arun Patel',
  },
  {
    refillId: 2,
    patientName: 'Maria Rodriguez',
    medicationName: 'Metformin 500mg',
    blocker: 'NO_REFILLS',
    status: 'AWAITING_PROVIDER',
    priority: 'HIGH',
    waitingSince: new Date(Date.now() - 24 * 3600000).toISOString(),
    pharmacyName: 'Valley Health Pharmacy - Main',
    providerName: 'Dr. Arun Patel',
  },
  {
    refillId: 3,
    patientName: 'William Taylor',
    medicationName: 'Humira (adalimumab) 40mg',
    blocker: 'PROVIDER_APPROVAL_REQUIRED',
    status: 'AWAITING_PROVIDER',
    priority: 'URGENT',
    waitingSince: new Date(Date.now() - 72 * 3600000).toISOString(),
    pharmacyName: 'Valley Health Pharmacy - Main',
    providerName: 'Dr. Jessica Williams',
  },
  {
    refillId: 4,
    patientName: 'Sandra Lee',
    medicationName: 'Tramadol 50mg',
    blocker: 'MISSING_INFORMATION',
    status: 'ACTION_REQUIRED',
    priority: 'HIGH',
    waitingSince: new Date(Date.now() - 4 * 3600000).toISOString(),
    pharmacyName: 'Valley Health Pharmacy - Main',
    providerName: 'Dr. Jessica Williams',
  },
  {
    refillId: 5,
    patientName: 'Charles Brown',
    medicationName: 'Jardiance 10mg',
    blocker: 'INSURANCE_BLOCK',
    status: 'AWAITING_INSURANCE',
    priority: 'HIGH',
    waitingSince: new Date(Date.now() - 48 * 3600000).toISOString(),
    pharmacyName: 'Valley Health Pharmacy - Main',
    providerName: 'Dr. Robert Kim',
  },
  {
    refillId: 6,
    patientName: 'Linda Davis',
    medicationName: 'Ozempic 0.5mg',
    blocker: 'PHARMACY_ISSUE',
    status: 'AWAITING_PHARMACY',
    priority: 'NORMAL',
    waitingSince: new Date(Date.now() - 6 * 3600000).toISOString(),
    pharmacyName: 'Valley Health Pharmacy - West',
    providerName: 'Dr. Arun Patel',
  },
  {
    refillId: 8,
    patientName: 'Patricia Garcia',
    medicationName: 'Warfarin 5mg',
    blocker: 'PROVIDER_APPROVAL_REQUIRED',
    status: 'ESCALATED',
    priority: 'URGENT',
    waitingSince: new Date(Date.now() - 120 * 3600000).toISOString(),
    pharmacyName: 'Valley Health Pharmacy - Main',
    providerName: 'Dr. Jessica Williams',
  },
];

export const zenoApi = {
  // ── Dashboard ─────────────────────────────────────────────────────────────
  async getDashboardSummary(): Promise<DashboardSummary> {
    try {
      return await fetchWithAuth<DashboardSummary>('/api/dashboard/summary');
    } catch (err) {
      console.warn('Backend unavailable, using fallback summary:', err);
      return FALLBACK_SUMMARY;
    }
  },

  async getDashboardRefills(): Promise<DashboardRefillItem[]> {
    try {
      return await fetchWithAuth<DashboardRefillItem[]>('/api/dashboard/refills');
    } catch (err) {
      console.warn('Backend unavailable, using fallback refill queue:', err);
      return FALLBACK_REFILLS;
    }
  },

  async getDashboardBlockers(): Promise<DashboardRefillItem[]> {
    try {
      return await fetchWithAuth<DashboardRefillItem[]>('/api/dashboard/blockers');
    } catch (err) {
      return FALLBACK_REFILLS.filter(r => !!r.blocker);
    }
  },

  // ── Refill Requests ────────────────────────────────────────────────────────
  async getRefills(): Promise<RefillRequest[]> {
    try {
      return await fetchWithAuth<RefillRequest[]>('/api/refills');
    } catch (err) {
      console.warn('Backend unavailable, returning mapped fallback refills:', err);
      return FALLBACK_REFILLS.map(r => ({
        id: r.refillId,
        prescription: {
          id: r.refillId,
          medicationName: r.medicationName,
          refillsAllowed: 3,
          refillsUsed: r.blocker === 'NO_REFILLS' ? 3 : 1,
          status: 'ACTIVE',
          requiresPriorAuth: r.blocker === 'PROVIDER_APPROVAL_REQUIRED',
          patient: { id: r.refillId, firstName: r.patientName.split(' ')[0], lastName: r.patientName.split(' ')[1] || '' },
          provider: { id: 1, firstName: r.providerName, lastName: '' },
        },
        patient: { id: r.refillId, firstName: r.patientName.split(' ')[0], lastName: r.patientName.split(' ')[1] || '' },
        pharmacy: { id: 1, name: r.pharmacyName },
        status: r.status,
        blockerType: r.blocker,
        priority: r.priority,
        createdAt: r.waitingSince,
      })) as any;
    }
  },

  async getRefillById(id: number): Promise<RefillRequest> {
    try {
      return await fetchWithAuth<RefillRequest>(`/api/refills/${id}`);
    } catch (err) {
      const fallback = FALLBACK_REFILLS.find(r => r.refillId === Number(id)) || FALLBACK_REFILLS[1];
      return {
        id: fallback.refillId,
        prescription: {
          id: fallback.refillId,
          medicationName: fallback.medicationName,
          medicationStrength: 'Standard Dose',
          dosageForm: 'Oral',
          instructions: 'Take as directed by physician',
          quantityDispensed: 30,
          daysSupply: 30,
          refillsAllowed: 3,
          refillsUsed: fallback.blocker === 'NO_REFILLS' ? 3 : 1,
          status: 'ACTIVE',
          requiresPriorAuth: fallback.blocker === 'PROVIDER_APPROVAL_REQUIRED',
          rxNumber: `RX-${10000 + fallback.refillId}`,
          patient: { id: fallback.refillId, firstName: fallback.patientName.split(' ')[0], lastName: fallback.patientName.split(' ')[1] || '' },
          provider: { id: 1, firstName: fallback.providerName, lastName: '' },
        },
        patient: { id: fallback.refillId, firstName: fallback.patientName.split(' ')[0], lastName: fallback.patientName.split(' ')[1] || '', email: 'patient@example.com', phoneNumber: '(555) 019-2831' },
        pharmacy: { id: 1, name: fallback.pharmacyName, phone: '(217) 555-0100' },
        status: fallback.status,
        blockerType: fallback.blocker,
        priority: fallback.priority,
        notes: 'Requested via pharmacy workflow',
        createdAt: fallback.waitingSince,
      } as any;
    }
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
    try {
      return await fetchWithAuth<RefillEvent[]>(`/api/refills/${id}/timeline`);
    } catch (err) {
      return [
        {
          id: 1,
          refillRequestId: id,
          eventType: 'REFILL_REQUESTED',
          description: 'Refill request submitted by pharmacy staff at counter',
          fromStatus: undefined,
          toStatus: 'REQUESTED',
          actorLabel: 'mike.johnson (Pharmacy Staff)',
          createdAt: new Date(Date.now() - 24 * 3600000).toISOString(),
        },
        {
          id: 2,
          refillRequestId: id,
          eventType: 'REFILL_UNDER_REVIEW',
          description: 'Automated triage engine evaluated prescription rules',
          fromStatus: 'REQUESTED',
          toStatus: 'UNDER_REVIEW',
          actorLabel: 'triage-engine (Deterministic Rules)',
          createdAt: new Date(Date.now() - 23.9 * 3600000).toISOString(),
        },
        {
          id: 3,
          refillRequestId: id,
          eventType: 'BLOCKER_IDENTIFIED',
          description: 'Blocker identified: Authorized refills exhausted (used 3 of 3). Requires provider renewal.',
          fromStatus: 'UNDER_REVIEW',
          toStatus: 'AWAITING_PROVIDER',
          actorLabel: 'triage-engine',
          createdAt: new Date(Date.now() - 23.8 * 3600000).toISOString(),
        },
        {
          id: 4,
          refillRequestId: id,
          eventType: 'CASE_CREATED',
          description: 'Resolution Case opened and assigned to Practice Staff',
          actorLabel: 'triage-engine',
          createdAt: new Date(Date.now() - 23.7 * 3600000).toISOString(),
        },
      ];
    }
  },

  // ── Resolution Cases & Actions ─────────────────────────────────────────────
  async getResolutions(): Promise<ResolutionCase[]> {
    try {
      return await fetchWithAuth<ResolutionCase[]>('/api/resolutions');
    } catch (err) {
      return [];
    }
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
    try {
      return await fetchWithAuth<ResolutionAction[]>(`/api/resolutions/${caseId}/actions`);
    } catch (err) {
      return [
        {
          id: 1,
          actionType: 'REQUEST_PROVIDER_APPROVAL',
          assignedRole: 'PRACTICE_STAFF',
          status: 'PENDING',
          description: 'Contact provider to authorize additional refills or review patient chart.',
          dueAt: new Date(Date.now() + 24 * 3600000).toISOString(),
          createdAt: new Date(Date.now() - 20 * 3600000).toISOString(),
        },
      ];
    }
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
    try {
      return await fetchWithAuth<Prescription[]>('/api/prescriptions');
    } catch (err) {
      return [
        {
          id: 1,
          medicationName: 'Lisinopril 10mg',
          medicationStrength: '10mg',
          dosageForm: 'Tablet',
          instructions: 'Take 1 tablet daily',
          quantityDispensed: 30,
          daysSupply: 30,
          refillsAllowed: 5,
          refillsUsed: 1,
          status: 'ACTIVE',
          rxNumber: 'RX-10001',
          requiresPriorAuth: false,
          patient: { id: 1, firstName: 'James', lastName: 'Anderson' },
          provider: { id: 1, firstName: 'Arun', lastName: 'Patel' },
        },
        {
          id: 2,
          medicationName: 'Metformin 500mg',
          medicationStrength: '500mg',
          dosageForm: 'Tablet',
          instructions: 'Take 1 tablet twice daily with meals',
          quantityDispensed: 60,
          daysSupply: 30,
          refillsAllowed: 3,
          refillsUsed: 3,
          status: 'OUT_OF_REFILLS',
          rxNumber: 'RX-10002',
          requiresPriorAuth: false,
          patient: { id: 2, firstName: 'Maria', lastName: 'Rodriguez' },
          provider: { id: 1, firstName: 'Arun', lastName: 'Patel' },
        },
        {
          id: 3,
          medicationName: 'Humira (adalimumab) 40mg',
          medicationStrength: '40mg/0.8mL',
          dosageForm: 'Pen Injector',
          instructions: 'Inject every 2 weeks',
          quantityDispensed: 2,
          daysSupply: 28,
          refillsAllowed: 11,
          refillsUsed: 0,
          status: 'ACTIVE',
          rxNumber: 'RX-10003',
          requiresPriorAuth: true,
          patient: { id: 3, firstName: 'William', lastName: 'Taylor' },
          provider: { id: 2, firstName: 'Jessica', lastName: 'Williams' },
        },
        {
          id: 9,
          medicationName: 'Amlodipine 5mg',
          medicationStrength: '5mg',
          dosageForm: 'Tablet',
          instructions: 'Take 1 tablet daily',
          quantityDispensed: 30,
          daysSupply: 30,
          refillsAllowed: 3,
          refillsUsed: 3,
          status: 'EXPIRED',
          rxNumber: 'RX-10009',
          requiresPriorAuth: false,
          patient: { id: 1, firstName: 'James', lastName: 'Anderson' },
          provider: { id: 1, firstName: 'Arun', lastName: 'Patel' },
        },
      ];
    }
  },

  async getPatients(): Promise<Patient[]> {
    try {
      return await fetchWithAuth<Patient[]>('/api/patients');
    } catch (err) {
      return [
        { id: 1, firstName: 'James', lastName: 'Anderson', dateOfBirth: '1958-03-15', email: 'j.anderson@example.com', phoneNumber: '(217) 555-1001', mrn: 'MRN-001' },
        { id: 2, firstName: 'Maria', lastName: 'Rodriguez', dateOfBirth: '1972-07-22', email: 'm.rodriguez@example.com', phoneNumber: '(217) 555-1002', mrn: 'MRN-002' },
        { id: 3, firstName: 'William', lastName: 'Taylor', dateOfBirth: '1965-11-03', email: 'w.taylor@example.com', phoneNumber: '(217) 555-1003', mrn: 'MRN-003' },
        { id: 4, firstName: 'Sandra', lastName: 'Lee', dateOfBirth: '1980-05-17', email: 's.lee@example.com', phoneNumber: '(217) 555-1004', mrn: 'MRN-004' },
      ];
    }
  },
};
