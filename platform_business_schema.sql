-- Platform Business Management Schema
-- Extends the Control Database with subscription, billing, and support tracking.

-- 1. Subscription Plans
CREATE TABLE IF NOT EXISTS subscription_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,                  -- e.g., "Starter", "Professional", "Enterprise"
    description TEXT,
    price_monthly DECIMAL(10,2),
    price_yearly DECIMAL(10,2),
    max_providers INTEGER,                       -- Provider seat limit
    max_patients INTEGER,                        -- Patient limit (NULL = unlimited)
    max_storage_gb INTEGER,                      -- Storage limit
    features JSONB DEFAULT '{}',                 -- Feature flags
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Clinic Subscriptions
CREATE TABLE IF NOT EXISTS clinic_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES subscription_plans(id),
    status VARCHAR(20) DEFAULT 'active',         -- active, past_due, suspended, cancelled
    billing_cycle VARCHAR(20) DEFAULT 'monthly', -- monthly, yearly
    current_period_start DATE,
    current_period_end DATE,
    trial_end_date DATE,
    auto_renew BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Payment History
CREATE TABLE IF NOT EXISTS payment_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES clinic_subscriptions(id),
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    status VARCHAR(20) DEFAULT 'completed',      -- completed, failed, refunded, pending
    payment_method VARCHAR(50),                  -- stripe, paypal, invoice, etc.
    transaction_id VARCHAR(255),                 -- External payment processor ID
    description TEXT,
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Support Tickets
CREATE TABLE IF NOT EXISTS support_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
    subject VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'open',           -- open, in_progress, resolved, closed
    priority VARCHAR(20) DEFAULT 'normal',       -- low, normal, high, urgent
    category VARCHAR(50),                        -- technical, billing, feature_request, etc.
    assigned_to UUID,                            -- Super admin user ID
    created_by_email VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- 5. Clinic Usage Metrics (for monitoring and billing)
CREATE TABLE IF NOT EXISTS clinic_usage_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
    metric_date DATE NOT NULL,
    active_providers INTEGER DEFAULT 0,
    total_patients INTEGER DEFAULT 0,
    new_patients INTEGER DEFAULT 0,
    total_visits INTEGER DEFAULT 0,
    storage_used_gb DECIMAL(10,2) DEFAULT 0,
    api_calls INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(clinic_id, metric_date)
);

-- 6. Audit Log for Platform Actions
CREATE TABLE IF NOT EXISTS platform_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    super_admin_id UUID,
    action VARCHAR(100) NOT NULL,                -- e.g., 'clinic_suspended', 'subscription_updated'
    target_clinic_id UUID REFERENCES clinics(id) ON DELETE SET NULL,
    details JSONB DEFAULT '{}',
    ip_address INET,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add subscription and billing fields to clinics table
ALTER TABLE clinics 
ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(20) DEFAULT 'trial',  -- trial, active, past_due, suspended, cancelled
ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS billing_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS total_providers INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_patients INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS notes TEXT;  -- Internal notes for support team

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_clinic_subscriptions_clinic ON clinic_subscriptions(clinic_id);
CREATE INDEX IF NOT EXISTS idx_clinic_subscriptions_status ON clinic_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_payment_history_clinic ON payment_history(clinic_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_clinic ON support_tickets(clinic_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_usage_metrics_clinic_date ON clinic_usage_metrics(clinic_id, metric_date);

-- Triggers for updated_at
CREATE TRIGGER update_clinic_subscriptions_updated_at
    BEFORE UPDATE ON clinic_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_support_tickets_updated_at
    BEFORE UPDATE ON support_tickets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Seed default subscription plans
INSERT INTO subscription_plans (name, description, price_monthly, price_yearly, max_providers, max_patients, features)
VALUES 
    ('Trial', '30-day free trial', 0, 0, 2, 100, '{"support": "email"}'),
    ('Starter', 'Perfect for small practices', 99, 950, 3, 500, '{"support": "email", "backups": "weekly"}'),
    ('Professional', 'For growing practices', 299, 2990, 10, 2000, '{"support": "priority", "backups": "daily", "advanced_reporting": true}'),
    ('Enterprise', 'Unlimited scale', 799, 7990, NULL, NULL, '{"support": "24/7", "backups": "realtime", "advanced_reporting": true, "custom_integrations": true}')
ON CONFLICT DO NOTHING;
