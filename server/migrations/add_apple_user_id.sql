-- Migration: Add apple_user_id column for Sign in with Apple
-- Run this against each tenant schema

DO $$
DECLARE
    tenant_schema TEXT;
BEGIN
    FOR tenant_schema IN 
        SELECT schema_name FROM platform_clinics WHERE schema_name IS NOT NULL
    LOOP
        EXECUTE format('
            ALTER TABLE %I.patient_portal_accounts 
            ADD COLUMN IF NOT EXISTS apple_user_id VARCHAR(255) UNIQUE
        ', tenant_schema);
        
        RAISE NOTICE 'Added apple_user_id column to %.patient_portal_accounts', tenant_schema;
    END LOOP;
END $$;
