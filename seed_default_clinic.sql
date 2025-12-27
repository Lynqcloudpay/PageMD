-- Seed 'default' clinic for single-tenant or default usage
INSERT INTO clinics (
    slug,
    display_name,
    legal_name,
    specialty,
    status
) VALUES (
    'default',
    'My Practice',
    'My Practice, LLC',
    'Primary Care',
    'active'
) ON CONFLICT (slug) DO NOTHING;

-- Map default clinic to the local emr_db (self-reference for simplicity in this architecture)
-- In a real multi-tenant setup, this would point to a specific DB.
-- Here we are just satisfying the query.
INSERT INTO clinic_db_connections (
    clinic_id,
    host,
    port,
    db_name,
    db_user,
    db_password_encrypted
) 
SELECT 
    id,
    'emr-db',
    5432,
    'emr_db',
    'emr_user',
    'V2hhdGV2ZXI=' -- base64 placeholder, ignored by current simplified logic or needs to be real
FROM clinics WHERE slug = 'default'
ON CONFLICT (clinic_id) DO NOTHING;

-- Seed initial settings
INSERT INTO clinic_settings (clinic_id)
SELECT id FROM clinics WHERE slug = 'default'
ON CONFLICT (clinic_id) DO NOTHING;
