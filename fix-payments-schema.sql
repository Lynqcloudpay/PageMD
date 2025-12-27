-- Payment History
CREATE TABLE IF NOT EXISTS payment_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID REFERENCES clinics(id) ON DELETE SET NULL,
    invoice_id VARCHAR(100), -- from Stripe or external system
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    status VARCHAR(50) DEFAULT 'completed', -- pending, completed, failed, refunded
    payment_method VARCHAR(50), -- card, bank_transfer
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payments_clinic ON payment_history(clinic_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payment_history(paid_at);
