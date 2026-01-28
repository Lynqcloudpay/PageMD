DO $$
DECLARE
    schema_record RECORD;
BEGIN
    FOR schema_record IN 
        SELECT schema_name 
        FROM information_schema.schemata 
        WHERE schema_name IN ('public', 'tenant_sandboxclinic', 'tenant_test')
    LOOP
        RAISE NOTICE 'Fixing note_retractions FK in schema: %', schema_record.schema_name;

        -- Drop the incorrect constraint if it exists
        -- We wrap in dynamic SQL because the table might not exist or constraint name might vary (though unlikely)
        EXECUTE format('
            ALTER TABLE %I.note_retractions 
            DROP CONSTRAINT IF EXISTS note_retractions_retracted_by_user_id_fkey
        ', schema_record.schema_name);

        -- Add the correct constraint pointing to the tenant-specific users table
        EXECUTE format('
            ALTER TABLE %I.note_retractions 
            ADD CONSTRAINT note_retractions_retracted_by_user_id_fkey 
            FOREIGN KEY (retracted_by_user_id) 
            REFERENCES %I.users(id)
        ', schema_record.schema_name, schema_record.schema_name);
        
    END LOOP;
END $$;
