
ALTER TABLE tenant_miami.audit_logs ADD COLUMN IF NOT EXISTS outcome VARCHAR(20);
ALTER TABLE tenant_miami.settings ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;
ALTER TABLE tenant_miami.settings ADD COLUMN IF NOT EXISTS updated_by UUID;
