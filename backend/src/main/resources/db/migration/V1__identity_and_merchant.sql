-- =============================================================
-- V1: Identity + Merchant
-- =============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users
CREATE TABLE users (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(100) NOT NULL,
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    email_verified  BOOLEAN     NOT NULL DEFAULT FALSE,
    status          VARCHAR(30)  NOT NULL DEFAULT 'PENDING_VERIFICATION',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_email ON users (email);
CREATE INDEX idx_users_status ON users (status);

-- Email verification tokens (store only SHA-256 hashes)
CREATE TABLE email_verification_tokens (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  VARCHAR(64) NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ
);

CREATE INDEX idx_evt_user_id    ON email_verification_tokens (user_id);
CREATE INDEX idx_evt_token_hash ON email_verification_tokens (token_hash);

-- Password reset tokens (store only SHA-256 hashes)
CREATE TABLE password_reset_tokens (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  VARCHAR(64) NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ
);

CREATE INDEX idx_prt_user_id    ON password_reset_tokens (user_id);
CREATE INDEX idx_prt_token_hash ON password_reset_tokens (token_hash);

-- Merchants
CREATE TABLE merchants (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name       VARCHAR(100) NOT NULL,
    slug       VARCHAR(120) NOT NULL UNIQUE,
    status     VARCHAR(30)  NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_merchants_slug   ON merchants (slug);
CREATE INDEX idx_merchants_status ON merchants (status);

-- User ↔ Merchant association (one user → one merchant for now)
CREATE TABLE merchant_users (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID        NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    user_id     UUID        NOT NULL REFERENCES users(id)     ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (merchant_id, user_id)
);

CREATE INDEX idx_merchant_users_user_id     ON merchant_users (user_id);
CREATE INDEX idx_merchant_users_merchant_id ON merchant_users (merchant_id);
