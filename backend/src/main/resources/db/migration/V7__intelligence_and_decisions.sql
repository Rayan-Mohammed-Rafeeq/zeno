-- =============================================================
-- V7: AI Assessments + Decision Recommendations
-- =============================================================

CREATE TABLE ai_assessments (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id       UUID        NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    subject_type      VARCHAR(20),
    subject_id        UUID,
    assessment_type   VARCHAR(50),
    confidence        DOUBLE PRECISION,
    reasons           JSONB,
    recommended_action VARCHAR(30),
    provider          VARCHAR(30),
    prompt_summary    VARCHAR(500),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_assessments_merchant   ON ai_assessments (merchant_id);
CREATE INDEX idx_ai_assessments_subject    ON ai_assessments (merchant_id, subject_id);
CREATE INDEX idx_ai_assessments_created_at ON ai_assessments (merchant_id, created_at DESC);

CREATE TABLE decision_recommendations (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id     UUID        NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    subject_type    VARCHAR(20),
    subject_id      UUID        NOT NULL,
    risk_level      VARCHAR(10) NOT NULL,
    risk_score      INTEGER     NOT NULL DEFAULT 0,
    decision        VARCHAR(20) NOT NULL,
    rationale       VARCHAR(500),
    overridden      BOOLEAN     NOT NULL DEFAULT FALSE,
    override_reason VARCHAR(200),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_decisions_merchant    ON decision_recommendations (merchant_id);
CREATE INDEX idx_decisions_subject     ON decision_recommendations (merchant_id, subject_id);
CREATE INDEX idx_decisions_decision    ON decision_recommendations (merchant_id, decision);
CREATE INDEX idx_decisions_created_at  ON decision_recommendations (merchant_id, created_at DESC);
