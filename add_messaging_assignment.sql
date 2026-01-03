-- SQL Fix for Patient Portal Messaging: Add assigned_user_id
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
        EXECUTE format('ALTER TABLE %I.portal_message_threads ADD COLUMN IF NOT EXISTS assigned_user_id UUID REFERENCES %I.users(id)', r.schema_name, r.schema_name);
    END LOOP;
END $$;
