-- ─────────────────────────────────────────────────────────────────────────────
-- V7__refresh_demo_data.sql
-- Refreshes transactional demo data to a clean, realistic state.
-- Safe to run: only deletes/reinserts rows with IDs 1-99 (seed range).
-- Users, organizations, providers, pharmacies, and prescriptions are untouched.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Clear existing transactional seed data (cascade-safe order) ────────────

DELETE FROM refill_events          WHERE refill_request_id < 100;
DELETE FROM resolution_actions     WHERE id < 100;
DELETE FROM resolution_cases       WHERE id < 100;
DELETE FROM refill_requests        WHERE id < 100;

-- ── 2. Reset prescriptions to their original state ────────────────────────────
-- (undo any refills_used / status changes applied during demos)

UPDATE prescriptions SET refills_used = 1, status = 'ACTIVE'         WHERE id = 1; -- Lisinopril
UPDATE prescriptions SET refills_used = 3, status = 'OUT_OF_REFILLS' WHERE id = 2; -- Metformin
UPDATE prescriptions SET refills_used = 0, status = 'ACTIVE'         WHERE id = 3; -- Humira
UPDATE prescriptions SET refills_used = 0, status = 'ACTIVE'         WHERE id = 4; -- Tramadol
UPDATE prescriptions SET refills_used = 2, status = 'ACTIVE'         WHERE id = 5; -- Jardiance
UPDATE prescriptions SET refills_used = 1, status = 'ACTIVE'         WHERE id = 6; -- Ozempic
UPDATE prescriptions SET refills_used = 3, status = 'ACTIVE'         WHERE id = 7; -- Atorvastatin
UPDATE prescriptions SET refills_used = 5, status = 'ACTIVE'         WHERE id = 8; -- Warfarin
UPDATE prescriptions SET refills_used = 3, status = 'EXPIRED'        WHERE id = 9; -- Amlodipine (expired)

-- ── 3. Re-seed refill requests ────────────────────────────────────────────────
-- requested_by_user_id: 2 = sarah.chen (PHARMACIST), 3 = mike.johnson (PHARMACY_STAFF)

INSERT INTO refill_requests (id, prescription_id, patient_id, pharmacy_id, requested_by_user_id, status, blocker_type, priority, notes, created_at) VALUES

-- 1. READY — no blockers, all clear
(1, 1, 1, 1, 3, 'READY', NULL, 'NORMAL',
 'Routine refill request for Lisinopril. No blockers detected.',
 NOW() - INTERVAL '2 hours'),

-- 2. NO_REFILLS — needs provider to authorize more refills
(2, 2, 2, 1, 3, 'AWAITING_PROVIDER', 'NO_REFILLS', 'HIGH',
 'Patient requests refill — all 3 authorized refills used. Awaiting provider renewal.',
 NOW() - INTERVAL '1 day'),

-- 3. PROVIDER_APPROVAL_REQUIRED — prior auth needed for biologic
(3, 3, 3, 1, 2, 'AWAITING_PROVIDER', 'PROVIDER_APPROVAL_REQUIRED', 'URGENT',
 'Prior authorization required for Humira (biologic). Insurance requires provider PA form.',
 NOW() - INTERVAL '3 days'),

-- 4. MISSING_INFORMATION — incomplete prescription
(4, 4, 4, 1, 3, 'ACTION_REQUIRED', 'MISSING_INFORMATION', 'HIGH',
 'Tramadol prescription is missing quantity and days supply. Cannot dispense.',
 NOW() - INTERVAL '4 hours'),

-- 5. INSURANCE_BLOCK — claim rejected by PBM
(5, 5, 5, 1, 3, 'AWAITING_INSURANCE', 'INSURANCE_BLOCK', 'HIGH',
 'Jardiance claim rejected by insurance — prior authorization required.',
 NOW() - INTERVAL '2 days'),

-- 6. PHARMACY_ISSUE — medication out of stock
(6, 6, 6, 2, 2, 'AWAITING_PHARMACY', 'PHARMACY_ISSUE', 'NORMAL',
 'Ozempic out of stock at West location. Awaiting supplier restock.',
 NOW() - INTERVAL '6 hours'),

