// Zeno Domain Types for Prescription Refill Resolution Platform

export type UserRole = 'ADMIN' | 'PHARMACIST' | 'PHARMACY_STAFF' | 'PROVIDER' | 'PRACTICE_STAFF';

export type OrganizationType = 'PHARMACY' | 'PRACTICE';

export interface Organization {
  id: number;
  name: string;
  type: OrganizationType;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  address?: string;
  phone?: string;
  email?: string;
  npiNumber?: string;
}

export interface User {
  id: number | string;
  username: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  role: UserRole;
  roleDisplayName?: string;
  organizationId?: number;
  organization?: Organization;
  active?: boolean;
}

export interface Patient {
  id: number;
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  email?: string;
  phoneNumber?: string;
  mrn?: string;
  fullName?: string;
  organization?: Organization;
}

export interface Provider {
  id: number;
  firstName: string;
  lastName: string;
  npi?: string;
  specialty?: string;
  email?: string;
  phoneNumber?: string;
  status?: string;
  fullName?: string;
}

export interface Pharmacy {
  id: number;
  name: string;
  ncpdpId?: string;
  address?: string;
  phone?: string;
  status?: string;
}

export type PrescriptionStatus = 'ACTIVE' | 'EXPIRED' | 'CANCELLED' | 'OUT_OF_REFILLS' | 'TRANSFERRED' | 'ON_HOLD';

export interface Prescription {
  id: number;
  patient: Patient;
  provider: Provider;
  pharmacy?: Pharmacy;
  medicationName: string;
  medicationStrength?: string;
  dosageForm?: string;
  instructions?: string;
  quantityDispensed?: number;
  daysSupply?: number;
  refillsAllowed: number;
  refillsUsed: number;
  writtenDate?: string;
  expiryDate?: string;
  status: PrescriptionStatus;
  rxNumber?: string;
  requiresPriorAuth: boolean;
}

export type RefillStatus =
  | 'REQUESTED'
  | 'UNDER_REVIEW'
  | 'BLOCKED'
  | 'ACTION_REQUIRED'
  | 'AWAITING_PROVIDER'
  | 'AWAITING_PRACTICE'
  | 'AWAITING_PHARMACY'
  | 'AWAITING_INSURANCE'
  | 'READY'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'ESCALATED';

export type BlockerType =
  | 'NO_REFILLS'
  | 'PROVIDER_APPROVAL_REQUIRED'
  | 'NEW_PRESCRIPTION_REQUIRED'
  | 'VISIT_REQUIRED'
  | 'MISSING_INFORMATION'
  | 'INSURANCE_BLOCK'
  | 'PHARMACY_ISSUE'
  | 'OTHER';

export type RefillPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export interface RefillRequest {
  id: number;
  prescription: Pick<Prescription, 'id' | 'medicationName' | 'medicationStrength' | 'instructions' | 'quantityDispensed' | 'daysSupply' | 'refillsAllowed' | 'refillsUsed' | 'rxNumber'> & {
    provider?: Pick<Provider, 'id' | 'firstName' | 'lastName' | 'npi' | 'specialty'>;
  };
  patient: Pick<Patient, 'id' | 'firstName' | 'lastName' | 'mrn'>;
  pharmacy: Pick<Pharmacy, 'id' | 'name'>;
  requestedBy?: User;
  status: RefillStatus;
  blockerType?: BlockerType;
  priority: RefillPriority;
  notes?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export type ResolutionStatus =
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'WAITING_FOR_INFORMATION'
  | 'WAITING_FOR_PROVIDER'
  | 'WAITING_FOR_PHARMACY'
  | 'WAITING_FOR_INSURANCE'
  | 'PENDING_VERIFICATION'
  | 'RESOLVED'
  | 'ESCALATED'
  | 'CANCELLED';

export type ActionType =
  | 'REQUEST_PROVIDER_REVIEW'
  | 'REQUEST_MISSING_INFORMATION'
  | 'CONTACT_PHARMACY'
  | 'VERIFY_INSURANCE'
  | 'REQUEST_NEW_PRESCRIPTION'
  | 'REQUEST_PROVIDER_APPROVAL'
  | 'FOLLOW_UP_WITH_PRACTICE'
  | 'VERIFY_RESOLUTION'
  | 'ESCALATE_CASE'
  | 'CONTACT_PATIENT'
  | 'PRIOR_AUTH_REQUEST'
  | 'OTHER';

export type ActionStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface ResolutionAction {
  id: number;
  actionType: ActionType;
  assignedRole?: UserRole;
  assignedUser?: User;
  status: ActionStatus;
  description: string;
  completionNotes?: string;
  dueAt?: string;
  completedAt?: string;
  completedBy?: User;
  createdAt: string;
}

export interface ResolutionCase {
  id: number;
  refillRequest: RefillRequest;
  blockerType: BlockerType;
  status: ResolutionStatus;
  priority: RefillPriority;
  assignedTo?: User;
  reason?: string;
  resolutionSummary?: string;
  aiRecommendation?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt?: string;
  actions?: ResolutionAction[];
}

export type RefillEventType =
  | 'REFILL_REQUESTED'
  | 'REFILL_UNDER_REVIEW'
  | 'REFILL_BLOCKED'
  | 'REFILL_READY'
  | 'REFILL_COMPLETED'
  | 'REFILL_CANCELLED'
  | 'REFILL_ESCALATED'
  | 'BLOCKER_IDENTIFIED'
  | 'BLOCKER_CLEARED'
  | 'CASE_CREATED'
  | 'CASE_ASSIGNED'
  | 'CASE_ESCALATED'
  | 'CASE_RESOLVED'
  | 'ACTION_CREATED'
  | 'ACTION_COMPLETED'
  | 'PROVIDER_REVIEW_REQUESTED'
  | 'PROVIDER_APPROVED'
  | 'INFORMATION_REQUESTED'
  | 'INSURANCE_CHECK_REQUESTED'
  | 'RESOLUTION_SUBMITTED'
  | 'RESOLUTION_VERIFIED';

export interface RefillEvent {
  id: number;
  refillRequestId: number;
  eventType: RefillEventType;
  description: string;
  fromStatus?: RefillStatus;
  toStatus?: RefillStatus;
  actorLabel?: string;
  relatedCaseId?: number;
  relatedActionId?: number;
  createdAt: string;
}

export interface DashboardSummary {
  totalActive: number;
  awaitingProvider: number;
  awaitingPractice?: number;
  awaitingPharmacy: number;
  awaitingInsurance: number;
  ready: number;
  escalated: number;
  activeCases: number;
  blockerBreakdown: Record<string, number>;
}

export interface DashboardRefillItem {
  refillId: number;
  patientName: string;
  medicationName: string;
  blocker?: BlockerType;
  status: RefillStatus;
  priority: RefillPriority;
  waitingSince: string;
  pharmacyName: string;
  providerName: string;
}
