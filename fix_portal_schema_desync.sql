-- SQL Fix for Patient Portal Schema Desync
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (
        SELECT schema_name 
        FROM information_schema.schemata 
        WHERE schema_name NOT LIKE 'pg_%' 
        AND schema_name NOT IN ('information_schema', 'public')
    ) LOOP
        -- Fix portal_message_threads
        EXECUTE format('ALTER TABLE %I.portal_message_threads ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP', r.schema_name);
        
        -- Fix portal_messages
        -- content -> body (if exists)
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = r.schema_name AND table_name = 'portal_messages' AND column_name = 'content') THEN
            EXECUTE format('ALTER TABLE %I.portal_messages RENAME COLUMN content TO body', r.schema_name);
        END IF;
        
        EXECUTE format('ALTER TABLE %I.portal_messages ADD COLUMN IF NOT EXISTS body TEXT', r.schema_name);
        EXECUTE format('ALTER TABLE %I.portal_messages ADD COLUMN IF NOT EXISTS sender_portal_account_id UUID REFERENCES %I.patient_portal_accounts(id)', r.schema_name, r.schema_name);
        EXECUTE format('ALTER TABLE %I.portal_messages ADD COLUMN IF NOT EXISTS sender_user_id UUID REFERENCES %I.users(id)', r.schema_name, r.schema_name);
        
        -- Fix portal_appointment_requests
        EXECUTE format('ALTER TABLE %I.portal_appointment_requests ADD COLUMN IF NOT EXISTS portal_account_id UUID REFERENCES %I.patient_portal_accounts(id) ON DELETE CASCADE', r.schema_name, r.schema_name);
        EXECUTE format('ALTER TABLE %I.portal_appointment_requests ADD COLUMN IF NOT EXISTS preferred_time_range VARCHAR(50)', r.schema_name);
        EXECUTE format('ALTER TABLE %I.portal_appointment_requests ADD COLUMN IF NOT EXISTS appointment_type VARCHAR(50)', r.schema_name);
        
        -- Migrate preferred_time to preferred_time_range if it exists
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = r.schema_name AND table_name = 'portal_appointment_requests' AND column_name = 'preferred_time') THEN
            EXECUTE format('UPDATE %I.portal_appointment_requests SET preferred_time_range = preferred_time WHERE preferred_time_range IS NULL', r.schema_name);
        END IF;

    END LOOP;
END $$;
