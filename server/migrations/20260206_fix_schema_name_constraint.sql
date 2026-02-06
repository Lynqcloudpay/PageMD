-- Fix schema_name constraint to allow 1-character slugs (e.g., tenant_r)
-- Previous constraint required minimum 3 characters after prefix

-- Drop the old constraint
ALTER TABLE clinics DROP CONSTRAINT IF EXISTS chk_schema_name_format;

-- Add new constraint with relaxed minimum (1 character)
ALTER TABLE clinics ADD CONSTRAINT chk_schema_name_format 
CHECK (schema_name ~ '^tenant_[a-z0-9_]{1,50}$');