-- 7. COMPLETED — resolved successfully (historical)
(7, 7, 7, 1, 3, 'COMPLETED', NULL, 'NORMAL',
 'Atorvastatin routine refill — resolved and dispensed.',
 NOW() - INTERVAL '4 days'),

-- 8. ESCALATED — complex Warfarin case pending clinical review
(8, 8, 8, 1, 2, 'ESCALATED', 'PROVIDER_APPROVAL_REQUIRED', 'URGENT',
 'Warfarin dosage adjustment pending INR results — escalated to senior provider.',
 NOW() - INTERVAL '5 days'),

-- 9. NEW_PRESCRIPTION_REQUIRED — Amlodipine prescription expired
(9, 9, 1, 1, 3, 'AWAITING_PROVIDER', 'NEW_PRESCRIPTION_REQUIRED', 'HIGH',
 'Amlodipine prescription expired 2025-01-01. New prescription required from provider.',
 NOW() - INTERVAL '1 day');

SELECT setval('refill_requests_id_seq', 100);

-- ── 4. Re-seed resolution cases ───────────────────────────────────────────────
-- assigned_to_user_id: 2 = sarah.chen, 3 = mike.johnson, 4 = dr.patel, 6 = lisa.martinez

INSERT INTO resolution_cases (id, refill_request_id, blocker_type, status, priority, assigned_to_user_id, reason, resolution_summary, created_at) VALUES

-- Case 1: NO_REFILLS (refill 2)
(1, 2, 'NO_REFILLS', 'WAITING_FOR_PROVIDER', 'HIGH', 6,
 'Prescription has used all 3 authorized refills. Provider must authorize additional refills or issue a new prescription.',
 NULL, NOW() - INTERVAL '1 day'),

-- Case 2: PROVIDER_APPROVAL_REQUIRED (refill 3)
(2, 3, 'PROVIDER_APPROVAL_REQUIRED', 'WAITING_FOR_PROVIDER', 'URGENT', 6,
 'Humira requires prior authorization. Insurance mandates provider PA submission before dispensing.',
 NULL, NOW() - INTERVAL '3 days'),

-- Case 3: MISSING_INFORMATION (refill 4)
(3, 4, 'MISSING_INFORMATION', 'IN_PROGRESS', 'HIGH', 6,
 'Quantity and days supply are missing from Tramadol prescription. Prescribing office contacted.',
 NULL, NOW() - INTERVAL '4 hours'),

-- Case 4: INSURANCE_BLOCK (refill 5)
(4, 5, 'INSURANCE_BLOCK', 'WAITING_FOR_INSURANCE', 'HIGH', 3,
 'Jardiance claim denied by PBM. Prior authorization form submitted; awaiting insurance decision.',
 NULL, NOW() - INTERVAL '2 days'),

-- Case 5: PHARMACY_ISSUE (refill 6)
(5, 6, 'PHARMACY_ISSUE', 'IN_PROGRESS', 'NORMAL', 2,
 'Ozempic inventory depleted at Valley Health Pharmacy - West. Supplier contacted.',
 NULL, NOW() - INTERVAL '6 hours'),

-- Case 6: RESOLVED (refill 7 — completed history)
(6, 7, 'NO_REFILLS', 'RESOLVED', 'NORMAL', 6,
 'Atorvastatin — all refills used. Provider authorization requested.',
 'Dr. Kim authorized 3 additional refills via phone on 09/24. Prescription updated and refill dispensed.',
 NOW() - INTERVAL '4 days'),

-- Case 7: ESCALATED (refill 8)
(7, 8, 'PROVIDER_APPROVAL_REQUIRED', 'ESCALATED', 'URGENT', 4,
 'Warfarin dosage adjustment requires urgent clinical review — INR result pending.',
 NULL, NOW() - INTERVAL '5 days'),

-- Case 8: NEW_PRESCRIPTION_REQUIRED (refill 9)
(8, 9, 'NEW_PRESCRIPTION_REQUIRED', 'WAITING_FOR_PROVIDER', 'HIGH', 6,
 'Amlodipine prescription expired 2025-01-01. Provider must issue a new prescription before refill can proceed.',
 NULL, NOW() - INTERVAL '1 day');

