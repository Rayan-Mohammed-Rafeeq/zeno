-- =============================================================
-- V2: Customer, Payment, Refund
-- =============================================================

-- Customers (synthetic, no real PII)
CREATE TABLE customers (
    id                      UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id             UUID         NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    external_customer_id    VARCHAR(100) NOT NULL,
    account_age_days        INTEGER,
    status                  VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
    country                 CHAR(2),
    region                  VARCHAR(50),
    synthetic_profile_type  VARCHAR(50),
    created_at              TIMESTAMPTZ  NOT NULL DEFAULT now(),
    UNIQUE (merchant_id, external_customer_id)
);

CREATE INDEX idx_customers_merchant_id ON customers (merchant_id);
CREATE INDEX idx_customers_status      ON customers (merchant_id, status);

-- Payments (synthetic transaction activity)
CREATE TABLE payments (
    id                  UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id         UUID           NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    customer_id         UUID           NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    external_payment_id VARCHAR(100),
    amount              NUMERIC(18, 2) NOT NULL,
    currency            CHAR(3)        NOT NULL,
    timestamp           TIMESTAMPTZ    NOT NULL,
    status              VARCHAR(30)    NOT NULL,
    payment_method      VARCHAR(20)    NOT NULL,
    device_id           VARCHAR(100),
    ip_address          VARCHAR(45),
    address_fingerprint VARCHAR(100),
    created_at          TIMESTAMPTZ    NOT NULL DEFAULT now()
);

CREATE INDEX idx_payments_merchant_id  ON payments (merchant_id);
CREATE INDEX idx_payments_customer_id  ON payments (customer_id);
CREATE INDEX idx_payments_device_id    ON payments (merchant_id, device_id);
CREATE INDEX idx_payments_ip_address   ON payments (merchant_id, ip_address);
CREATE INDEX idx_payments_timestamp    ON payments (merchant_id, timestamp DESC);
CREATE INDEX idx_payments_status       ON payments (merchant_id, status);

-- Refunds
CREATE TABLE refunds (
    id           UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id  UUID           NOT NULL REFERENCES merchants(id)  ON DELETE CASCADE,
    payment_id   UUID           NOT NULL REFERENCES payments(id)   ON DELETE CASCADE,
    customer_id  UUID           NOT NULL REFERENCES customers(id)  ON DELETE CASCADE,
    amount       NUMERIC(18, 2) NOT NULL,
    reason       VARCHAR(30)    NOT NULL,
    status       VARCHAR(20)    NOT NULL DEFAULT 'PENDING',
    requested_at TIMESTAMPTZ    NOT NULL,
    completed_at TIMESTAMPTZ,
    created_at   TIMESTAMPTZ    NOT NULL DEFAULT now()
);

CREATE INDEX idx_refunds_merchant_id  ON refunds (merchant_id);
CREATE INDEX idx_refunds_customer_id  ON refunds (merchant_id, customer_id);
CREATE INDEX idx_refunds_payment_id   ON refunds (payment_id);
CREATE INDEX idx_refunds_status       ON refunds (merchant_id, status);
