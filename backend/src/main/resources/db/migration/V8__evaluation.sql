-- =============================================================
-- V8: Evaluation Runs
-- NOTE: false_positive_cost is based on configurable prototype assumptions.
--       It does not represent real merchant loss.
-- =============================================================

CREATE TABLE evaluation_runs (
    id                   UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id          UUID           NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    dataset_run_id       UUID           REFERENCES dataset_runs(id),
    evaluated_at         TIMESTAMPTZ,
    sample_count         INTEGER        NOT NULL DEFAULT 0,
    true_positive        INTEGER        NOT NULL DEFAULT 0,
    true_negative        INTEGER        NOT NULL DEFAULT 0,
    false_positive       INTEGER        NOT NULL DEFAULT 0,
    false_negative       INTEGER        NOT NULL DEFAULT 0,
    precision_score      DOUBLE PRECISION,
    recall_score         DOUBLE PRECISION,
    f1_score             DOUBLE PRECISION,
    false_positive_rate  DOUBLE PRECISION,
    false_negative_rate  DOUBLE PRECISION,
    false_positive_cost  DOUBLE PRECISION,
    created_at           TIMESTAMPTZ    NOT NULL DEFAULT now()
);

CREATE INDEX idx_eval_runs_merchant    ON evaluation_runs (merchant_id);
CREATE INDEX idx_eval_runs_dataset     ON evaluation_runs (dataset_run_id);
CREATE INDEX idx_eval_runs_created_at  ON evaluation_runs (merchant_id, created_at DESC);
