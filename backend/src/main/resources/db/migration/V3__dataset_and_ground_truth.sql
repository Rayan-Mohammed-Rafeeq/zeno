-- =============================================================
-- V3: Dataset Runs + Ground Truth Labels
-- =============================================================

-- Dataset runs — tracks each synthetic generation event
CREATE TABLE dataset_runs (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id  UUID        NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    record_count INTEGER     NOT NULL,
    seed         BIGINT      NOT NULL,
    status       VARCHAR(20) NOT NULL DEFAULT 'GENERATING',
    generated_at TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dataset_runs_merchant_id ON dataset_runs (merchant_id, created_at DESC);

-- Ground truth labels — hidden from detector, used only for evaluation
-- WARNING: Do NOT expose these to any risk scoring or ML inference path.
CREATE TABLE ground_truth_labels (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset_run_id  UUID        NOT NULL REFERENCES dataset_runs(id) ON DELETE CASCADE,
    merchant_id     UUID        NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    entity_type     VARCHAR(20) NOT NULL,  -- CUSTOMER, PAYMENT, etc.
    entity_id       UUID        NOT NULL,
    positive        BOOLEAN     NOT NULL,  -- TRUE = known abuse case
    abuse_cluster_id VARCHAR(50),
    scenario_type   VARCHAR(50)
);

CREATE INDEX idx_gtl_dataset_run  ON ground_truth_labels (dataset_run_id);
CREATE INDEX idx_gtl_entity       ON ground_truth_labels (entity_type, entity_id);
CREATE INDEX idx_gtl_merchant     ON ground_truth_labels (merchant_id);
CREATE INDEX idx_gtl_positive     ON ground_truth_labels (dataset_run_id, positive);
