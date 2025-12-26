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
-- Internal Docker connections don't require SSL
INSERT INTO clinic_db_connections (clinic_id, host, db_name, db_user, db_password_encrypted, ssl_mode)
VALUES (
    '00000000-0000-0000-0000-000000000001', 
    'db', 
    'emr_db', 
    'emr_user', 
    'Q0hBTkdFX01FX1NUUk9OR19QQVNTV09SRF9NSU5fMzJfQ0hBUlM=', -- Base64 for 'CHANGE_ME_STRONG_PASSWORD_MIN_32_CHARS'
    'disable'  -- No SSL for internal Docker network
)
ON CONFLICT (clinic_id) DO UPDATE SET 
    ssl_mode = 'disable',
    db_password_encrypted = 'Q0hBTkdFX01FX1NUUk9OR19QQVNTV09SRF9NSU5fMzJfQ0hBUlM=';

-- 3. Initial settings
INSERT INTO clinic_settings (clinic_id, time_zone)
VALUES ('00000000-0000-0000-0000-000000000001', 'America/New_York')
ON CONFLICT (clinic_id) DO NOTHING;
