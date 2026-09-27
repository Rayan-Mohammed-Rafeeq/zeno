-- Dedicated role-based demo logins. All records and identities are fictional.
-- Password: password123 (same repaired BCrypt hash used by the original demo accounts).
INSERT INTO users (username, password, role, first_name, last_name, email, is_active, organization_id) VALUES
    ('demo.pharmacist', '$2b$10$9VjhRVX.xbp7r7f6PaEe3uXmCoSZyQo9SgXWcPJPeTmxqc2dUQnM.', 'PHARMACIST', 'Demo', 'Pharmacist', 'demo.pharmacist@valleypharmacy.example', TRUE, 1),
    ('demo.staff',      '$2b$10$9VjhRVX.xbp7r7f6PaEe3uXmCoSZyQo9SgXWcPJPeTmxqc2dUQnM.', 'PRACTICE_STAFF', 'Demo', 'Practice Staff', 'demo.staff@riversidepractice.example', TRUE, 2),
    ('demo.provider',   '$2b$10$9VjhRVX.xbp7r7f6PaEe3uXmCoSZyQo9SgXWcPJPeTmxqc2dUQnM.', 'PROVIDER', 'Demo', 'Provider', 'demo.provider@riversidepractice.example', TRUE, 2)
ON CONFLICT (username) DO NOTHING;
