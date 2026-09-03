-- =============================================================
-- V4: Risk Assessments + Risk Signals
-- =============================================================

CREATE TABLE risk_assessments (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id  UUID        NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    customer_id  UUID        NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    risk_score   INTEGER     NOT NULL DEFAULT 0,
    risk_level   VARCHAR(10) NOT NULL DEFAULT 'LOW',
    signal_count INTEGER     NOT NULL DEFAULT 0,
    flagged      BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_risk_assessments_merchant     ON risk_assessments (merchant_id);
CREATE INDEX idx_risk_assessments_customer     ON risk_assessments (merchant_id, customer_id);
CREATE INDEX idx_risk_assessments_risk_level   ON risk_assessments (merchant_id, risk_level);
CREATE INDEX idx_risk_assessments_flagged      ON risk_assessments (merchant_id, flagged);
CREATE INDEX idx_risk_assessments_created_at   ON risk_assessments (merchant_id, created_at DESC);

CREATE TABLE risk_signals (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id     UUID        NOT NULL REFERENCES risk_assessments(id) ON DELETE CASCADE,
    merchant_id       UUID        NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    signal_type       VARCHAR(30) NOT NULL,
    observed_value    DOUBLE PRECISION,
    baseline_value    DOUBLE PRECISION,
    score_contribution INTEGER    NOT NULL DEFAULT 0,
    severity          VARCHAR(10) NOT NULL,
    explanation       VARCHAR(500),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_risk_signals_assessment ON risk_signals (assessment_id);
CREATE INDEX idx_risk_signals_merchant   ON risk_signals (merchant_id);
CREATE INDEX idx_risk_signals_type       ON risk_signals (signal_type);
