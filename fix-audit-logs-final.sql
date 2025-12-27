
ALTER TABLE tenant_miami.audit_logs ADD COLUMN IF NOT EXISTS request_id VARCHAR(50);
ALTER TABLE tenant_miami.audit_logs ADD COLUMN IF NOT EXISTS session_id VARCHAR(50);
