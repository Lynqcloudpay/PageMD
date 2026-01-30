DO $$
DECLARE
    schema_name TEXT;
BEGIN
    FOR schema_name IN SELECT nspname FROM pg_namespace WHERE nspname LIKE 'tenant_%' LOOP
        BEGIN
            EXECUTE format('ALTER TABLE %I.visits ADD COLUMN IF NOT EXISTS cosigned_at TIMESTAMP WITH TIME ZONE', schema_name);
            EXECUTE format('ALTER TABLE %I.visits ADD COLUMN IF NOT EXISTS cosigned_by UUID REFERENCES %I.users(id)', schema_name, schema_name);
            EXECUTE format('ALTER TABLE %I.visits ADD COLUMN IF NOT EXISTS attestation_text TEXT', schema_name);
            EXECUTE format('ALTER TABLE %I.visits ADD COLUMN IF NOT EXISTS authorship_model VARCHAR(50) DEFAULT %L', schema_name, 'Addendum');
            
            -- Adding columns for forensic integrity if missing
            EXECUTE format('ALTER TABLE %I.visits ADD COLUMN IF NOT EXISTS clinical_snapshot JSONB', schema_name);
            EXECUTE format('ALTER TABLE %I.visits ADD COLUMN IF NOT EXISTS content_hash TEXT', schema_name);
            EXECUTE format('ALTER TABLE %I.visits ADD COLUMN IF NOT EXISTS content_integrity_verified BOOLEAN DEFAULT FALSE', schema_name);

            EXECUTE format('ALTER TABLE %I.visits DROP CONSTRAINT IF EXISTS visits_status_check', schema_name);
            EXECUTE format('ALTER TABLE %I.visits ADD CONSTRAINT visits_status_check CHECK (status IN (%L, %L, %L, %L, %L))', 
                schema_name, 'draft', 'preliminary', 'signed', 'voided', 'retracted');
            
            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = schema_name AND table_name = 'roles') THEN
                EXECUTE format('INSERT INTO %I.roles (name, description, is_system_role) VALUES (%L, %L, true), (%L, %L, true) ON CONFLICT (name) DO NOTHING',
                    schema_name, 'Resident', 'Licensed physician in training (requires cosignature)', 'Medical Student', 'Student in medical school (requires cosignature and verification)');
            END IF;

            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = schema_name AND table_name = 'privileges') THEN
                EXECUTE format('INSERT INTO %I.privileges (name, description, category) VALUES (%L, %L, %L) ON CONFLICT (name) DO NOTHING',
                    schema_name, 'notes:cosign', 'Ability to cosign clinical notes and apply attestations', 'Clinical');
            END IF;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Failed to migrate schema %: %', schema_name, SQLERRM;
        END;
    END LOOP;

    -- Also check public schema for consistency
    BEGIN
        ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS cosigned_at TIMESTAMP WITH TIME ZONE;
        ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS cosigned_by UUID REFERENCES public.users(id);
        ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS attestation_text TEXT;
        ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS authorship_model VARCHAR(50) DEFAULT 'Addendum';
        ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS clinical_snapshot JSONB;
        ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS content_hash TEXT;
        ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS content_integrity_verified BOOLEAN DEFAULT FALSE;
        
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'roles') THEN
            INSERT INTO public.roles (name, description, is_system_role) VALUES 
                ('Resident', 'Licensed physician in training (requires cosignature)', true),
                ('Medical Student', 'Student in medical school (requires cosignature and verification)', true)
            ON CONFLICT (name) DO NOTHING;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'privileges') THEN
            INSERT INTO public.privileges (name, description, category) VALUES 
                ('notes:cosign', 'Ability to cosign clinical notes and apply attestations', 'Clinical')
            ON CONFLICT (name) DO NOTHING;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Failed to migrate public schema: %', SQLERRM;
    END;
END $$;
