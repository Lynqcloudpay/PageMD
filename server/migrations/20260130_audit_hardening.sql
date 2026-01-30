-- Migration: 20260130_audit_hardening
-- Description: Adds columns for cryptographic hash chaining and data provenance to audit_events

-- 1. Add new columns for hash chaining and mandated 'Why' element
ALTER TABLE audit_events
ADD COLUMN IF NOT EXISTS previous_hash TEXT,
ADD COLUMN IF NOT EXISTS current_hash TEXT,
ADD COLUMN IF NOT EXISTS reason_for_access TEXT DEFAULT 'TREATMENT';

-- 2. Index for rapid hash chain validation
CREATE INDEX IF NOT EXISTS idx_audit_events_hashes ON audit_events (current_hash, previous_hash);

-- 3. Comment for documentation
COMMENT ON COLUMN audit_events.previous_hash IS 'SHA-256 hash of the immediately preceding audit record';
COMMENT ON COLUMN audit_events.current_hash IS 'SHA-256 hash of the current record including the previous_hash';
COMMENT ON COLUMN audit_events.reason_for_access IS 'The stated purpose of access (e.g., TREATMENT, OPERATIONS) as required by provenance standards';
