DO $$
DECLARE
    schema_name TEXT;
    clinician_role_id UUID;
    nurse_role_id UUID;
    notes_view_id UUID;
    audit_view_id UUID;
BEGIN
    FOR schema_name IN SELECT nspname FROM pg_namespace WHERE nspname LIKE 'tenant_%' OR nspname = 'public' LOOP
        BEGIN
            -- 1. Ensure Privileges exist
            EXECUTE format('SELECT id FROM %I.privileges WHERE name = %L', schema_name, 'notes:view') INTO notes_view_id;
            IF notes_view_id IS NULL THEN
                EXECUTE format('INSERT INTO %I.privileges (name, description, category) VALUES (%L, %L, %L) RETURNING id', 
                    schema_name, 'notes:view', 'Ability to view clinical notes and pending items', 'Clinical') INTO notes_view_id;
            END IF;

            EXECUTE format('SELECT id FROM %I.privileges WHERE name = %L', schema_name, 'audit:view') INTO audit_view_id;
            IF audit_view_id IS NULL THEN
                EXECUTE format('INSERT INTO %I.privileges (name, description, category) VALUES (%L, %L, %L) RETURNING id', 
                    schema_name, 'audit:view', 'Ability to view privacy and access logs', 'Security') INTO audit_view_id;
            END IF;

            -- 2. Grant to Physician / Clinician roles
            FOR clinician_role_id IN EXECUTE format('SELECT id FROM %I.roles WHERE name IN (%L, %L, %L, %L)', 
                schema_name, 'Physician', 'Clinician', 'Nurse Practitioner', 'Resident') LOOP
                
                EXECUTE format('INSERT INTO %I.role_privileges (role_id, privilege_id) VALUES (%L, %L) ON CONFLICT DO NOTHING',
                    schema_name, clinician_role_id, notes_view_id);
                EXECUTE format('INSERT INTO %I.role_privileges (role_id, privilege_id) VALUES (%L, %L) ON CONFLICT DO NOTHING',
                    schema_name, clinician_role_id, audit_view_id);
            END LOOP;

            -- 3. Grant to Nurse roles
            FOR nurse_role_id IN EXECUTE format('SELECT id FROM %I.roles WHERE name IN (%L, %L, %L)', 
                schema_name, 'Nurse', 'Medical Assistant', 'Nurse Practitioner') LOOP
                
                EXECUTE format('INSERT INTO %I.role_privileges (role_id, privilege_id) VALUES (%L, %L) ON CONFLICT DO NOTHING',
                    schema_name, nurse_role_id, notes_view_id);
                EXECUTE format('INSERT INTO %I.role_privileges (role_id, privilege_id) VALUES (%L, %L) ON CONFLICT DO NOTHING',
                    schema_name, nurse_role_id, audit_view_id);
            END LOOP;
            
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Failed to grant permissions in schema %: %', schema_name, SQLERRM;
        END;
    END LOOP;
END $$;
