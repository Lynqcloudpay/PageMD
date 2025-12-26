-- Seed Initial Multi-Tenancy Control Data
-- This script sets up the first clinic in the Control DB.

-- 1. Create the default clinic
-- Slug 'default' corresponds to our development fallback or current production hostname resolution.
INSERT INTO clinics (id, slug, display_name, specialty, status)
VALUES ('00000000-0000-0000-0000-000000000001', 'default', 'myHEART Cardiology', 'Cardiology', 'active')
ON CONFLICT (slug) DO NOTHING;

-- 2. Link to the current database
-- Replace these values with the actual production DB credentials if different.
-- Note: 'db' is the hostname of the postgres container in our docker-compose.
INSERT INTO clinic_db_connections (clinic_id, host, db_name, db_user, db_password_encrypted)
VALUES (
    '00000000-0000-0000-0000-000000000001', 
    'db', 
    'emr_db', 
    'emr_user', 
    'ZW1yX3Bhc3N3b3Jk' -- Base64 for 'emr_password' (matching our init seeds)
)
ON CONFLICT (clinic_id) DO NOTHING;

-- 3. Initial settings
INSERT INTO clinic_settings (clinic_id, time_zone)
VALUES ('00000000-0000-0000-0000-000000000001', 'America/New_York')
ON CONFLICT (clinic_id) DO NOTHING;
