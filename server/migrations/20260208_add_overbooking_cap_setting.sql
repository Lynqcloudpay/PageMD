-- Add overbooking cap setting to various settings tables
-- Default is NULL (no cap) or 0 (unlimited)

-- 1. Tenant DB tables
ALTER TABLE clinical_settings ADD COLUMN IF NOT EXISTS max_appointments_per_slot INTEGER DEFAULT NULL;
ALTER TABLE practice_settings ADD COLUMN IF NOT EXISTS max_appointments_per_slot INTEGER DEFAULT NULL;

-- 2. Control DB tables (these will be run against the same DB in local env, 
-- but might be different in prod based on pool.controlPool configuration.
-- Since they share the same DB usually in simple setups, we include them.)
ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS max_appointments_per_slot INTEGER DEFAULT NULL;