SELECT setval('resolution_cases_id_seq', 100);

-- ── 5. Re-seed resolution actions ────────────────────────────────────────────

INSERT INTO resolution_actions (id, resolution_case_id, action_type, assigned_role, assigned_user_id, status, description, completion_notes, due_at, completed_at, created_at) VALUES

-- Case 1 (NO_REFILLS)
(1, 1, 'REQUEST_PROVIDER_APPROVAL', 'PRACTICE_STAFF', 6, 'IN_PROGRESS',
 'Contact provider to authorize additional refills for this prescription.',
 NULL, NOW() + INTERVAL '1 day', NULL, NOW() - INTERVAL '1 day'),

-- Case 2 (PROVIDER_APPROVAL_REQUIRED)
(2, 2, 'REQUEST_PROVIDER_APPROVAL', 'PRACTICE_STAFF', 6, 'PENDING',
 'Send prior authorization request to provider for Humira review and sign-off.',
 NULL, NOW() + INTERVAL '2 days', NULL, NOW() - INTERVAL '3 days'),
(3, 2, 'PRIOR_AUTH_REQUEST', 'PHARMACY_STAFF', 3, 'IN_PROGRESS',
 'Submit prior authorization request to insurance/PBM for Humira coverage.',
 NULL, NOW() + INTERVAL '1 day', NULL, NOW() - INTERVAL '2 days'),

-- Case 3 (MISSING_INFORMATION)
(4, 3, 'REQUEST_MISSING_INFORMATION', 'PRACTICE_STAFF', 6, 'COMPLETED',
 'Obtain and complete the missing prescription information from prescribing office.',
 'Contacted prescribing office at Riverside Family Practice. Awaiting faxed correction.',
 NOW() - INTERVAL '1 day', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '4 hours'),
(5, 3, 'VERIFY_RESOLUTION', 'PHARMACIST', 2, 'PENDING',
 'Verify that the corrected prescription information has been received and is complete.',
 NULL, NOW() + INTERVAL '1 day', NULL, NOW() - INTERVAL '2 hours'),

-- Case 4 (INSURANCE_BLOCK)
(6, 4, 'VERIFY_INSURANCE', 'PHARMACY_STAFF', 3, 'IN_PROGRESS',
 'Contact PBM to resolve Jardiance claim rejection and submit PA if required.',
 NULL, NOW() + INTERVAL '3 days', NULL, NOW() - INTERVAL '2 days'),

-- Case 5 (PHARMACY_ISSUE)
(7, 5, 'CONTACT_PHARMACY', 'PHARMACIST', 2, 'COMPLETED',
 'Contact supplier to resolve Ozempic stock shortage at West location.',
 'Supplier confirmed restock expected within 2 business days.',
 NOW() - INTERVAL '3 hours', NOW() - INTERVAL '4 hours', NOW() - INTERVAL '6 hours'),

-- Case 6 (RESOLVED — historical)
(8, 6, 'REQUEST_PROVIDER_APPROVAL', 'PRACTICE_STAFF', 6, 'COMPLETED',
 'Contact provider to authorize additional refills for Atorvastatin.',
 'Dr. Kim authorized 3 additional refills via phone on 09/24.',
 NOW() - INTERVAL '3 days', NOW() - INTERVAL '4 days', NOW() - INTERVAL '5 days'),

-- Case 7 (ESCALATED)
(9, 7, 'REQUEST_PROVIDER_REVIEW', 'PROVIDER', 4, 'PENDING',
 'Provider clinical review required for Warfarin dosage adjustment based on INR results.',
 NULL, NOW() + INTERVAL '1 day', NULL, NOW() - INTERVAL '5 days'),
(10, 7, 'ESCALATE_CASE', 'PHARMACIST', 2, 'COMPLETED',
 'Escalate Warfarin case to senior pharmacist and provider for urgent clinical review.',
 'Escalated to Dr. Patel and senior pharmacist Sarah Chen.',
 NOW() - INTERVAL '4 days', NOW() - INTERVAL '4 days', NOW() - INTERVAL '5 days'),

