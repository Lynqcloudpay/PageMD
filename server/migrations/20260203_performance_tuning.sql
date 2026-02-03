-- ============================================================================
-- PageMD API Platform Performance Tuning
-- Adding composite indexes for common multi-tenant query patterns
-- ============================================================================

-- Audit Events: Optimize retrieval by tenant and time range
CREATE INDEX IF NOT EXISTS idx_audit_events_tenant_time 
ON audit_events(tenant_id, created_at DESC);

-- Outbox Events: Optimize polling by tenant and time range
CREATE INDEX IF NOT EXISTS idx_outbox_events_tenant_time 
ON outbox_events(tenant_id, created_at DESC);

-- Webhook Deliveries: Optimize history lookups
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status_time
ON webhook_deliveries(status, created_at DESC);

-- Idempotency: Optimize cleanup of expired records
CREATE INDEX IF NOT EXISTS idx_idempotency_expires_at
ON idempotency_records(expires_at);
