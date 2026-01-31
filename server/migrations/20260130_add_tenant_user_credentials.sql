DO $$
DECLARE
    schema_name TEXT;
BEGIN
    FOR schema_name IN SELECT nspname FROM pg_namespace WHERE nspname LIKE 'tenant_%' LOOP
        BEGIN
            EXECUTE format('ALTER TABLE %I.users ADD COLUMN IF NOT EXISTS professional_type VARCHAR(50)', schema_name);
            EXECUTE format('ALTER TABLE %I.users ADD COLUMN IF NOT EXISTS credentials VARCHAR(255)', schema_name);
            
            -- Attempt to auto-classify known test users
            EXECUTE format('UPDATE %I.users SET professional_type = %L WHERE (first_name ILIKE %L OR last_name ILIKE %L) AND professional_type IS NULL', 
                schema_name, 'MD', '%Doctor%', '%Doctor%');
                
            EXECUTE format('UPDATE %I.users SET professional_type = %L WHERE (first_name ILIKE %L OR last_name ILIKE %L) AND professional_type IS NULL', 
                schema_name, 'NP', '%np%', '%np%');
                
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Failed to migrate schema %: %', schema_name, SQLERRM;
        END;
    END LOOP;
END $$;
