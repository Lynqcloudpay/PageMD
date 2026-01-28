DO $$
DECLARE
    schema_record RECORD;
BEGIN
    FOR schema_record IN 
        SELECT schema_name 
        FROM information_schema.schemata 
        WHERE schema_name = 'public' OR schema_name LIKE 'tenant_%'
    LOOP
        RAISE NOTICE 'Processing schema: %', schema_record.schema_name;

        -- 1. Updates to visits table
        EXECUTE format('ALTER TABLE %I.visits ADD COLUMN IF NOT EXISTS content_hash TEXT', schema_record.schema_name);
        EXECUTE format('ALTER TABLE %I.visits ADD COLUMN IF NOT EXISTS content_integrity_verified BOOLEAN DEFAULT FALSE', schema_record.schema_name);

        -- 2. Repair audit_events table
        -- Drop if it exists to ensure standard columns
        EXECUTE format('DROP TABLE IF EXISTS %I.audit_events CASCADE', schema_record.schema_name);
        EXECUTE format('CREATE TABLE %I.audit_events (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            tenant_id UUID,
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
            details JSONB DEFAULT ''{}''::jsonb
        )', schema_record.schema_name);

        -- Add indexes for audit_events
        EXECUTE format('CREATE INDEX IF NOT EXISTS idx_audit_events_occurred_at_%s ON %I.audit_events (occurred_at DESC)', schema_record.schema_name, schema_record.schema_name);
        EXECUTE format('CREATE INDEX IF NOT EXISTS idx_audit_events_tenant_id_%s ON %I.audit_events (tenant_id)', schema_record.schema_name, schema_record.schema_name);
        EXECUTE format('CREATE INDEX IF NOT EXISTS idx_audit_events_patient_id_%s ON %I.audit_events (patient_id)', schema_record.schema_name, schema_record.schema_name);

        -- 3. Create note_retractions table
        EXECUTE format('CREATE TABLE IF NOT EXISTS %I.note_retractions (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id uuid NOT NULL,
            note_id uuid NOT NULL REFERENCES %I.visits(id),
            retracted_at timestamptz NOT NULL DEFAULT now(),
            retracted_by_user_id uuid NOT NULL REFERENCES users(id),
            reason_code text NOT NULL,
            reason_text text NOT NULL,
            details jsonb NOT NULL DEFAULT ''{}''::jsonb
        )', schema_record.schema_name, schema_record.schema_name);

        EXECUTE format('CREATE UNIQUE INDEX IF NOT EXISTS uq_note_retractions_tenant_note_%s ON %I.note_retractions(tenant_id, note_id)', schema_record.schema_name, schema_record.schema_name);

    END LOOP;
END $$;
