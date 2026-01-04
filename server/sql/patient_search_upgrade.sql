-- Add phone_normalized column if it doesn't exist
ALTER TABLE patients ADD COLUMN IF NOT EXISTS phone_normalized TEXT;

-- Update phone_normalized with digits from existing phone columns
UPDATE patients SET phone_normalized = regexp_replace(COALESCE(phone, phone_cell, phone_secondary, ''), '\D', '', 'g')
WHERE phone_normalized IS NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_patients_clinic_mrn ON patients(clinic_id, mrn);
CREATE INDEX IF NOT EXISTS idx_patients_clinic_dob ON patients(clinic_id, dob);
CREATE INDEX IF NOT EXISTS idx_patients_clinic_phone_norm ON patients(clinic_id, phone_normalized);
CREATE INDEX IF NOT EXISTS idx_patients_clinic_last_name ON patients(clinic_id, last_name);
CREATE INDEX IF NOT EXISTS idx_patients_clinic_first_name ON patients(clinic_id, first_name);

-- Trigram index for fuzzy name search
-- Note: using COALESCE to avoid nulls breaking the index
CREATE INDEX IF NOT EXISTS idx_patients_name_trgm ON patients USING gin ((lower(COALESCE(first_name, '')) || ' ' || lower(COALESCE(last_name, ''))) gin_trgm_ops);
