DO $$
DECLARE
    schema_record RECORD;
BEGIN
    FOR schema_record IN 
        SELECT schema_name 
        FROM information_schema.schemata 
        WHERE schema_name IN ('public', 'tenant_sandboxclinic', 'tenant_test')
    LOOP
        RAISE NOTICE 'Fixing audit_events FK in schema: %', schema_record.schema_name;

        -- Drop the incorrect constraint if it exists
        EXECUTE format('
            ALTER TABLE %I.audit_events 
            DROP CONSTRAINT IF EXISTS audit_events_actor_user_id_fkey
        ', schema_record.schema_name);

        -- Add the correct constraint pointing to the tenant-specific users table
        -- Make it nullable since sometimes actor is system (NULL)
        EXECUTE format('
            ALTER TABLE %I.audit_events 
            ADD CONSTRAINT audit_events_actor_user_id_fkey 
            FOREIGN KEY (actor_user_id) 
            REFERENCES %I.users(id)
            ON DELETE SET NULL
        ', schema_record.schema_name, schema_record.schema_name);
        
    END LOOP;
END $$;
