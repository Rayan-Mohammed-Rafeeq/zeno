-- ─────────────────────────────────────────────────────────────────────────────
-- V2__seed_demo_data.sql
-- Realistic demo seed data for the Zeno hackathon demo
-- All data is fictional and for demonstration purposes only
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Organizations ─────────────────────────────────────────────────────────────

INSERT INTO organizations (id, name, type, status, address, phone, email, npi_number) VALUES
(1, 'Valley Health Pharmacy', 'PHARMACY', 'ACTIVE', '1234 Main St, Springfield, IL 62701', '(217) 555-0100', 'info@valleypharmacy.example', 'NCPDP-0012345'),
(2, 'Riverside Family Practice', 'PRACTICE', 'ACTIVE', '5678 Oak Ave, Springfield, IL 62702', '(217) 555-0200', 'admin@riversidepractice.example', '1234567890');

SELECT setval('organizations_id_seq', 100);

-- ── Users ─────────────────────────────────────────────────────────────────────
-- Passwords are BCrypt-encoded. Default dev password: "password123"
-- BCrypt of "password123": $2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi

INSERT INTO users (id, username, password, role, first_name, last_name, email, is_active, organization_id) VALUES
-- Admin (no org)
(1, 'admin', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'ADMIN', 'System', 'Admin', 'admin@zeno.example', TRUE, NULL),