-- Case 8 (NEW_PRESCRIPTION_REQUIRED)
(11, 8, 'REQUEST_NEW_PRESCRIPTION', 'PRACTICE_STAFF', 6, 'PENDING',
 'Request provider to issue a new prescription for Amlodipine 5mg.',
 NULL, NOW() + INTERVAL '2 days', NULL, NOW() - INTERVAL '1 day');

SELECT setval('resolution_actions_id_seq', 100);

-- ── 6. Re-seed audit trail (refill events) ────────────────────────────────────

INSERT INTO refill_events (refill_request_id, event_type, description, from_status, to_status, actor_user_id, actor_label, related_case_id, created_at) VALUES

-- Refill 1 (READY)
(1, 'REFILL_REQUESTED',    'Refill request submitted for Lisinopril 10mg', NULL, 'REQUESTED', 3, 'mike.johnson', NULL, NOW() - INTERVAL '2 hours'),
(1, 'REFILL_UNDER_REVIEW', 'Triage started — evaluating prescription eligibility and blockers', 'REQUESTED', 'UNDER_REVIEW', NULL, 'triage-engine', NULL, NOW() - INTERVAL '119 minutes'),
(1, 'REFILL_READY',        'No blockers detected — refill approved and ready to dispense', 'UNDER_REVIEW', 'READY', NULL, 'triage-engine', NULL, NOW() - INTERVAL '118 minutes'),

-- Refill 2 (AWAITING_PROVIDER — NO_REFILLS)
(2, 'REFILL_REQUESTED',    'Refill request submitted for Metformin 500mg', NULL, 'REQUESTED', 3, 'mike.johnson', NULL, NOW() - INTERVAL '1 day'),
(2, 'REFILL_UNDER_REVIEW', 'Triage started — evaluating prescription eligibility and blockers', 'REQUESTED', 'UNDER_REVIEW', NULL, 'triage-engine', NULL, NOW() - INTERVAL '23 hours 58 minutes'),
(2, 'BLOCKER_IDENTIFIED',  'Blocker identified: NO_REFILLS — prescription has 0 refills remaining', 'UNDER_REVIEW', 'AWAITING_PROVIDER', NULL, 'triage-engine', 1, NOW() - INTERVAL '23 hours 57 minutes'),
(2, 'CASE_CREATED',        'Resolution case #1 opened for blocker: NO_REFILLS', NULL, NULL, NULL, 'triage-engine', 1, NOW() - INTERVAL '23 hours 56 minutes'),
(2, 'ACTION_CREATED',      'Action created: REQUEST_PROVIDER_APPROVAL — awaiting provider authorization', NULL, NULL, 6, 'lisa.martinez', 1, NOW() - INTERVAL '23 hours 55 minutes'),

-- Refill 3 (AWAITING_PROVIDER — PROVIDER_APPROVAL_REQUIRED)
(3, 'REFILL_REQUESTED',    'Refill request submitted for Humira (adalimumab) 40mg', NULL, 'REQUESTED', 2, 'sarah.chen', NULL, NOW() - INTERVAL '3 days'),
(3, 'REFILL_UNDER_REVIEW', 'Triage started — evaluating prescription eligibility and blockers', 'REQUESTED', 'UNDER_REVIEW', NULL, 'triage-engine', NULL, NOW() - INTERVAL '3 days'),
(3, 'BLOCKER_IDENTIFIED',  'Blocker identified: PROVIDER_APPROVAL_REQUIRED — prior authorization needed for biologic', 'UNDER_REVIEW', 'AWAITING_PROVIDER', NULL, 'triage-engine', 2, NOW() - INTERVAL '3 days'),
(3, 'CASE_CREATED',        'Resolution case #2 opened for blocker: PROVIDER_APPROVAL_REQUIRED', NULL, NULL, NULL, 'triage-engine', 2, NOW() - INTERVAL '3 days'),

