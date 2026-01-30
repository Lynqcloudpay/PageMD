-- Add price_level to fee_schedule
ALTER TABLE fee_schedule ADD COLUMN IF NOT EXISTS price_level VARCHAR(50) DEFAULT 'Standard';

-- Update Unique Constraint to include price_level
ALTER TABLE fee_schedule DROP CONSTRAINT IF EXISTS fee_schedule_code_type_code_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_fee_schedule_code_price ON fee_schedule (code_type, code, price_level);

-- Insert CY 2025 Codes
INSERT INTO fee_schedule (code_type, code, description, fee_amount, price_level)
VALUES 
    ('HCPCS', 'G0556', 'Advanced Primary Care Management (APCM) Level 1', 50.00, 'Standard'),
    ('HCPCS', 'G0557', 'Advanced Primary Care Management (APCM) Level 2', 75.00, 'Standard'),
    ('HCPCS', 'G0558', 'Advanced Primary Care Management (APCM) Level 3', 100.00, 'Standard'),
    ('CPT', '99424', 'Safety Planning Interventions (first 20 min)', 80.00, 'Standard'),
    ('CPT', '99425', 'Safety Planning Interventions (addl 20 min)', 40.00, 'Standard'),
    ('CPT', '99426', 'Caregiver Training Services (CTS) first 30 min', 60.00, 'Standard'),
    ('CPT', '99427', 'Caregiver Training Services (CTS) addl 15 min', 30.00, 'Standard')
ON CONFLICT (code_type, code, price_level) DO NOTHING;
