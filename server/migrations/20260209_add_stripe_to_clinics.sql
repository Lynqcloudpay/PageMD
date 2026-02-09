-- Migration: Add Stripe metadata to clinics table
-- Description: Stores Stripe customer and subscription IDs for platform billing integration

ALTER TABLE clinics 
ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS stripe_price_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS stripe_subscription_status VARCHAR(50),
ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMP,
ADD COLUMN IF NOT EXISTS billing_locked BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS last_payment_at TIMESTAMP;

-- Create indexes for Stripe lookups (webhooks use these)
CREATE INDEX IF NOT EXISTS idx_clinics_stripe_customer ON clinics(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_clinics_stripe_subscription ON clinics(stripe_subscription_id);

-- Platform billing events table for tracking payment history
CREATE TABLE IF NOT EXISTS platform_billing_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(id),
    stripe_event_id VARCHAR(255) UNIQUE,
    event_type VARCHAR(100),
    amount_total INTEGER,
    currency VARCHAR(3) DEFAULT 'usd',
    status VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_billing_events_clinic ON platform_billing_events(clinic_id);
CREATE INDEX IF NOT EXISTS idx_billing_events_created ON platform_billing_events(created_at DESC);
