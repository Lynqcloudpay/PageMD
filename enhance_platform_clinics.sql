-- Migration to add advanced control and management fields to clinics
ALTER TABLE clinics 
ADD COLUMN IF NOT EXISTS emr_version VARCHAR(20) DEFAULT '1.0.0',
ADD COLUMN IF NOT EXISTS tenant_type VARCHAR(20) DEFAULT 'Solo' CHECK (tenant_type IN ('Solo', 'Group', 'Enterprise')),
ADD COLUMN IF NOT EXISTS go_live_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS compliance_zone VARCHAR(50) DEFAULT 'HIPAA',
ADD COLUMN IF NOT EXISTS is_read_only BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS billing_locked BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS prescribing_locked BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS region VARCHAR(50) DEFAULT 'US';

-- Add comments for clarity
COMMENT ON COLUMN clinics.is_read_only IS 'Environment kill switch: prevents any data modification';
COMMENT ON COLUMN clinics.billing_locked IS 'Kill switch: blocks claim submission and financial actions';
COMMENT ON COLUMN clinics.prescribing_locked IS 'Kill switch: disables e-prescribing capabilities';