-- Pharmacy staff (Org 1 - Valley Health Pharmacy)
(2, 'sarah.chen',    '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'PHARMACIST',     'Sarah',   'Chen',     'sarah.chen@valleypharmacy.example',    TRUE, 1),
(3, 'mike.johnson',  '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'PHARMACY_STAFF', 'Mike',    'Johnson',  'mike.johnson@valleypharmacy.example',  TRUE, 1),

-- Practice staff (Org 2 - Riverside Family Practice)
(4, 'dr.patel',      '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'PROVIDER',       'Arun',    'Patel',    'a.patel@riversidepractice.example',    TRUE, 2),
(5, 'dr.williams',   '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'PROVIDER',       'Jessica', 'Williams', 'j.williams@riversidepractice.example', TRUE, 2),
(6, 'lisa.martinez', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'PRACTICE_STAFF', 'Lisa',    'Martinez', 'l.martinez@riversidepractice.example', TRUE, 2);

SELECT setval('users_id_seq', 100);

-- ── Providers ─────────────────────────────────────────────────────────────────

INSERT INTO providers (id, first_name, last_name, npi, specialty, email, phone_number, status, organization_id) VALUES
(1, 'Arun',    'Patel',    '1234567890', 'Family Medicine',  'a.patel@riversidepractice.example',    '(217) 555-0200', 'ACTIVE', 2),
(2, 'Jessica', 'Williams', '0987654321', 'Internal Medicine', 'j.williams@riversidepractice.example', '(217) 555-0201', 'ACTIVE', 2),
(3, 'Robert',  'Kim',      '1122334455', 'Cardiology',        'r.kim@riversidepractice.example',      '(217) 555-0202', 'ACTIVE', 2);

SELECT setval('providers_id_seq', 100);

-- ── Pharmacies ────────────────────────────────────────────────────────────────

INSERT INTO pharmacies (id, name, ncpdp_id, address, phone, fax, email, status, organization_id) VALUES
(1, 'Valley Health Pharmacy - Main', 'NCPDP001', '1234 Main St, Springfield, IL 62701', '(217) 555-0100', '(217) 555-0101', 'rx@valleypharmacy.example', 'ACTIVE', 1),
(2, 'Valley Health Pharmacy - West',  'NCPDP002', '999 West Blvd, Springfield, IL 62703', '(217) 555-0150', '(217) 555-0151', 'rxwest@valleypharmacy.example', 'ACTIVE', 1);

SELECT setval('pharmacies_id_seq', 100);

-- ── Patients ──────────────────────────────────────────────────────────────────

INSERT INTO patients (id, first_name, last_name, date_of_birth, email, phone_number, mrn, organization_id) VALUES
(1, 'James',   'Anderson',  '1958-03-15', 'j.anderson@email.example',  '(217) 555-1001', 'MRN-001', 1),
(2, 'Maria',   'Rodriguez', '1972-07-22', 'm.rodriguez@email.example', '(217) 555-1002', 'MRN-002', 1),
(3, 'William', 'Taylor',    '1965-11-03', 'w.taylor@email.example',    '(217) 555-1003', 'MRN-003', 1),
(4, 'Sandra',  'Lee',       '1980-05-17', 's.lee@email.example',       '(217) 555-1004', 'MRN-004', 1),
(5, 'Charles', 'Brown',     '1947-09-28', 'c.brown@email.example',     '(217) 555-1005', 'MRN-005', 1),
(6, 'Linda',   'Davis',     '1989-01-12', 'l.davis@email.example',     '(217) 555-1006', 'MRN-006', 1),
(7, 'Michael', 'Wilson',    '1975-06-30', 'm.wilson@email.example',    '(217) 555-1007', 'MRN-007', 1),
(8, 'Patricia','Garcia',    '1962-04-08', 'p.garcia@email.example',    '(217) 555-1008', 'MRN-008', 1);

SELECT setval('patients_id_seq', 100);

-- ── Prescriptions ─────────────────────────────────────────────────────────────
-- Note: written_date is the original prescription date

INSERT INTO prescriptions (id, patient_id, provider_id, pharmacy_id, medication_name, medication_strength, dosage_form, instructions, quantity_dispensed, days_supply, refills_allowed, refills_used, written_date, expiry_date, status, rx_number, requires_prior_auth) VALUES

-- Scenario 1: READY — no blockers, fresh refill available
(1, 1, 1, 1, 'Lisinopril', '10mg', 'Tablet', 'Take 1 tablet by mouth once daily for blood pressure', 30, 30, 5, 1, '2025-01-10', '2026-01-10', 'ACTIVE', 'RX-10001', FALSE),

-- Scenario 2: NO_REFILLS — prescription has used all refills
(2, 2, 1, 1, 'Metformin', '500mg', 'Tablet', 'Take 1 tablet twice daily with meals', 60, 30, 3, 3, '2025-03-01', '2026-03-01', 'OUT_OF_REFILLS', 'RX-10002', FALSE),

-- Scenario 3: PROVIDER_APPROVAL_REQUIRED — requires prior auth
(3, 3, 2, 1, 'Humira (adalimumab)', '40mg/0.8mL', 'Pen Injector', 'Inject 40mg subcutaneously every 2 weeks', 2, 28, 11, 0, '2025-06-15', '2026-06-15', 'ACTIVE', 'RX-10003', TRUE),

-- Scenario 4: MISSING_INFORMATION — quantity not specified
(4, 4, 2, 1, 'Tramadol', '50mg', 'Tablet', NULL, NULL, NULL, 2, 0, '2025-08-01', '2026-08-01', 'ACTIVE', 'RX-10004', FALSE),

-- Scenario 5: INSURANCE_BLOCK — we simulate by manually setting status
(5, 5, 3, 1, 'Jardiance', '10mg', 'Tablet', 'Take 1 tablet by mouth once daily in the morning', 30, 30, 5, 2, '2025-04-20', '2026-04-20', 'ACTIVE', 'RX-10005', FALSE),

-- Scenario 6: AWAITING_PHARMACY — pharmacy issue
(6, 6, 1, 2, 'Ozempic (semaglutide)', '0.5mg', 'Pen', 'Inject 0.5mg subcutaneously once weekly', 4, 28, 3, 1, '2025-07-10', '2026-07-10', 'ACTIVE', 'RX-10006', FALSE),

-- Scenario 7: RESOLVED — completed successfully
(7, 7, 3, 1, 'Atorvastatin', '40mg', 'Tablet', 'Take 1 tablet by mouth once daily at bedtime', 30, 30, 11, 3, '2025-02-14', '2026-02-14', 'ACTIVE', 'RX-10007', FALSE),

-- Scenario 8: ESCALATED — complex case
(8, 8, 2, 1, 'Warfarin', '5mg', 'Tablet', 'Take as directed — INR monitoring required', 30, 30, 11, 5, '2025-01-05', '2026-01-05', 'ACTIVE', 'RX-10008', FALSE),

-- Scenario 9: NEW_PRESCRIPTION_REQUIRED — expired
(9, 1, 1, 1, 'Amlodipine', '5mg', 'Tablet', 'Take 1 tablet by mouth once daily', 30, 30, 3, 3, '2024-01-01', '2025-01-01', 'EXPIRED', 'RX-10009', FALSE);

SELECT setval('prescriptions_id_seq', 100);

-- ── Refill Requests ───────────────────────────────────────────────────────────

INSERT INTO refill_requests (id, prescription_id, patient_id, pharmacy_id, requested_by_user_id, status, blocker_type, priority, notes, created_at) VALUES
-- 1. READY — no blockers
(1, 1, 1, 1, 3, 'READY', NULL, 'NORMAL', 'Routine refill request', NOW() - INTERVAL '2 hours'),

-- 2. NO_REFILLS — needs provider to authorize more refills
(2, 2, 2, 1, 3, 'AWAITING_PROVIDER', 'NO_REFILLS', 'HIGH', 'Patient requests refill - all authorized refills used', NOW() - INTERVAL '1 day'),

-- 3. PROVIDER_APPROVAL_REQUIRED — prior auth needed
(3, 3, 3, 1, 2, 'AWAITING_PROVIDER', 'PROVIDER_APPROVAL_REQUIRED', 'URGENT', 'Prior authorization required for biologic medication', NOW() - INTERVAL '3 days'),

-- 4. MISSING_INFORMATION — incomplete prescription
(4, 4, 4, 1, 3, 'ACTION_REQUIRED', 'MISSING_INFORMATION', 'HIGH', 'Missing quantity and days supply', NOW() - INTERVAL '4 hours'),

-- 5. INSURANCE_BLOCK — claim rejected
(5, 5, 5, 1, 3, 'AWAITING_INSURANCE', 'INSURANCE_BLOCK', 'HIGH', 'Insurance claim rejected — PA required', NOW() - INTERVAL '2 days'),

-- 6. AWAITING_PHARMACY — pharmacy issue
(6, 6, 6, 2, 2, 'AWAITING_PHARMACY', 'PHARMACY_ISSUE', 'NORMAL', 'Medication out of stock at preferred pharmacy', NOW() - INTERVAL '6 hours'),

-- 7. RESOLVED — completed
(7, 7, 7, 1, 3, 'COMPLETED', NULL, 'NORMAL', 'Routine refill', NOW() - INTERVAL '3 days'),

-- 8. ESCALATED — complex case
(8, 8, 8, 1, 2, 'ESCALATED', 'PROVIDER_APPROVAL_REQUIRED', 'URGENT', 'Warfarin adjustment pending INR results — escalated', NOW() - INTERVAL '5 days'),

-- 9. NEW_PRESCRIPTION_REQUIRED — expired prescription
(9, 9, 1, 1, 3, 'AWAITING_PROVIDER', 'NEW_PRESCRIPTION_REQUIRED', 'HIGH', 'Prescription expired — new prescription required from provider', NOW() - INTERVAL '1 day');

SELECT setval('refill_requests_id_seq', 100);

-- ── Resolution Cases ──────────────────────────────────────────────────────────

INSERT INTO resolution_cases (id, refill_request_id, blocker_type, status, priority, assigned_to_user_id, reason, resolution_summary, created_at) VALUES
-- Case for refill 2 (NO_REFILLS)
(1, 2, 'NO_REFILLS', 'WAITING_FOR_PROVIDER', 'HIGH', 6,
 'Prescription has used all 3 authorized refills. Provider must authorize additional refills or issue a new prescription.',
 NULL, NOW() - INTERVAL '1 day'),

-- Case for refill 3 (PROVIDER_APPROVAL_REQUIRED)
(2, 3, 'PROVIDER_APPROVAL_REQUIRED', 'WAITING_FOR_PROVIDER', 'URGENT', 6,
 'This prescription requires prior authorization or explicit provider approval before dispensing.',
 NULL, NOW() - INTERVAL '3 days'),

-- Case for refill 4 (MISSING_INFORMATION)
(3, 4, 'MISSING_INFORMATION', 'IN_PROGRESS', 'HIGH', 6,
 'Required information is missing from the prescription or patient record. Please review and complete.',
 NULL, NOW() - INTERVAL '4 hours'),

-- Case for refill 5 (INSURANCE_BLOCK)
(4, 5, 'INSURANCE_BLOCK', 'WAITING_FOR_INSURANCE', 'HIGH', 3,
 'Insurance or PBM has flagged this prescription. Prior authorization or claim correction may be required.',
 NULL, NOW() - INTERVAL '2 days'),

-- Case for refill 6 (PHARMACY_ISSUE)
(5, 6, 'PHARMACY_ISSUE', 'IN_PROGRESS', 'NORMAL', 2,
 'A pharmacy-side issue is preventing this refill from proceeding (formulary, stock, or administrative).',
 NULL, NOW() - INTERVAL '6 hours'),

-- Case for refill 7 (RESOLVED)
(6, 7, 'NO_REFILLS', 'RESOLVED', 'NORMAL', 6,
 'Patient had used all refills. Provider authorized 3 additional refills.',
 'Provider Dr. Kim authorized 3 additional refills via phone. Prescription updated. Refill dispensed.',
 NOW() - INTERVAL '4 days'),

-- Case for refill 8 (ESCALATED)
(7, 8, 'PROVIDER_APPROVAL_REQUIRED', 'ESCALATED', 'URGENT', 4,
 'Warfarin dosage adjustment required based on INR results. Complex case requiring provider clinical review.',
 NULL, NOW() - INTERVAL '5 days'),

-- Case for refill 9 (NEW_PRESCRIPTION_REQUIRED)
(8, 9, 'NEW_PRESCRIPTION_REQUIRED', 'WAITING_FOR_PROVIDER', 'HIGH', 6,
 'Prescription expired on 2025-01-01. A new prescription must be written by the provider.',
 NULL, NOW() - INTERVAL '1 day');

SELECT setval('resolution_cases_id_seq', 100);

-- ── Resolution Actions ────────────────────────────────────────────────────────

INSERT INTO resolution_actions (id, resolution_case_id, action_type, assigned_role, assigned_user_id, status, description, completion_notes, due_at, completed_at, created_at) VALUES
-- Actions for Case 1 (NO_REFILLS)
(1, 1, 'REQUEST_PROVIDER_APPROVAL', 'PRACTICE_STAFF', 6, 'IN_PROGRESS',
 'Contact provider to authorize additional refills for this prescription.',
 NULL, NOW() + INTERVAL '1 day', NULL, NOW() - INTERVAL '1 day'),

-- Actions for Case 2 (PROVIDER_APPROVAL_REQUIRED)
(2, 2, 'REQUEST_PROVIDER_APPROVAL', 'PRACTICE_STAFF', 6, 'PENDING',
 'Send prior authorization request to provider for review and approval.',
 NULL, NOW() + INTERVAL '2 days', NULL, NOW() - INTERVAL '3 days'),
(3, 2, 'PRIOR_AUTH_REQUEST', 'PHARMACY_STAFF', 3, 'IN_PROGRESS',
 'Submit prior authorization request to insurance/PBM for Humira.',
 NULL, NOW() + INTERVAL '1 day', NULL, NOW() - INTERVAL '2 days'),

-- Actions for Case 3 (MISSING_INFORMATION)
(4, 3, 'REQUEST_MISSING_INFORMATION', 'PRACTICE_STAFF', 6, 'COMPLETED',
 'Obtain and complete the missing prescription/patient information.',
 'Contacted prescribing office. Awaiting fax with corrected prescription.',
 NOW() - INTERVAL '1 day', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '4 hours'),
(5, 3, 'VERIFY_RESOLUTION', 'PHARMACIST', 2, 'PENDING',
 'Verify that the corrected prescription information has been received and is complete.',
 NULL, NOW() + INTERVAL '1 day', NULL, NOW() - INTERVAL '2 hours'),

-- Actions for Case 4 (INSURANCE_BLOCK)
(6, 4, 'VERIFY_INSURANCE', 'PHARMACY_STAFF', 3, 'IN_PROGRESS',
 'Contact insurance/PBM to resolve claim rejection or obtain prior auth.',
 NULL, NOW() + INTERVAL '3 days', NULL, NOW() - INTERVAL '2 days'),

-- Actions for Case 5 (PHARMACY_ISSUE)
(7, 5, 'CONTACT_PHARMACY', 'PHARMACIST', 2, 'COMPLETED',
 'Contact pharmacy to resolve formulary or dispensing issue.',
 'Checked with supplier — medication expected in stock within 2 business days.',
 NOW() - INTERVAL '3 hours', NOW() - INTERVAL '4 hours', NOW() - INTERVAL '6 hours'),

-- Actions for Case 6 (RESOLVED - completed)
(8, 6, 'REQUEST_PROVIDER_APPROVAL', 'PRACTICE_STAFF', 6, 'COMPLETED',
 'Contact provider to authorize additional refills.',
 'Provider Dr. Kim authorized 3 additional refills via phone on 09/24.',
 NOW() - INTERVAL '3 days', NOW() - INTERVAL '4 days', NOW() - INTERVAL '5 days'),

-- Actions for Case 7 (ESCALATED)
(9, 7, 'REQUEST_PROVIDER_REVIEW', 'PROVIDER', 4, 'PENDING',
 'Provider clinical review required for Warfarin dosage adjustment based on INR results.',
 NULL, NOW() + INTERVAL '1 day', NULL, NOW() - INTERVAL '5 days'),
(10, 7, 'ESCALATE_CASE', 'PHARMACIST', 2, 'COMPLETED',
 'Escalate case to senior pharmacist and provider for urgent clinical review.',
 'Escalated to Dr. Patel and senior pharmacist Sarah Chen.',
 NOW() - INTERVAL '4 days', NOW() - INTERVAL '4 days', NOW() - INTERVAL '5 days'),

-- Actions for Case 8 (NEW_PRESCRIPTION_REQUIRED)
(11, 8, 'REQUEST_NEW_PRESCRIPTION', 'PRACTICE_STAFF', 6, 'PENDING',
 'Request provider to issue a new prescription for Amlodipine.',
 NULL, NOW() + INTERVAL '2 days', NULL, NOW() - INTERVAL '1 day');

SELECT setval('resolution_actions_id_seq', 100);

-- ── Refill Events (Audit Trail) ───────────────────────────────────────────────

INSERT INTO refill_events (refill_request_id, event_type, description, from_status, to_status, actor_user_id, actor_label, related_case_id, created_at) VALUES
-- Events for refill 1 (READY)
(1, 'REFILL_REQUESTED', 'Refill request submitted for Lisinopril', NULL, 'REQUESTED', 3, 'mike.johnson', NULL, NOW() - INTERVAL '2 hours'),
(1, 'REFILL_UNDER_REVIEW', 'Triage started — evaluating prescription eligibility and blockers', 'REQUESTED', 'UNDER_REVIEW', NULL, 'triage-engine', NULL, NOW() - INTERVAL '119 minutes'),
(1, 'REFILL_READY', 'No blockers detected — refill is approved and ready to be dispensed', 'UNDER_REVIEW', 'READY', NULL, 'triage-engine', NULL, NOW() - INTERVAL '118 minutes'),

-- Events for refill 2 (NO_REFILLS)
(2, 'REFILL_REQUESTED', 'Refill request submitted for Metformin', NULL, 'REQUESTED', 3, 'mike.johnson', NULL, NOW() - INTERVAL '1 day'),
(2, 'REFILL_UNDER_REVIEW', 'Triage started — evaluating prescription eligibility and blockers', 'REQUESTED', 'UNDER_REVIEW', NULL, 'triage-engine', NULL, NOW() - INTERVAL '23 hours 58 minutes'),
(2, 'BLOCKER_IDENTIFIED', 'Blocker identified: NO_REFILLS — creating resolution case', 'UNDER_REVIEW', 'AWAITING_PROVIDER', NULL, 'triage-engine', 1, NOW() - INTERVAL '23 hours 57 minutes'),
(2, 'CASE_CREATED', 'Resolution case #1 created for blocker: NO_REFILLS', NULL, NULL, NULL, 'triage-engine', 1, NOW() - INTERVAL '23 hours 56 minutes'),
(2, 'ACTION_CREATED', 'Action created: REQUEST_PROVIDER_APPROVAL — Contact provider to authorize additional refills', NULL, NULL, 6, 'lisa.martinez', 1, NOW() - INTERVAL '23 hours 55 minutes'),

-- Events for refill 3 (PROVIDER_APPROVAL_REQUIRED)
(3, 'REFILL_REQUESTED', 'Refill request submitted for Humira (adalimumab)', NULL, 'REQUESTED', 2, 'sarah.chen', NULL, NOW() - INTERVAL '3 days'),
(3, 'REFILL_UNDER_REVIEW', 'Triage started', 'REQUESTED', 'UNDER_REVIEW', NULL, 'triage-engine', NULL, NOW() - INTERVAL '3 days'),
(3, 'BLOCKER_IDENTIFIED', 'Blocker identified: PROVIDER_APPROVAL_REQUIRED', 'UNDER_REVIEW', 'AWAITING_PROVIDER', NULL, 'triage-engine', 2, NOW() - INTERVAL '3 days'),
(3, 'CASE_CREATED', 'Resolution case #2 created for blocker: PROVIDER_APPROVAL_REQUIRED', NULL, NULL, NULL, 'triage-engine', 2, NOW() - INTERVAL '3 days'),

-- Events for refill 7 (RESOLVED/COMPLETED)
(7, 'REFILL_REQUESTED', 'Refill request submitted for Atorvastatin', NULL, 'REQUESTED', 3, 'mike.johnson', NULL, NOW() - INTERVAL '4 days'),
(7, 'REFILL_UNDER_REVIEW', 'Triage started', 'REQUESTED', 'UNDER_REVIEW', NULL, 'triage-engine', NULL, NOW() - INTERVAL '4 days'),
(7, 'BLOCKER_IDENTIFIED', 'Blocker identified: NO_REFILLS', 'UNDER_REVIEW', 'AWAITING_PROVIDER', NULL, 'triage-engine', 6, NOW() - INTERVAL '4 days'),
(7, 'CASE_CREATED', 'Resolution case #6 created for blocker: NO_REFILLS', NULL, NULL, NULL, 'triage-engine', 6, NOW() - INTERVAL '4 days'),
(7, 'ACTION_COMPLETED', 'Provider authorized 3 additional refills via phone', NULL, NULL, 6, 'lisa.martinez', 6, NOW() - INTERVAL '3 days 23 hours'),
(7, 'CASE_RESOLVED', 'Resolution case resolved: Provider Dr. Kim authorized 3 additional refills', NULL, NULL, 6, 'lisa.martinez', 6, NOW() - INTERVAL '3 days 22 hours'),
(7, 'REFILL_READY', 'No blockers detected — refill approved', 'UNDER_REVIEW', 'READY', NULL, 'triage-engine', NULL, NOW() - INTERVAL '3 days 21 hours'),
(7, 'REFILL_COMPLETED', 'Refill dispensed and completed', 'READY', 'COMPLETED', 2, 'sarah.chen', NULL, NOW() - INTERVAL '3 days'),

-- Events for refill 8 (ESCALATED)
(8, 'REFILL_REQUESTED', 'Refill request submitted for Warfarin', NULL, 'REQUESTED', 2, 'sarah.chen', NULL, NOW() - INTERVAL '5 days'),
(8, 'REFILL_UNDER_REVIEW', 'Triage started', 'REQUESTED', 'UNDER_REVIEW', NULL, 'triage-engine', NULL, NOW() - INTERVAL '5 days'),
(8, 'BLOCKER_IDENTIFIED', 'Blocker identified: PROVIDER_APPROVAL_REQUIRED — complex clinical case', 'UNDER_REVIEW', 'AWAITING_PROVIDER', NULL, 'triage-engine', 7, NOW() - INTERVAL '5 days'),
(8, 'CASE_CREATED', 'Resolution case #7 created for blocker: PROVIDER_APPROVAL_REQUIRED', NULL, NULL, NULL, 'triage-engine', 7, NOW() - INTERVAL '5 days'),
(8, 'CASE_ESCALATED', 'Case escalated: Warfarin dosage adjustment requires urgent provider clinical review', NULL, 'ESCALATED', 2, 'sarah.chen', 7, NOW() - INTERVAL '4 days'),
(8, 'REFILL_ESCALATED', 'Escalated to senior pharmacist and provider', 'AWAITING_PROVIDER', 'ESCALATED', 2, 'sarah.chen', 7, NOW() - INTERVAL '4 days');
