-- V11: ML model versioning, predictions, and extended risk assessments
-- These tables support the Python ML service integration (Milestone 11).

-- ── ml_model_versions ────────────────────────────────────────────────────
-- Tracks every trained model artefact.  Populated by the Python training
-- pipeline writing metadata.pkl, then registered by Spring Boot at startup.
CREATE TABLE ml_model_versions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_version       VARCHAR(100) NOT NULL,          -- e.g. "xgboost-v1"
    algorithm           VARCHAR(50)  NOT NULL,          -- "XGBoost", "LogisticRegression"
    feature_version     VARCHAR(20)  NOT NULL,          -- e.g. "1.0"
    dataset_version     VARCHAR(100),                   -- e.g. "ieee-cis-v1" or "synthetic-v1"
    hyperparameters     JSONB,                          -- key/value map of XGBoost params
    val_precision       DOUBLE PRECISION,
    val_recall          DOUBLE PRECISION,
    val_f1              DOUBLE PRECISION,
    val_auprc           DOUBLE PRECISION,
    val_roc_auc         DOUBLE PRECISION,
    val_fpr             DOUBLE PRECISION,
    val_expected_loss   DOUBLE PRECISION,
    threshold           DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    is_active           BOOLEAN NOT NULL DEFAULT FALSE, -- only one active at a time
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── ml_predictions ───────────────────────────────────────────────────────
-- One row per ML scoring call.  Provides a full audit trail of every
-- ML-generated risk decision alongside its model version and features.
-- NEVER used as training data without explicit analyst labelling.
CREATE TABLE ml_predictions (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id             UUID NOT NULL,
    customer_id             UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    model_version_id        UUID REFERENCES ml_model_versions(id) ON DELETE SET NULL,
    fraud_probability       DOUBLE PRECISION NOT NULL,  -- calibrated [0, 1]
    anomaly_score           DOUBLE PRECISION NOT NULL,  -- normalised IF score [0, 1]
    risk_score              INT NOT NULL,               -- aggregated 0–100
    risk_level              VARCHAR(10) NOT NULL,       -- LOW/MEDIUM/HIGH/CRITICAL
    threshold               DOUBLE PRECISION NOT NULL,  -- frozen val threshold used
    feature_contributions   JSONB,                     -- SHAP top contributors
    processing_ms           INT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ml_predictions_merchant_customer
    ON ml_predictions (merchant_id, customer_id);
CREATE INDEX idx_ml_predictions_created_at
    ON ml_predictions (created_at DESC);

-- ── Extended risk_assessments ────────────────────────────────────────────
-- Add ML-specific columns to the existing risk_assessments table.
-- NULLable so existing rows remain valid (ML is opt-in via config flag).
ALTER TABLE risk_assessments
    ADD COLUMN IF NOT EXISTS fraud_probability  DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS anomaly_score       DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS model_version       VARCHAR(100),
    ADD COLUMN IF NOT EXISTS feature_version     VARCHAR(20),
    ADD COLUMN IF NOT EXISTS ml_prediction_id   UUID REFERENCES ml_predictions(id) ON DELETE SET NULL;

COMMENT ON COLUMN risk_assessments.fraud_probability IS
    'Calibrated XGBoost fraud probability [0,1]. NULL when ML service disabled.';
COMMENT ON COLUMN risk_assessments.anomaly_score IS
    'Normalised Isolation Forest anomaly score [0,1]. NULL when ML service disabled.';
COMMENT ON COLUMN risk_assessments.model_version IS
    'ML model version string used to produce this assessment. NULL when ML service disabled.';

-- ── Threshold evaluation history ─────────────────────────────────────────
-- Records threshold sweep results from training. Used by the frontend
-- to display the threshold vs expected-loss curve.
CREATE TABLE threshold_evaluations (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_version_id    UUID REFERENCES ml_model_versions(id) ON DELETE CASCADE,
    threshold           DOUBLE PRECISION NOT NULL,
    precision_score     DOUBLE PRECISION,
    recall_score        DOUBLE PRECISION,
    f1_score            DOUBLE PRECISION,
    fpr                 DOUBLE PRECISION,
    expected_loss       DOUBLE PRECISION,
    fp_cost             DOUBLE PRECISION,
    fn_cost             DOUBLE PRECISION,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
