-- =============================================================
-- V10: Add role column to users table
-- =============================================================

ALTER TABLE users
    ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'ANALYST';

-- The very first user (earliest created_at) is promoted to ADMIN.
-- All subsequent existing users keep ANALYST.
UPDATE users
SET role = 'ADMIN'
WHERE id = (
    SELECT id FROM users ORDER BY created_at ASC LIMIT 1
);

CREATE INDEX idx_users_role ON users (role);
