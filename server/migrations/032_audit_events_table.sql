-- Migration: Create audit_events table and enforce immutability
-- Description: Commercial-grade auditing table for PageMD EMR

CREATE TABLE IF NOT EXISTS audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    tenant_id UUID, -- clinic_id
    actor_user_id UUID NOT NULL REFERENCES users(id),
    actor_role VARCHAR(100),
    action VARCHAR(255) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID,
    patient_id UUID REFERENCES patients(id),
    encounter_id UUID REFERENCES visits(id),
    ip_address INET,
    user_agent TEXT,
    request_id UUID,
    details JSONB DEFAULT '{}'::jsonb
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_events_occurred_at ON audit_events (occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_tenant_id ON audit_events (tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_patient_id ON audit_events (patient_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_actor_user_id ON audit_events (actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_entity ON audit_events (entity_type, entity_id);

-- Enforce Immutability (Prevent UPDATES and DELETES)
CREATE OR REPLACE FUNCTION prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit events are immutable and cannot be modified or deleted.';
END;
$$ LANGUAGE plpgsql;

-- Only create triggers if they don't exist (to avoid errors on re-run)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_prevent_audit_update') THEN
        CREATE TRIGGER trg_prevent_audit_update
        BEFORE UPDATE ON audit_events
        FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_prevent_audit_delete') THEN
        CREATE TRIGGER trg_prevent_audit_delete
        BEFORE DELETE ON audit_events
        FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();
    END IF;
END $$;
