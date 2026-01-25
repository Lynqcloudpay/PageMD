-- Clinic Onboarding & Integration Tables
-- For tenant-safe eFax/Lab routing

-- Fax number to tenant mapping
CREATE TABLE IF NOT EXISTS clinic_fax_numbers (
    id SERIAL PRIMARY KEY,
    tenant_id VARCHAR(100) NOT NULL,
    phone_number VARCHAR(20) UNIQUE NOT NULL,
    provider VARCHAR(50) DEFAULT 'telnyx', -- telnyx, phaxio
    label VARCHAR(100), -- "Main Office", "Referrals", etc.
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_fax_phone ON clinic_fax_numbers(phone_number);
CREATE INDEX IF NOT EXISTS idx_fax_tenant ON clinic_fax_numbers(tenant_id);

-- Lab interface configuration per tenant
CREATE TABLE IF NOT EXISTS clinic_lab_interfaces (
    id SERIAL PRIMARY KEY,
    tenant_id VARCHAR(100) NOT NULL,
    lab_name VARCHAR(100) NOT NULL, -- Quest Diagnostics, LabCorp, Hospital Lab
    facility_id VARCHAR(50), -- HL7 sending facility ID (MSH-4)
    account_number VARCHAR(50), -- Lab account number
    npi VARCHAR(10), -- Practice NPI for lab
    contact_name VARCHAR(100),
    contact_phone VARCHAR(20),
    status VARCHAR(20) DEFAULT 'pending', -- pending, submitted, active, inactive
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_lab_tenant ON clinic_lab_interfaces(tenant_id);
CREATE INDEX IF NOT EXISTS idx_lab_facility ON clinic_lab_interfaces(facility_id);

-- Clinic setup checklist (tracks onboarding progress)
CREATE TABLE IF NOT EXISTS clinic_setup_checklist (
    id SERIAL PRIMARY KEY,
    tenant_id VARCHAR(100) UNIQUE NOT NULL,
    
    -- Basic Setup
    basic_info_complete BOOLEAN DEFAULT false,
    basic_info_date TIMESTAMP,
    
    users_created BOOLEAN DEFAULT false,
    users_date TIMESTAMP,
    
    -- Integrations
    fax_configured BOOLEAN DEFAULT false,
    fax_date TIMESTAMP,
    fax_notes TEXT,
    
    quest_configured BOOLEAN DEFAULT false,
    quest_date TIMESTAMP,
    quest_notes TEXT,
    
    labcorp_configured BOOLEAN DEFAULT false,
    labcorp_date TIMESTAMP,
    labcorp_notes TEXT,
    
    -- Portal
    patient_portal_enabled BOOLEAN DEFAULT false,
    patient_portal_date TIMESTAMP,
    
    -- Billing
    billing_configured BOOLEAN DEFAULT false,
    billing_date TIMESTAMP,
    billing_notes TEXT,
    
    -- E-Prescribing
    eprescribe_configured BOOLEAN DEFAULT false,
    eprescribe_date TIMESTAMP,
    
    -- Overall
    onboarding_complete BOOLEAN DEFAULT false,
    onboarding_complete_date TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Trigger to create checklist when tenant is created
CREATE OR REPLACE FUNCTION create_clinic_checklist()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO clinic_setup_checklist (tenant_id) 
    VALUES (NEW.slug)
    ON CONFLICT (tenant_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Note: If you have a tenants table, add this trigger:
-- DROP TRIGGER IF EXISTS trg_create_checklist ON tenants;
-- CREATE TRIGGER trg_create_checklist AFTER INSERT ON tenants
-- FOR EACH ROW EXECUTE FUNCTION create_clinic_checklist();
