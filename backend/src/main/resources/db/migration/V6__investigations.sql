-- =============================================================
-- V6: Investigations + Investigation Notes
-- =============================================================

CREATE TABLE investigations (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id  UUID        NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    subject_type VARCHAR(20) NOT NULL,
    subject_id   UUID        NOT NULL,
    risk_level   VARCHAR(10) NOT NULL,
    status       VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    assigned_to  UUID,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_investigations_merchant        ON investigations (merchant_id);
CREATE INDEX idx_investigations_status          ON investigations (merchant_id, status);
CREATE INDEX idx_investigations_subject         ON investigations (merchant_id, subject_type, subject_id);
CREATE INDEX idx_investigations_risk_level      ON investigations (merchant_id, risk_level);
CREATE INDEX idx_investigations_created_at      ON investigations (merchant_id, created_at DESC);

CREATE TABLE investigation_notes (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    investigation_id  UUID        NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
    author_id         UUID        NOT NULL,
    content           VARCHAR(2000) NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_investigation_notes_inv ON investigation_notes (investigation_id);
