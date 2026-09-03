-- =============================================================
-- V5: Risk Clusters + Cluster Members
-- =============================================================

CREATE TABLE risk_clusters (
    id                  UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id         UUID           NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    risk_score          INTEGER        NOT NULL DEFAULT 0,
    risk_level          VARCHAR(10)    NOT NULL DEFAULT 'LOW',
    member_count        INTEGER        NOT NULL DEFAULT 0,
    estimated_exposure  NUMERIC(18, 2),
    status              VARCHAR(20)    NOT NULL DEFAULT 'ACTIVE',
    created_at          TIMESTAMPTZ    NOT NULL DEFAULT now()
);

CREATE INDEX idx_risk_clusters_merchant    ON risk_clusters (merchant_id);
CREATE INDEX idx_risk_clusters_risk_level  ON risk_clusters (merchant_id, risk_level);
CREATE INDEX idx_risk_clusters_status      ON risk_clusters (merchant_id, status);
CREATE INDEX idx_risk_clusters_created_at  ON risk_clusters (merchant_id, created_at DESC);

CREATE TABLE cluster_members (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    cluster_id   UUID        NOT NULL REFERENCES risk_clusters(id) ON DELETE CASCADE,
    entity_type  VARCHAR(20) NOT NULL,
    entity_id    UUID        NOT NULL,
    UNIQUE (cluster_id, entity_type, entity_id)
);

CREATE INDEX idx_cluster_members_cluster    ON cluster_members (cluster_id);
CREATE INDEX idx_cluster_members_entity     ON cluster_members (entity_type, entity_id);
