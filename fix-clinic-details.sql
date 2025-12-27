-- 1. Add missing columns to existing tables
ALTER TABLE clinic_subscriptions 
ADD COLUMN IF NOT EXISTS billing_cycle VARCHAR(20) DEFAULT 'monthly';

ALTER TABLE subscription_plans 
ADD COLUMN IF NOT EXISTS price_yearly DECIMAL(10, 2);

-- Update yearly price as 10x monthly (2 months free)
UPDATE subscription_plans SET price_yearly = price_monthly * 10 WHERE price_yearly IS NULL;

-- 2. Create clinic_usage_metrics table
CREATE TABLE IF NOT EXISTS clinic_usage_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
    metric_date DATE DEFAULT CURRENT_DATE,
    active_patients INTEGER DEFAULT 0,
    total_visits INTEGER DEFAULT 0,
    storage_used_mb DECIMAL(10, 2) DEFAULT 0,
    api_calls INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(clinic_id, metric_date)
);

CREATE INDEX IF NOT EXISTS idx_usage_clinic ON clinic_usage_metrics(clinic_id);
CREATE INDEX IF NOT EXISTS idx_usage_date ON clinic_usage_metrics(metric_date);
