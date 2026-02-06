-- Add schema_name to clinics table
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS schema_name VARCHAR(63) UNIQUE;

-- Update existing clinics to have a schema name based on slug
UPDATE clinics 
SET schema_name = 'tenant_' || REPLACE(LOWER(slug), '-', '_')
WHERE schema_name IS NULL;

-- Enforce strict format (optional but good practice as per user instructions)
ALTER TABLE clinics ADD CONSTRAINT chk_schema_name_format 
CHECK (schema_name ~ '^tenant_[a-z0-9_]{1,50}$');

-- Ensure settings table exists as requested
CREATE TABLE IF NOT EXISTS clinic_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
    letterhead_template VARCHAR(50) DEFAULT 'standard',
    time_zone VARCHAR(50) DEFAULT 'America/New_York',
    defaults JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(clinic_id)
);
