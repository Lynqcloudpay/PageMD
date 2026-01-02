-- Migration for Patient Portal Messaging (Explicit Schema)
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
        -- Portal Message Threads
        EXECUTE format('
            CREATE TABLE IF NOT EXISTS %I.portal_message_threads (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                patient_id UUID NOT NULL REFERENCES %I.patients(id) ON DELETE CASCADE,
                subject VARCHAR(255) NOT NULL,
                status VARCHAR(20) DEFAULT ''open'' CHECK (status IN (''open'', ''closed'')),
                last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )', r.schema_name, r.schema_name);

        -- Portal Messages
        EXECUTE format('
            CREATE TABLE IF NOT EXISTS %I.portal_messages (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                thread_id UUID NOT NULL REFERENCES %I.portal_message_threads(id) ON DELETE CASCADE,
                sender_portal_account_id UUID REFERENCES %I.patient_portal_accounts(id),
                sender_user_id UUID REFERENCES %I.users(id),
                body TEXT NOT NULL,
                read_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CHECK (
                    (sender_portal_account_id IS NOT NULL AND sender_user_id IS NULL) OR
                    (sender_portal_account_id IS NULL AND sender_user_id IS NOT NULL)
                )
            )', r.schema_name, r.schema_name, r.schema_name, r.schema_name);

        EXECUTE format('CREATE INDEX IF NOT EXISTS idx_portal_threads_patient ON %I.portal_message_threads(patient_id)', r.schema_name);
        EXECUTE format('CREATE INDEX IF NOT EXISTS idx_portal_messages_thread ON %I.portal_messages(thread_id)', r.schema_name);

    END LOOP;
END $$;
