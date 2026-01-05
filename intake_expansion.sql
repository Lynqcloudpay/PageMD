-- Migration: Intake Expansion
-- Adds support for full standard intake set and individualized rate limits logic (logic already added, but ensure schema is ready)

-- Add IP and User Agent to intake_sessions for audit/legal compliance
CREATE OR REPLACE FUNCTION public.expand_intake_sessions(target_schema TEXT) 
RETURNS VOID AS $$
BEGIN
    EXECUTE format('
        ALTER TABLE %I.intake_sessions ADD COLUMN IF NOT EXISTS ip_address INET;
        ALTER TABLE %I.intake_sessions ADD COLUMN IF NOT EXISTS user_agent TEXT;
        
        CREATE TABLE IF NOT EXISTS %I.intake_settings (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            key VARCHAR(100) UNIQUE NOT NULL,
            value TEXT NOT NULL,
            category VARCHAR(50) DEFAULT ''general'',
            description TEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_by UUID
        );

        -- Seed default values if empty
        INSERT INTO %I.intake_settings (key, value, category, description)
        VALUES 
        (''financial_policy'', ''Standard Financial Policy text...'', ''legal'', ''Financial Policy template''),
        (''hipaa_notice'', ''HIPAA Notice of Privacy Practices...'', ''legal'', ''HIPAA Notice template''),
        (''consent_to_treat'', ''Consent to Treat text...'', ''legal'', ''Consent to Treat template''),
        (''assignment_of_benefits'', ''Assignment of Benefits text...'', ''legal'', ''Assignment of Benefits template''),
        (''release_of_information'', ''Authorization to Release Information text...'', ''legal'', ''Release of Info template''),
        (''telehealth_consent'', ''Telehealth Consent text...'', ''legal'', ''Telehealth Consent template''),
        (''telehealth_enabled'', ''false'', ''config'', ''Whether telehealth consent is required'')
        ON CONFLICT (key) DO NOTHING;
    ', target_schema, target_schema, target_schema, target_schema);
END;
$$ LANGUAGE plpgsql;

-- Apply to existing tenant schemas
DO $$
DECLARE
    schema_rec RECORD;
BEGIN
    FOR schema_rec IN SELECT schema_name FROM public.clinics LOOP
        PERFORM public.expand_intake_sessions(schema_rec.schema_name);
    END LOOP;
END $$;