-- Refill 4 (ACTION_REQUIRED — MISSING_INFORMATION)
(4, 'REFILL_REQUESTED',    'Refill request submitted for Tramadol 50mg', NULL, 'REQUESTED', 3, 'mike.johnson', NULL, NOW() - INTERVAL '4 hours'),
(4, 'REFILL_UNDER_REVIEW', 'Triage started — evaluating prescription eligibility and blockers', 'REQUESTED', 'UNDER_REVIEW', NULL, 'triage-engine', NULL, NOW() - INTERVAL '239 minutes'),
(4, 'BLOCKER_IDENTIFIED',  'Blocker identified: MISSING_INFORMATION — quantity and days supply absent', 'UNDER_REVIEW', 'ACTION_REQUIRED', NULL, 'triage-engine', 3, NOW() - INTERVAL '238 minutes'),
(4, 'CASE_CREATED',        'Resolution case #3 opened for blocker: MISSING_INFORMATION', NULL, NULL, NULL, 'triage-engine', 3, NOW() - INTERVAL '237 minutes'),
(4, 'ACTION_COMPLETED',    'Prescribing office contacted — awaiting faxed corrected prescription', NULL, NULL, 6, 'lisa.martinez', 3, NOW() - INTERVAL '2 hours'),

-- Refill 5 (AWAITING_INSURANCE — INSURANCE_BLOCK)
(5, 'REFILL_REQUESTED',    'Refill request submitted for Jardiance 10mg', NULL, 'REQUESTED', 3, 'mike.johnson', NULL, NOW() - INTERVAL '2 days'),
(5, 'REFILL_UNDER_REVIEW', 'Triage started — evaluating prescription eligibility and blockers', 'REQUESTED', 'UNDER_REVIEW', NULL, 'triage-engine', NULL, NOW() - INTERVAL '2 days'),
(5, 'BLOCKER_IDENTIFIED',  'Blocker identified: INSURANCE_BLOCK — PBM rejected claim, PA required', 'UNDER_REVIEW', 'AWAITING_INSURANCE', NULL, 'triage-engine', 4, NOW() - INTERVAL '2 days'),
(5, 'CASE_CREATED',        'Resolution case #4 opened for blocker: INSURANCE_BLOCK', NULL, NULL, NULL, 'triage-engine', 4, NOW() - INTERVAL '2 days'),

-- Refill 6 (AWAITING_PHARMACY — PHARMACY_ISSUE)
(6, 'REFILL_REQUESTED',    'Refill request submitted for Ozempic (semaglutide) 0.5mg', NULL, 'REQUESTED', 2, 'sarah.chen', NULL, NOW() - INTERVAL '6 hours'),
(6, 'REFILL_UNDER_REVIEW', 'Triage started — evaluating prescription eligibility and blockers', 'REQUESTED', 'UNDER_REVIEW', NULL, 'triage-engine', NULL, NOW() - INTERVAL '359 minutes'),
(6, 'BLOCKER_IDENTIFIED',  'Blocker identified: PHARMACY_ISSUE — medication out of stock at requested pharmacy', 'UNDER_REVIEW', 'AWAITING_PHARMACY', NULL, 'triage-engine', 5, NOW() - INTERVAL '358 minutes'),
(6, 'CASE_CREATED',        'Resolution case #5 opened for blocker: PHARMACY_ISSUE', NULL, NULL, NULL, 'triage-engine', 5, NOW() - INTERVAL '357 minutes'),
(6, 'ACTION_COMPLETED',    'Supplier contacted — Ozempic restock expected within 2 business days', NULL, NULL, 2, 'sarah.chen', 5, NOW() - INTERVAL '3 hours'),

