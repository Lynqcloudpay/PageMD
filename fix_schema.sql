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
