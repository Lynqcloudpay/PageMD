DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN SELECT schema_name FROM clinics WHERE status = 'active'
    LOOP
        EXECUTE format('ALTER TABLE %I.patient_portal_accounts ADD COLUMN IF NOT EXISTS reset_token_hash TEXT', r.schema_name);
        EXECUTE format('ALTER TABLE %I.patient_portal_accounts ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMP', r.schema_name);
    END LOOP;
END $$;
