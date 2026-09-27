-- ─────────────────────────────────────────────────────────────────────────────
-- V1__initial_schema.sql
-- Zeno Prescription Refill Resolution Platform
-- Initial schema migration
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Organizations ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS organizations (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    type        VARCHAR(50)  NOT NULL CHECK (type IN ('PHARMACY', 'PRACTICE')),
    status      VARCHAR(50)  NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED')),
    address     TEXT,
    phone       VARCHAR(50),
    email       VARCHAR(255),
    npi_number  VARCHAR(50),
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_org_type   ON organizations(type);
CREATE INDEX idx_org_status ON organizations(status);

-- ── Users ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id               BIGSERIAL    PRIMARY KEY,
    username         VARCHAR(100) NOT NULL UNIQUE,
    password         VARCHAR(255) NOT NULL,
    role             VARCHAR(50)  NOT NULL CHECK (role IN ('ADMIN', 'PHARMACIST', 'PHARMACY_STAFF', 'PROVIDER', 'PRACTICE_STAFF')),
    first_name       VARCHAR(100),
    last_name        VARCHAR(100),
    email            VARCHAR(255) UNIQUE,
    is_active        BOOLEAN      NOT NULL DEFAULT TRUE,
    organization_id  BIGINT       REFERENCES organizations(id) ON DELETE SET NULL,
    created_at       TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_username ON users(username);
CREATE INDEX idx_user_org      ON users(organization_id);
CREATE INDEX idx_user_role     ON users(role);

-- ── Patients ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS patients (
    id               BIGSERIAL    PRIMARY KEY,
    first_name       VARCHAR(100) NOT NULL,
    last_name        VARCHAR(100) NOT NULL,
    date_of_birth    DATE,
    email            VARCHAR(255) UNIQUE,
    phone_number     VARCHAR(50),
    mrn              VARCHAR(100) UNIQUE,
    organization_id  BIGINT       REFERENCES organizations(id) ON DELETE SET NULL,
    created_at       TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_patient_org ON patients(organization_id);
CREATE INDEX idx_patient_mrn ON patients(mrn);

-- ── Providers ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS providers (
    id               BIGSERIAL    PRIMARY KEY,
    first_name       VARCHAR(100) NOT NULL,
    last_name        VARCHAR(100) NOT NULL,
    npi              VARCHAR(20)  UNIQUE,
    specialty        VARCHAR(100),
    email            VARCHAR(255),
    phone_number     VARCHAR(50),
    status           VARCHAR(50)  NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'ON_LEAVE')),
    organization_id  BIGINT       REFERENCES organizations(id) ON DELETE SET NULL,
    created_at       TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_provider_org ON providers(organization_id);
CREATE INDEX idx_provider_npi ON providers(npi);

-- ── Pharmacies ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pharmacies (
    id               BIGSERIAL    PRIMARY KEY,
    name             VARCHAR(255) NOT NULL,
    ncpdp_id         VARCHAR(20)  UNIQUE,
    address          TEXT,
    phone            VARCHAR(50),
    fax              VARCHAR(50),
    email            VARCHAR(255),
    status           VARCHAR(50)  NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    organization_id  BIGINT       REFERENCES organizations(id) ON DELETE SET NULL,
    created_at       TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pharmacy_org   ON pharmacies(organization_id);
CREATE INDEX idx_pharmacy_ncpdp ON pharmacies(ncpdp_id);

-- ── Prescriptions ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prescriptions (
    id                   BIGSERIAL    PRIMARY KEY,
    patient_id           BIGINT       NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
    provider_id          BIGINT       NOT NULL REFERENCES providers(id) ON DELETE RESTRICT,
    pharmacy_id          BIGINT       REFERENCES pharmacies(id) ON DELETE SET NULL,
    medication_name      VARCHAR(255) NOT NULL,
    medication_strength  VARCHAR(100),
    dosage_form          VARCHAR(100),
    instructions         TEXT,
    quantity_dispensed   INT,
    days_supply          INT,
    refills_allowed      INT          NOT NULL DEFAULT 0,
    refills_used         INT          NOT NULL DEFAULT 0,
    written_date         DATE,
    expiry_date          DATE,
    status               VARCHAR(50)  NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'EXPIRED', 'CANCELLED', 'OUT_OF_REFILLS', 'TRANSFERRED', 'ON_HOLD')),
    dea_schedule         VARCHAR(10),
    rx_number            VARCHAR(100),
    requires_prior_auth  BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at           TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_prescription_patient  ON prescriptions(patient_id);
CREATE INDEX idx_prescription_provider ON prescriptions(provider_id);
CREATE INDEX idx_prescription_status   ON prescriptions(status);

-- ── Refill Requests ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS refill_requests (
    id                  BIGSERIAL   PRIMARY KEY,
    prescription_id     BIGINT      NOT NULL REFERENCES prescriptions(id) ON DELETE RESTRICT,
    patient_id          BIGINT      NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
    pharmacy_id         BIGINT      NOT NULL REFERENCES pharmacies(id) ON DELETE RESTRICT,
    requested_by_user_id BIGINT     REFERENCES users(id) ON DELETE SET NULL,
    status              VARCHAR(50) NOT NULL DEFAULT 'REQUESTED' CHECK (status IN (
        'REQUESTED', 'UNDER_REVIEW', 'BLOCKED', 'ACTION_REQUIRED',
        'AWAITING_PROVIDER', 'AWAITING_PRACTICE', 'AWAITING_PHARMACY',
        'AWAITING_INSURANCE', 'READY', 'COMPLETED', 'CANCELLED', 'ESCALATED'
    )),
    blocker_type        VARCHAR(50) CHECK (blocker_type IN (
        'NO_REFILLS', 'PROVIDER_APPROVAL_REQUIRED', 'NEW_PRESCRIPTION_REQUIRED',
        'VISIT_REQUIRED', 'MISSING_INFORMATION', 'INSURANCE_BLOCK', 'PHARMACY_ISSUE', 'OTHER'
    )),
    priority            VARCHAR(20) NOT NULL DEFAULT 'NORMAL' CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
    notes               TEXT,
    resolved_at         TIMESTAMP,
    created_at          TIMESTAMP   NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_refill_status       ON refill_requests(status);
CREATE INDEX idx_refill_prescription ON refill_requests(prescription_id);
CREATE INDEX idx_refill_patient      ON refill_requests(patient_id);
CREATE INDEX idx_refill_pharmacy     ON refill_requests(pharmacy_id);
CREATE INDEX idx_refill_blocker      ON refill_requests(blocker_type);
CREATE INDEX idx_refill_priority     ON refill_requests(priority);
CREATE INDEX idx_refill_created_at   ON refill_requests(created_at);

-- ── Resolution Cases ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS resolution_cases (
    id                    BIGSERIAL   PRIMARY KEY,
    refill_request_id     BIGINT      NOT NULL UNIQUE REFERENCES refill_requests(id) ON DELETE CASCADE,
    blocker_type          VARCHAR(50) NOT NULL,
    status                VARCHAR(50) NOT NULL DEFAULT 'OPEN' CHECK (status IN (
        'OPEN', 'IN_PROGRESS', 'WAITING_FOR_INFORMATION', 'WAITING_FOR_PROVIDER',
        'WAITING_FOR_PHARMACY', 'WAITING_FOR_INSURANCE', 'PENDING_VERIFICATION',
        'RESOLVED', 'ESCALATED', 'CANCELLED'
    )),
    priority              VARCHAR(20) NOT NULL DEFAULT 'NORMAL' CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
    assigned_to_user_id   BIGINT      REFERENCES users(id) ON DELETE SET NULL,
    reason                TEXT,
    resolution_summary    TEXT,
    ai_recommendation     TEXT,
    resolved_at           TIMESTAMP,
    created_at            TIMESTAMP   NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMP   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_resolution_status   ON resolution_cases(status);
CREATE INDEX idx_resolution_refill   ON resolution_cases(refill_request_id);
CREATE INDEX idx_resolution_blocker  ON resolution_cases(blocker_type);
CREATE INDEX idx_resolution_assigned ON resolution_cases(assigned_to_user_id);
CREATE INDEX idx_resolution_priority ON resolution_cases(priority);

-- ── Resolution Actions ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS resolution_actions (
    id                   BIGSERIAL    PRIMARY KEY,
    resolution_case_id   BIGINT       NOT NULL REFERENCES resolution_cases(id) ON DELETE CASCADE,
    action_type          VARCHAR(50)  NOT NULL CHECK (action_type IN (
        'REQUEST_PROVIDER_REVIEW', 'REQUEST_MISSING_INFORMATION', 'CONTACT_PHARMACY',
        'VERIFY_INSURANCE', 'REQUEST_NEW_PRESCRIPTION', 'REQUEST_PROVIDER_APPROVAL',
        'FOLLOW_UP_WITH_PRACTICE', 'VERIFY_RESOLUTION', 'ESCALATE_CASE',
        'CONTACT_PATIENT', 'PRIOR_AUTH_REQUEST', 'OTHER'
    )),
    assigned_role        VARCHAR(50),
    assigned_user_id     BIGINT       REFERENCES users(id) ON DELETE SET NULL,
    status               VARCHAR(50)  NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
    description          TEXT,
    completion_notes     TEXT,
    due_at               TIMESTAMP,
    completed_at         TIMESTAMP,
    completed_by_user_id BIGINT       REFERENCES users(id) ON DELETE SET NULL,
    created_at           TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_action_case          ON resolution_actions(resolution_case_id);
CREATE INDEX idx_action_status        ON resolution_actions(status);
CREATE INDEX idx_action_assigned_user ON resolution_actions(assigned_user_id);
CREATE INDEX idx_action_due_at        ON resolution_actions(due_at);

-- ── Refill Events (Audit Log) ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS refill_events (
    id                  BIGSERIAL   PRIMARY KEY,
    refill_request_id   BIGINT      NOT NULL REFERENCES refill_requests(id) ON DELETE CASCADE,
    event_type          VARCHAR(80) NOT NULL,
    description         TEXT,
    from_status         VARCHAR(50),
    to_status           VARCHAR(50),
    actor_user_id       BIGINT      REFERENCES users(id) ON DELETE SET NULL,
    actor_label         VARCHAR(100),
    related_case_id     BIGINT,
    related_action_id   BIGINT,
    created_at          TIMESTAMP   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_event_refill     ON refill_events(refill_request_id);
CREATE INDEX idx_event_type       ON refill_events(event_type);
CREATE INDEX idx_event_created_at ON refill_events(created_at);
