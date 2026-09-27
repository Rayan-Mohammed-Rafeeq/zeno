-- Repair demo accounts created by V2, whose documented password hash was incorrect.
-- Only replace the original seed hash, preserving any passwords that were changed later.
UPDATE users
SET password = '$2b$10$9VjhRVX.xbp7r7f6PaEe3uXmCoSZyQo9SgXWcPJPeTmxqc2dUQnM.'
WHERE username IN ('admin', 'sarah.chen', 'mike.johnson', 'dr.patel', 'dr.williams', 'lisa.martinez')
  AND password = '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi';
