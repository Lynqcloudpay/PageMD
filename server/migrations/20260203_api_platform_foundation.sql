-- ============================================================================
-- PageMD Commercial API Platform Foundation
-- Phase 1: Partner/App Management + OAuth 2.1 Infrastructure
-- ============================================================================

-- Partner Organizations
CREATE TABLE IF NOT EXISTS partners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'pending')),
    contact_email VARCHAR(255) NOT NULL,
    contact_name VARCHAR(255),
    company_url VARCHAR(500),
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rate Limit Policies (create before apps table references it)
CREATE TABLE IF NOT EXISTS rate_limit_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    burst INTEGER NOT NULL DEFAULT 100,
    sustained_per_min INTEGER NOT NULL DEFAULT 60,
    per_hour INTEGER NOT NULL DEFAULT 1000,
    per_day INTEGER NOT NULL DEFAULT 10000,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default rate limit policies
INSERT INTO rate_limit_policies (id, name, description, burst, sustained_per_min, per_hour, per_day) VALUES
    ('00000000-0000-0000-0000-000000000001', 'sandbox', 'Sandbox/Development tier with low limits', 20, 20, 200, 1000),
    ('00000000-0000-0000-0000-000000000002', 'production', 'Standard production tier', 100, 60, 1000, 10000),
    ('00000000-0000-0000-0000-000000000003', 'enterprise', 'Enterprise tier with high limits', 500, 300, 5000, 100000)
ON CONFLICT (name) DO NOTHING;

-- Partner Applications
CREATE TABLE IF NOT EXISTS apps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    env VARCHAR(20) NOT NULL CHECK (env IN ('sandbox', 'production')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'revoked')),
    client_id VARCHAR(64) UNIQUE NOT NULL,
    client_secret_hash VARCHAR(255) NOT NULL,
    allowed_scopes TEXT[] DEFAULT '{}',
    redirect_uris TEXT[] DEFAULT '{}',
    webhook_url TEXT,
    rate_limit_policy_id UUID REFERENCES rate_limit_policies(id) DEFAULT '00000000-0000-0000-0000-000000000001',
    -- Tenant binding (optional - null means multi-tenant app)
    tenant_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Optional API Keys for non-PHI endpoints (lightweight alternative to OAuth)
CREATE TABLE IF NOT EXISTS app_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_id UUID NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    key_prefix VARCHAR(8) NOT NULL,  -- First 8 chars for identification
    key_hash VARCHAR(255) NOT NULL,
    scopes TEXT[] DEFAULT '{}',
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- OAuth Authorization Codes (short-lived, for PKCE flow)
CREATE TABLE IF NOT EXISTS oauth_authorization_codes (
    code VARCHAR(128) PRIMARY KEY,
    app_id UUID NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL,
    user_id UUID,
    scopes TEXT[] NOT NULL,
    code_challenge VARCHAR(128),
    code_challenge_method VARCHAR(10) CHECK (code_challenge_method IN ('S256', 'plain')),
    redirect_uri TEXT NOT NULL,
    state VARCHAR(255),
    nonce VARCHAR(255),
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- OAuth Refresh Tokens
CREATE TABLE IF NOT EXISTS oauth_refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    app_id UUID NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL,
    user_id UUID,
    scopes TEXT[] NOT NULL,
    parent_token_id UUID REFERENCES oauth_refresh_tokens(id),  -- For token rotation tracking
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- OAuth Access Token Audit (optional - for introspection and revocation)
CREATE TABLE IF NOT EXISTS oauth_access_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    jti VARCHAR(64) NOT NULL UNIQUE,  -- JWT ID
    app_id UUID NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL,
    user_id UUID,
    scopes TEXT[] NOT NULL,
    refresh_token_id UUID REFERENCES oauth_refresh_tokens(id),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Idempotency Records (for duplicate request handling)
CREATE TABLE IF NOT EXISTS idempotency_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    app_id UUID NOT NULL,
    idempotency_key VARCHAR(255) NOT NULL,
    request_hash VARCHAR(64) NOT NULL,
    request_path VARCHAR(500) NOT NULL,
    request_method VARCHAR(10) NOT NULL,
    response_blob JSONB NOT NULL,
    status_code INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '48 hours',
    UNIQUE(tenant_id, app_id, idempotency_key)
);

