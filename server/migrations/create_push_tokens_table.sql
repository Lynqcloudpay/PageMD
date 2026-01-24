-- Migration: Create patient_portal_push_tokens table
-- Run this against each tenant schema

DO $$
DECLARE
    tenant_schema TEXT;
BEGIN
    FOR tenant_schema IN 
        SELECT schema_name FROM platform_clinics WHERE schema_name IS NOT NULL
    LOOP
        EXECUTE format('
            CREATE TABLE IF NOT EXISTS %I.patient_portal_push_tokens (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                account_id UUID NOT NULL REFERENCES %I.patient_portal_accounts(id) ON DELETE CASCADE,
                token TEXT NOT NULL,
                platform TEXT NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                last_used_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(token)
            );
            
            CREATE INDEX IF NOT EXISTS idx_push_tokens_account_id ON %I.patient_portal_push_tokens(account_id);
        ', tenant_schema, tenant_schema, tenant_schema);
        
        RAISE NOTICE 'Created patient_portal_push_tokens table in %', tenant_schema;
    END LOOP;
END $$;
