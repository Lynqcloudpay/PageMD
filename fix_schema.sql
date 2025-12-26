-- Fix for documents table doc_type constraint
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_doc_type_check;
ALTER TABLE documents ADD CONSTRAINT documents_doc_type_check CHECK (doc_type = ANY (ARRAY['imaging', 'consult', 'lab', 'other', 'ekg', 'echo', 'stress_test', 'cardiac_cath', 'clinical_note', 'referral', 'superbill', 'consent', 'insurance', 'identification']));

-- Pharmacies Table
CREATE TABLE IF NOT EXISTS pharmacies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ncpdp_id VARCHAR(10) UNIQUE,
    npi VARCHAR(10),
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    fax VARCHAR(20),
    email VARCHAR(255),
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(50),
    zip VARCHAR(20),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    pharmacy_type VARCHAR(50),
    active BOOLEAN DEFAULT true,
    integration_enabled BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Prescriptions Table
CREATE TABLE IF NOT EXISTS prescriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    visit_id UUID REFERENCES visits(id) ON DELETE SET NULL,
    prescriber_id UUID NOT NULL REFERENCES users(id),
    prescriber_npi VARCHAR(10),
    prescriber_dea VARCHAR(20),
    medication_rxcui VARCHAR(20),
    medication_name VARCHAR(500) NOT NULL,
    medication_ndc VARCHAR(20),
    strength VARCHAR(100),
    quantity INTEGER NOT NULL,
    quantity_unit VARCHAR(20) DEFAULT 'EA',
    days_supply INTEGER,
    sig TEXT NOT NULL,
    sig_structured JSONB,
    refills INTEGER DEFAULT 0,
    refills_remaining INTEGER DEFAULT 0,
    substitution_allowed BOOLEAN DEFAULT true,
    pharmacy_id UUID REFERENCES pharmacies(id) ON DELETE SET NULL,
    pharmacy_ncpdp_id VARCHAR(10),
    pharmacy_name VARCHAR(255),
    pharmacy_address TEXT,
    pharmacy_phone VARCHAR(20),
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN (
      'draft', 'pending', 'sent', 'accepted', 'in_process',
      'ready', 'picked_up', 'expired', 'cancelled', 'denied'
    )),
    transmission_method VARCHAR(50),
    transmission_id VARCHAR(100),
    transmission_status VARCHAR(50),
    transmission_error TEXT,
    sent_at TIMESTAMP,
    received_at TIMESTAMP,
    filled_at TIMESTAMP,
    prior_auth_required BOOLEAN DEFAULT false,
    prior_auth_number VARCHAR(100),
    prior_auth_status VARCHAR(50),
    clinical_notes TEXT,
    patient_instructions TEXT,
    prescriber_notes TEXT,
    is_controlled BOOLEAN DEFAULT false,
    schedule VARCHAR(10),
    written_date DATE NOT NULL DEFAULT CURRENT_DATE,
    start_date DATE,
    end_date DATE,
    expires_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL REFERENCES users(id)
);

-- Indexes for prescriptions
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient ON prescriptions(patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prescriptions_status ON prescriptions(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prescriptions_prescriber ON prescriptions(prescriber_id, created_at DESC);
-- ICD-10 Support Migration

-- Enable trigram extension for fuzzy search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 1. Master Catalog
CREATE TABLE IF NOT EXISTS icd10_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(10) UNIQUE NOT NULL,
    description TEXT NOT NULL,
    is_billable BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    effective_date DATE,
    termination_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for icd10_codes
CREATE INDEX IF NOT EXISTS idx_icd10_codes_code ON icd10_codes (code);
CREATE INDEX IF NOT EXISTS idx_icd10_codes_description_fts ON icd10_codes USING GIN (to_tsvector('english', description));
CREATE INDEX IF NOT EXISTS idx_icd10_codes_description_trgm ON icd10_codes USING GIN (description gin_trgm_ops);

-- 2. Usage Tracking
CREATE TABLE IF NOT EXISTS icd10_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    icd10_id UUID REFERENCES icd10_codes(id) ON DELETE CASCADE,
    use_count INTEGER DEFAULT 1,
    last_used TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, icd10_id)
);

-- 3. Favorites
CREATE TABLE IF NOT EXISTS icd10_favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    icd10_id UUID REFERENCES icd10_codes(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, icd10_id)
);

-- 4. Specialty Tags (Optional but requested)
CREATE TABLE IF NOT EXISTS icd10_specialty_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    icd10_id UUID REFERENCES icd10_codes(id) ON DELETE CASCADE,
    specialty VARCHAR(50) NOT NULL,
    UNIQUE(icd10_id, specialty)
);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_icd10_codes_updated_at ON icd10_codes;
CREATE TRIGGER update_icd10_codes_updated_at
    BEFORE UPDATE ON icd10_codes
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- Admin Settings Tables
CREATE TABLE IF NOT EXISTS practice_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    practice_name VARCHAR(255) NOT NULL DEFAULT 'My Practice',
    practice_type VARCHAR(100),
    tax_id VARCHAR(50),
    npi VARCHAR(10),
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(50),
    zip VARCHAR(20),
    phone VARCHAR(20),
    fax VARCHAR(20),
    email VARCHAR(255),
    website VARCHAR(255),
    logo_url TEXT,
    timezone VARCHAR(50) DEFAULT 'America/New_York',
    date_format VARCHAR(20) DEFAULT 'MM/DD/YYYY',
    time_format VARCHAR(20) DEFAULT '12h',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID
);

CREATE TABLE IF NOT EXISTS clinical_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    default_note_template TEXT,
    require_dx_on_visit BOOLEAN DEFAULT true,
    require_vitals_on_visit BOOLEAN DEFAULT false,
    default_vitals_template JSONB,
    lab_result_retention_days INTEGER DEFAULT 2555,
    imaging_result_retention_days INTEGER DEFAULT 2555,
    document_retention_days INTEGER DEFAULT 2555,
    enable_clinical_alerts BOOLEAN DEFAULT true,
    enable_drug_interaction_check BOOLEAN DEFAULT true,
    enable_allergy_alerts BOOLEAN DEFAULT true,
    default_visit_duration_minutes INTEGER DEFAULT 15,
    enable_appointment_reminders BOOLEAN DEFAULT false,
    reminder_days_before INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID
);

CREATE TABLE IF NOT EXISTS feature_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feature_key VARCHAR(255) UNIQUE NOT NULL,
    enabled BOOLEAN DEFAULT false,
    description TEXT,
    category VARCHAR(100),
    requires_config BOOLEAN DEFAULT false,
    config_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID
);

-- Insert default practice settings if none exist
INSERT INTO practice_settings (practice_name, timezone, date_format, time_format)
SELECT 'myHEART Cardiology', 'America/New_York', 'MM/DD/YYYY', '12h'
WHERE NOT EXISTS (SELECT 1 FROM practice_settings);
