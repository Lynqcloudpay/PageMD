DO $$
DECLARE
    schema_name TEXT;
    physician_role_id UUID;
    admin_role_id UUID;
    cosign_priv_id UUID;
BEGIN
    FOR schema_name IN SELECT nspname FROM pg_namespace WHERE nspname LIKE 'tenant_%' LOOP
        BEGIN
            -- 1. Add assigned_attending_id to visits
            EXECUTE format('ALTER TABLE %I.visits ADD COLUMN IF NOT EXISTS assigned_attending_id UUID REFERENCES %I.users(id)', schema_name, schema_name);
            
            -- 2. Ensure notes:cosign privilege exists
            EXECUTE format('SELECT id FROM %I.privileges WHERE name = %L', schema_name, 'notes:cosign') INTO cosign_priv_id;
            IF cosign_priv_id IS NULL THEN
                EXECUTE format('INSERT INTO %I.privileges (name, description, category) VALUES (%L, %L, %L) RETURNING id', 
                    schema_name, 'notes:cosign', 'Ability to cosign clinical notes and apply attestations', 'Clinical') INTO cosign_priv_id;
            END IF;

            -- 3. Grant to Physician/Clinician roles
            FOR physician_role_id IN EXECUTE format('SELECT id FROM %I.roles WHERE name IN (%L, %L)', 
                schema_name, 'Physician', 'Clinician') LOOP
                
                EXECUTE format('INSERT INTO %I.role_privileges (role_id, privilege_id) VALUES (%L, %L) ON CONFLICT DO NOTHING',
                    schema_name, physician_role_id, cosign_priv_id);
            END LOOP;

            -- 4. Grant to Admin role
            FOR admin_role_id IN EXECUTE format('SELECT id FROM %I.roles WHERE name = %L', 
                schema_name, 'Admin') LOOP
                
                EXECUTE format('INSERT INTO %I.role_privileges (role_id, privilege_id) VALUES (%L, %L) ON CONFLICT DO NOTHING',
                    schema_name, admin_role_id, cosign_priv_id);
            END LOOP;
            
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Failed to migrate schema %: %', schema_name, SQLERRM;
        END;
    END LOOP;
END $$;
