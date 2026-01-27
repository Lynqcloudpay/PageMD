-- Migration: Hardening Audit & Clinical Signs
-- Description: Add composite indexes for audit performance and content hashing for signed notes.

-- 1. Optimized indexes for Audit Dashboard
CREATE INDEX IF NOT EXISTS idx_audit_events_tenant_occurred ON audit_events (tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_patient_occurred ON audit_events (patient_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_actor_occurred ON audit_events (actor_user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_action_occurred ON audit_events (action, occurred_at DESC);

-- 2. Content Integrity for Clinical Notes
-- Add hash column to visits to detect tampering after signing
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='visits' AND column_name='content_hash') THEN
        ALTER TABLE visits ADD COLUMN content_hash TEXT NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='visits' AND column_name='content_integrity_verified') THEN
        ALTER TABLE visits ADD COLUMN content_integrity_verified BOOLEAN DEFAULT TRUE;
    END IF;
END $$;

-- 3. Ensure note_retractions table is robust (already in migrate script but ensuring here too)
CREATE TABLE IF NOT EXISTS note_retractions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    note_id uuid NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
    retracted_at timestamptz NOT NULL DEFAULT now(),
    retracted_by_user_id uuid NOT NULL REFERENCES users(id),
    reason_code text NOT NULL,
    reason_text text NOT NULL,
    details jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_note_retractions_note_id ON note_retractions(note_id);