-- Refill 7 (COMPLETED — full history)
(7, 'REFILL_REQUESTED',    'Refill request submitted for Atorvastatin 40mg', NULL, 'REQUESTED', 3, 'mike.johnson', NULL, NOW() - INTERVAL '4 days'),
(7, 'REFILL_UNDER_REVIEW', 'Triage started — evaluating prescription eligibility and blockers', 'REQUESTED', 'UNDER_REVIEW', NULL, 'triage-engine', NULL, NOW() - INTERVAL '4 days'),
(7, 'BLOCKER_IDENTIFIED',  'Blocker identified: NO_REFILLS', 'UNDER_REVIEW', 'AWAITING_PROVIDER', NULL, 'triage-engine', 6, NOW() - INTERVAL '4 days'),
(7, 'CASE_CREATED',        'Resolution case #6 opened for blocker: NO_REFILLS', NULL, NULL, NULL, 'triage-engine', 6, NOW() - INTERVAL '4 days'),
(7, 'ACTION_COMPLETED',    'Provider Dr. Kim authorized 3 additional refills via phone', NULL, NULL, 6, 'lisa.martinez', 6, NOW() - INTERVAL '3 days 23 hours'),
(7, 'CASE_RESOLVED',       'Case resolved — Dr. Kim authorized 3 additional Atorvastatin refills', NULL, NULL, 6, 'lisa.martinez', 6, NOW() - INTERVAL '3 days 22 hours'),
(7, 'REFILL_READY',        'Blocker resolved — refill approved and ready to dispense', 'AWAITING_PROVIDER', 'READY', NULL, 'triage-engine', NULL, NOW() - INTERVAL '3 days 21 hours'),
(7, 'REFILL_COMPLETED',    'Refill dispensed and marked complete', 'READY', 'COMPLETED', 2, 'sarah.chen', NULL, NOW() - INTERVAL '3 days'),

-- Refill 8 (ESCALATED — Warfarin)
(8, 'REFILL_REQUESTED',    'Refill request submitted for Warfarin 5mg', NULL, 'REQUESTED', 2, 'sarah.chen', NULL, NOW() - INTERVAL '5 days'),
(8, 'REFILL_UNDER_REVIEW', 'Triage started — evaluating prescription eligibility and blockers', 'REQUESTED', 'UNDER_REVIEW', NULL, 'triage-engine', NULL, NOW() - INTERVAL '5 days'),
(8, 'BLOCKER_IDENTIFIED',  'Blocker identified: PROVIDER_APPROVAL_REQUIRED — complex clinical case', 'UNDER_REVIEW', 'AWAITING_PROVIDER', NULL, 'triage-engine', 7, NOW() - INTERVAL '5 days'),
(8, 'CASE_CREATED',        'Resolution case #7 opened for blocker: PROVIDER_APPROVAL_REQUIRED', NULL, NULL, NULL, 'triage-engine', 7, NOW() - INTERVAL '5 days'),
(8, 'CASE_ESCALATED',      'Warfarin dosage adjustment requires urgent clinical review — INR result pending', NULL, 'ESCALATED', 2, 'sarah.chen', 7, NOW() - INTERVAL '4 days'),
(8, 'REFILL_ESCALATED',    'Case escalated to Dr. Patel and senior pharmacist Sarah Chen', 'AWAITING_PROVIDER', 'ESCALATED', 2, 'sarah.chen', 7, NOW() - INTERVAL '4 days'),

-- Refill 9 (AWAITING_PROVIDER — NEW_PRESCRIPTION_REQUIRED)
(9, 'REFILL_REQUESTED',    'Refill request submitted for Amlodipine 5mg', NULL, 'REQUESTED', 3, 'mike.johnson', NULL, NOW() - INTERVAL '1 day'),
(9, 'REFILL_UNDER_REVIEW', 'Triage started — evaluating prescription eligibility and blockers', 'REQUESTED', 'UNDER_REVIEW', NULL, 'triage-engine', NULL, NOW() - INTERVAL '23 hours 58 minutes'),
(9, 'BLOCKER_IDENTIFIED',  'Blocker identified: NEW_PRESCRIPTION_REQUIRED — prescription expired 2025-01-01', 'UNDER_REVIEW', 'AWAITING_PROVIDER', NULL, 'triage-engine', 8, NOW() - INTERVAL '23 hours 57 minutes'),
(9, 'CASE_CREATED',        'Resolution case #8 opened for blocker: NEW_PRESCRIPTION_REQUIRED', NULL, NULL, NULL, 'triage-engine', 8, NOW() - INTERVAL '23 hours 56 minutes');
