-- Migration: Hardening Audit & Clinical Signs (v3)
-- Description: Tenant-scoped indexes, durable retractions, and append-only triggers.

-- 0) Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) Optimized indexes for Audit Dashboard (tenant-scoped)
CREATE INDEX IF NOT EXISTS idx_audit_events_tenant_occurred
  ON audit_events (tenant_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_events_tenant_patient_occurred
  ON audit_events (tenant_id, patient_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_events_tenant_actor_occurred
  ON audit_events (tenant_id, actor_user_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_events_tenant_action_occurred
  ON audit_events (tenant_id, action, occurred_at DESC);

-- Critical for "Note History / Audit Trail" lookups
CREATE INDEX IF NOT EXISTS idx_audit_events_tenant_entity_occurred
  ON audit_events (tenant_id, entity_type, entity_id, occurred_at DESC);

-- 2) Content Integrity for Clinical Notes (visits)
DO $$
BEGIN
  -- Add hash column with schema check
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='visits' AND column_name='content_hash'
    AND table_schema = current_schema()
  ) THEN
    ALTER TABLE visits ADD COLUMN content_hash TEXT NULL;
  END IF;

  -- Add integrity flag (NULL = not checked)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='visits' AND column_name='content_integrity_verified'
    AND table_schema = current_schema()
  ) THEN
    ALTER TABLE visits ADD COLUMN content_integrity_verified BOOLEAN NULL;
  ELSE
    -- Re-baseline existing column
    ALTER TABLE visits ALTER COLUMN content_integrity_verified SET DEFAULT NULL;
    -- Also update any existing TRUE defaults to NULL to be safe
    ALTER TABLE visits ALTER COLUMN content_integrity_verified DROP DEFAULT;
  END IF;
END $$;

-- 3) note_retractions: durable, non-cascading, tenant-aware
DROP TABLE IF EXISTS note_retractions;

CREATE TABLE note_retractions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  note_id uuid NOT NULL REFERENCES visits(id),
  retracted_at timestamptz NOT NULL DEFAULT now(),
  retracted_by_user_id uuid NOT NULL REFERENCES users(id),
  reason_code text NOT NULL,
  reason_text text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_note_retractions_tenant_note_id
  ON note_retractions(tenant_id, note_id);

CREATE INDEX IF NOT EXISTS idx_note_retractions_tenant_retracted_at
  ON note_retractions(tenant_id, retracted_at DESC);

-- 4) Audit log immutability
CREATE OR REPLACE FUNCTION prevent_audit_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_events is append-only and immutable for compliance.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_audit_update ON audit_events;
CREATE TRIGGER trg_prevent_audit_update
BEFORE UPDATE ON audit_events
FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();

DROP TRIGGER IF EXISTS trg_prevent_audit_delete ON audit_events;
CREATE TRIGGER trg_prevent_audit_delete
BEFORE DELETE ON audit_events
FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();
