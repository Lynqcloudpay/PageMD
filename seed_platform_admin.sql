-- Seed Initial Platform Admin Account
-- This creates the first Super Admin user for your IT team

-- Create the initial Super Admin (you can change these details)
-- Password: PageMD2024!Admin (CHANGE THIS IN PRODUCTION!)
INSERT INTO super_admins (
    email,
    password_hash,
    first_name,
    last_name,
    role,
    is_active
)
VALUES (
    'admin@pagemd.com',
    '$2b$10$8OKQXfYrC3N9EwYJHc6pEuZL5Ej9nz6KH.YX3.2BZHu4kXt5UzJDS',  -- bcrypt hash of 'PageMD2024!Admin'
    'Platform',
    'Administrator',
    'super_admin',
    true
)
ON CONFLICT (email) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    role = 'super_admin',
    is_active = true;

-- Clean up expired sessions
DELETE FROM platform_admin_sessions WHERE expires_at < NOW();
