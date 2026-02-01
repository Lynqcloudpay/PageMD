-- Migration to ensure clinic_id exists on all tenant tables
-- This fixes the 500 errors in the inbox when querying tenant data

DO $$
DECLARE
    schema_name TEXT;
BEGIN
    FOR schema_name IN 
        SELECT nspname FROM pg_namespace WHERE nspname LIKE 'tenant_%'
    LOOP
        EXECUTE format('SET search_path TO %I, public', schema_name);
        
        -- Add clinic_id to portal_message_threads if missing
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = schema_name AND table_name = 'portal_message_threads') THEN
            EXECUTE format('ALTER TABLE %I.portal_message_threads ADD COLUMN IF NOT EXISTS clinic_id UUID', schema_name);
        END IF;
        
        -- Add clinic_id to referrals if missing  
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = schema_name AND table_name = 'referrals') THEN
            EXECUTE format('ALTER TABLE %I.referrals ADD COLUMN IF NOT EXISTS clinic_id UUID', schema_name);
        END IF;

        -- Add clinic_id to documents if missing
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = schema_name AND table_name = 'documents') THEN
            EXECUTE format('ALTER TABLE %I.documents ADD COLUMN IF NOT EXISTS clinic_id UUID', schema_name);
        END IF;

        -- Add clinic_id to orders if missing
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = schema_name AND table_name = 'orders') THEN
            EXECUTE format('ALTER TABLE %I.orders ADD COLUMN IF NOT EXISTS clinic_id UUID', schema_name);
        END IF;

        -- Add clinic_id to visits if missing
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = schema_name AND table_name = 'visits') THEN
            EXECUTE format('ALTER TABLE %I.visits ADD COLUMN IF NOT EXISTS clinic_id UUID', schema_name);
        END IF;

        -- Add clinic_id to messages if missing
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = schema_name AND table_name = 'messages') THEN
            EXECUTE format('ALTER TABLE %I.messages ADD COLUMN IF NOT EXISTS clinic_id UUID', schema_name);
        END IF;

        -- Add clinic_id to portal_messages if missing
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = schema_name AND table_name = 'portal_messages') THEN
            EXECUTE format('ALTER TABLE %I.portal_messages ADD COLUMN IF NOT EXISTS clinic_id UUID', schema_name);
        END IF;

        -- Add clinic_id to portal_appointment_requests if missing
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = schema_name AND table_name = 'portal_appointment_requests') THEN
            EXECUTE format('ALTER TABLE %I.portal_appointment_requests ADD COLUMN IF NOT EXISTS clinic_id UUID', schema_name);
        END IF;
        
        RAISE NOTICE 'Migrated schema: %', schema_name;
    END LOOP;
END;
$$;
