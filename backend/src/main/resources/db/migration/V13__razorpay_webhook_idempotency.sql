-- =============================================================
-- V13: Razorpay webhook idempotency + webhook event audit log
--
-- 1. Unique constraint on payments.external_payment_id
--    Prevents duplicate payment ingestion on Razorpay retries.
--    The column already exists (nullable); we add a partial unique
--    index that only applies when the value is NOT NULL so existing
--    synthetic rows with NULL are unaffected.
--
-- 2. external_refund_id on refunds
--    Stores the Razorpay refund ID (rfnd_xxx) for idempotency.
--    Same partial-unique pattern.
--
-- 3. webhook_events audit table
--    Immutable append-only log of every received Razorpay event.
--    Allows idempotency checks, replay, and audit trail.
-- =============================================================

-- 1. Partial unique index on payments.external_payment_id (NOT NULL rows only)
CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_external_payment_id
    ON payments (merchant_id, external_payment_id)
    WHERE external_payment_id IS NOT NULL;

-- 2. Add external_refund_id to refunds (nullable — synthetic data has none)
ALTER TABLE refunds
    ADD COLUMN IF NOT EXISTS external_refund_id VARCHAR(64);

CREATE UNIQUE INDEX IF NOT EXISTS uq_refunds_external_refund_id
    ON refunds (merchant_id, external_refund_id)
    WHERE external_refund_id IS NOT NULL;

-- 3. Webhook event audit log
CREATE TABLE IF NOT EXISTS webhook_events (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id     UUID        NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    -- The Razorpay event ID from X-Razorpay-Event-Id header (used for dedup)
    razorpay_event_id VARCHAR(64) NOT NULL,
    -- Event type string e.g. "payment.captured", "refund.created"
    event_type      VARCHAR(64) NOT NULL,
    -- Raw payload stored for audit / replay
    raw_payload     JSONB       NOT NULL,
    -- Processing outcome
    status          VARCHAR(20) NOT NULL DEFAULT 'RECEIVED',
    -- Internal entity IDs created from this event (nullable until processed)
    payment_id      UUID        REFERENCES payments(id) ON DELETE SET NULL,
    refund_id       UUID        REFERENCES refunds(id)  ON DELETE SET NULL,
    -- Risk assessment triggered
    risk_score      INTEGER,
    risk_level      VARCHAR(10),
    -- Error details if processing failed
    error_message   TEXT,
    -- Source label for UI clarity
    source          VARCHAR(20) NOT NULL DEFAULT 'RAZORPAY_TEST',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_webhook_events_razorpay_event_id
    ON webhook_events (merchant_id, razorpay_event_id);

CREATE INDEX IF NOT EXISTS idx_webhook_events_merchant
    ON webhook_events (merchant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_webhook_events_event_type
    ON webhook_events (merchant_id, event_type, created_at DESC);

COMMENT ON TABLE webhook_events IS
    'Immutable audit log of Razorpay Test Mode webhook events. '
    'Used for idempotency, replay, and live transaction monitoring UI. '
    'source=RAZORPAY_TEST on all rows — never claim these represent production performance.';
