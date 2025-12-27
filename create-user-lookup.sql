-- Migration to support Global Login (Recognition by Email)
-- Runs in the control_db

CREATE TABLE IF NOT EXISTS platform_user_lookup (
    email VARCHAR(255) PRIMARY KEY,
    clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
    schema_name VARCHAR(63) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast lookups during login
CREATE INDEX IF NOT EXISTS idx_platform_user_email ON platform_user_lookup(email);

-- Populate with existing users from the default tenant if any
-- (This is manual since users are isolated, but we can seed the main admin)
INSERT INTO platform_user_lookup (email, clinic_id, schema_name)
SELECT 
    'meljrodriguez14@gmail.com', 
    id, 
    'tenant_default'
FROM clinics 
WHERE slug = 'default'
ON CONFLICT (email) DO NOTHING;
