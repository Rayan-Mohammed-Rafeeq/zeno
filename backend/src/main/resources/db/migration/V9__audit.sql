-- =============================================================
-- V9: Audit Events
-- Immutable append-only audit trail. No deletes, no updates.
-- =============================================================

CREATE TABLE audit_events (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id  UUID        REFERENCES merchants(id) ON DELETE SET NULL,
    actor_type   VARCHAR(20),
    actor_id     UUID,
    event_type   VARCHAR(50) NOT NULL,
    entity_type  VARCHAR(30),
    entity_id    UUID,
    metadata     JSONB,
    timestamp    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_merchant      ON audit_events (merchant_id, timestamp DESC);
CREATE INDEX idx_audit_event_type    ON audit_events (merchant_id, event_type);
CREATE INDEX idx_audit_entity        ON audit_events (entity_type, entity_id);
CREATE INDEX idx_audit_actor         ON audit_events (actor_id);
CREATE INDEX idx_audit_timestamp     ON audit_events (timestamp DESC);