-- Webhook Subscriptions
CREATE TABLE IF NOT EXISTS webhook_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    app_id UUID NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
    name VARCHAR(255),
    url TEXT NOT NULL,
    events TEXT[] NOT NULL,
    secret VARCHAR(64) NOT NULL,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'disabled', 'failed')),
    failure_count INTEGER DEFAULT 0,
    last_success_at TIMESTAMPTZ,
    last_failure_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Outbox Events (transactional outbox pattern)
CREATE TABLE IF NOT EXISTS outbox_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    type VARCHAR(100) NOT NULL,
    aggregate_type VARCHAR(50),  -- e.g., 'Patient', 'Appointment'
    aggregate_id UUID,
    payload JSONB NOT NULL,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    published_at TIMESTAMPTZ,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'published', 'failed'))
);

-- Webhook Delivery Tracking
CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID NOT NULL REFERENCES webhook_subscriptions(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES outbox_events(id) ON DELETE CASCADE,
    attempt INTEGER DEFAULT 1,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed', 'abandoned')),
    response_code INTEGER,
    response_body TEXT,
    next_retry_at TIMESTAMPTZ,
    last_error TEXT,
    duration_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

-- Apps
CREATE INDEX IF NOT EXISTS idx_apps_client_id ON apps(client_id);
CREATE INDEX IF NOT EXISTS idx_apps_partner_id ON apps(partner_id);
CREATE INDEX IF NOT EXISTS idx_apps_tenant_id ON apps(tenant_id) WHERE tenant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_apps_status ON apps(status);

-- App Keys
CREATE INDEX IF NOT EXISTS idx_app_keys_app_id ON app_keys(app_id);
CREATE INDEX IF NOT EXISTS idx_app_keys_prefix ON app_keys(key_prefix);

-- OAuth Codes
CREATE INDEX IF NOT EXISTS idx_oauth_codes_expires ON oauth_authorization_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_oauth_codes_app ON oauth_authorization_codes(app_id);

-- OAuth Refresh Tokens
CREATE INDEX IF NOT EXISTS idx_oauth_refresh_expires ON oauth_refresh_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_oauth_refresh_app ON oauth_refresh_tokens(app_id);
CREATE INDEX IF NOT EXISTS idx_oauth_refresh_token ON oauth_refresh_tokens(token_hash);

-- OAuth Access Tokens
CREATE INDEX IF NOT EXISTS idx_oauth_access_jti ON oauth_access_tokens(jti);
CREATE INDEX IF NOT EXISTS idx_oauth_access_expires ON oauth_access_tokens(expires_at);

-- Idempotency
CREATE INDEX IF NOT EXISTS idx_idempotency_lookup ON idempotency_records(tenant_id, app_id, idempotency_key);
CREATE INDEX IF NOT EXISTS idx_idempotency_expires ON idempotency_records(expires_at);

-- Webhooks
CREATE INDEX IF NOT EXISTS idx_webhook_subs_tenant ON webhook_subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_webhook_subs_app ON webhook_subscriptions(app_id);
CREATE INDEX IF NOT EXISTS idx_webhook_subs_status ON webhook_subscriptions(status);

-- Outbox
CREATE INDEX IF NOT EXISTS idx_outbox_unpublished ON outbox_events(created_at) WHERE published_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_outbox_tenant ON outbox_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_outbox_type ON outbox_events(type);

-- Webhook Deliveries
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_pending ON webhook_deliveries(next_retry_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_subscription ON webhook_deliveries(subscription_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_event ON webhook_deliveries(event_id);

-- ============================================================================
-- Enhance existing audit_events table for API platform
-- ============================================================================

ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS app_id UUID;
ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS latency_ms INTEGER;
ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS diff_summary JSONB;

CREATE INDEX IF NOT EXISTS idx_audit_events_app_id ON audit_events(app_id) WHERE app_id IS NOT NULL;

-- ============================================================================
-- API Scopes Reference (informational)
-- ============================================================================
COMMENT ON TABLE apps IS 'Partner applications registered for API access.
Standard scopes:
  - patient.read, patient.write
  - appointment.read, appointment.write
  - encounter.read, encounter.write
  - document.read, document.write
  - medication.read, medication.write
  - admin.apps.manage
  - webhook.manage
  - ai.use
';
