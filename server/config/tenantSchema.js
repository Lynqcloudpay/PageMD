/**
 * Complete Tenant Schema Template
 * This file contains the complete database schema that should be created
 * for every new clinic tenant.
 * 
 * Based on the original migrate.js but adapted for tenant schemas.
 */

const tenantSchemaSQL = `
-- ============================================
-- ROLES & RBAC TABLES
-- ============================================

CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    is_system_role BOOLEAN DEFAULT false,
    source_template_id UUID, -- Links to platform_role_templates for governance
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO roles (name, description, is_system_role) VALUES 
    ('Admin', 'Clinic Administrator with full access', true),
    ('Physician', 'Licensed physician with full clinical privileges', true),
    ('Nurse Practitioner', 'Nurse practitioner with clinical privileges', true),
    ('Physician Assistant', 'Physician assistant with clinical privileges', true),
    ('Nurse', 'Registered nurse or licensed practical nurse', true),
    ('Medical Assistant', 'Medical assistant supporting clinical workflow', true),
    ('Front Desk', 'Front desk and scheduling staff', true),
    ('Billing Specialist', 'Billing and insurance coordination', true),
    ('staff', 'Clinic Staff (General)', true)
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS privileges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    category VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert all default privileges
INSERT INTO privileges (name, description, category) VALUES
    ('document_visit', 'Document patient visits', 'clinical'),
    ('sign_notes', 'Sign and finalize visit notes', 'clinical'),
    ('view_labs', 'View laboratory results', 'clinical'),
    ('order_labs', 'Order laboratory tests', 'clinical'),
    ('view_imaging', 'View imaging studies', 'clinical'),
    ('order_imaging', 'Order imaging studies', 'clinical'),
    ('enter_vitals', 'Enter patient vital signs', 'clinical'),
    ('view_patients', 'View patient records', 'clinical'),
    ('edit_patients', 'Edit patient information', 'clinical'),
    ('e_prescribe', 'Create and send electronic prescriptions', 'clinical'),
    ('create_referrals', 'Create referral orders', 'clinical'),
    ('view_medications', 'View patient medications', 'clinical'),
    ('manage_problems', 'Manage problem list', 'clinical'),
    ('manage_allergies', 'Manage allergies', 'clinical'),
    ('search_icd10', 'Search ICD-10 diagnosis codes', 'clinical'),
    ('search_cpt', 'Search CPT procedure codes', 'clinical'),
    ('create_superbill', 'Create superbills', 'billing'),
    ('manage_claims', 'Manage insurance claims', 'billing'),
    ('view_billing', 'View billing information', 'billing'),
    ('financial_reports', 'Access financial reports', 'billing'),
    ('manage_users', 'Create, edit, and delete users', 'admin'),
    ('manage_roles', 'Manage roles and privileges', 'admin'),
    ('view_audit_logs', 'View system audit logs', 'admin'),
    ('system_settings', 'Modify system settings', 'admin'),
    ('promote_to_admin', 'Promote users to admin', 'admin'),
    ('register_patients', 'Register new patients', 'patient_access'),
    ('schedule_appointments', 'Schedule patient appointments', 'patient_access'),
    ('upload_documents', 'Upload patient documents', 'patient_access'),
    ('send_messages', 'Send internal messages', 'workflow'),
    ('assign_tasks', 'Assign tasks to users', 'workflow'),
    ('view_messages', 'View messages', 'workflow')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS role_privileges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    privilege_id UUID NOT NULL REFERENCES privileges(id) ON DELETE CASCADE,
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    granted_by UUID,
    UNIQUE(role_id, privilege_id)
);

-- Assign all privileges to admin role
INSERT INTO role_privileges (role_id, privilege_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN privileges p
WHERE r.name = 'admin'
ON CONFLICT (role_id, privilege_id) DO NOTHING;

-- ============================================
-- USERS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(50),
    role_id UUID REFERENCES roles(id),
    is_admin BOOLEAN DEFAULT false,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'inactive')),
    active BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    date_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    professional_type VARCHAR(50),
    npi VARCHAR(10),
    license_number VARCHAR(100),
    license_state VARCHAR(2),
    dea_number VARCHAR(20),
    taxonomy_code VARCHAR(10),
    credentials VARCHAR(50),
    phone VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ============================================
-- PATIENTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mrn VARCHAR(50) UNIQUE NOT NULL,
    first_name TEXT NOT NULL,
    middle_name TEXT,
    last_name TEXT NOT NULL,
    preferred_name TEXT,
    name_prefix VARCHAR(50),
    name_suffix TEXT,
    previous_name VARCHAR(255),
    dob DATE NOT NULL,
    date_of_birth DATE,
    sex VARCHAR(10) CHECK (sex IN ('M', 'F', 'Other')),
    gender VARCHAR(50),
    ssn_encrypted TEXT,
    phone TEXT,
    phone_cell TEXT,
    phone_home TEXT,
    phone_work TEXT,
    phone_preferred TEXT,
    communication_preference VARCHAR(50),
    phone_secondary TEXT,
    email TEXT,
    email_secondary TEXT,
    address_line1 TEXT,
    address_line2 TEXT,
    city TEXT,
    state TEXT,
    zip TEXT,
    country TEXT DEFAULT 'United States',
    address_type VARCHAR(50) DEFAULT 'Home',
    primary_care_provider UUID REFERENCES users(id),
    interpreter_needed BOOLEAN DEFAULT FALSE,
    consent_to_text BOOLEAN DEFAULT FALSE,
    consent_to_email BOOLEAN DEFAULT FALSE,
    employer_name VARCHAR(255),
    employment_status VARCHAR(100),
    occupation VARCHAR(255),
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    emergency_contact_relationship VARCHAR(100),
    emergency_contact_address TEXT,
    emergency_contact_2_name VARCHAR(255),
    emergency_contact_2_phone TEXT,
    emergency_contact_2_relationship VARCHAR(100),
    insurance_provider VARCHAR(255),
    insurance_id TEXT,
    insurance_group_number VARCHAR(100),
    insurance_member_id VARCHAR(100),
    insurance_plan_name VARCHAR(255),
    insurance_plan_type VARCHAR(100),
    insurance_subscriber_name TEXT,
    insurance_subscriber_dob DATE,
    insurance_subscriber_relationship VARCHAR(100),
    insurance_copay VARCHAR(100),
    insurance_effective_date DATE,
    insurance_expiry_date DATE,
    insurance_notes TEXT,
    pharmacy_name VARCHAR(255),
    pharmacy_address TEXT,
    pharmacy_phone TEXT,
    pharmacy_npi TEXT,
    pharmacy_fax TEXT,
    pharmacy_preferred BOOLEAN DEFAULT FALSE,
    photo_url TEXT,
    preferred_language VARCHAR(50),
    ethnicity VARCHAR(100),
    race VARCHAR(100),
    marital_status VARCHAR(50),
    referral_source VARCHAR(255),
    allergies_known BOOLEAN DEFAULT FALSE,
    notes TEXT,
    clinic_id UUID,
    encryption_metadata JSONB,
    deceased BOOLEAN DEFAULT FALSE,
    deceased_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_patients_mrn ON patients(mrn);
CREATE INDEX IF NOT EXISTS idx_patients_name ON patients(last_name, first_name);


-- ============================================
-- CLINICAL TABLES
-- ============================================

CREATE TABLE IF NOT EXISTS allergies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    allergen VARCHAR(255) NOT NULL,
    reaction VARCHAR(255),
    severity VARCHAR(50),
    onset_date DATE,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS medications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    medication_name VARCHAR(255) NOT NULL,
    dosage VARCHAR(100),
    frequency VARCHAR(100),
    route VARCHAR(50),
    start_date DATE,
    end_date DATE,
    active BOOLEAN DEFAULT true,
    status VARCHAR(50) DEFAULT 'active',
    instructions TEXT,
    notes TEXT,
    clinic_id UUID,
    prescriber_id UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS problems (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    problem_name VARCHAR(255) NOT NULL,
    icd10_code VARCHAR(20),
    onset_date DATE,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'inactive')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS family_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    condition VARCHAR(255) NOT NULL,
    relationship VARCHAR(100) NOT NULL,
    age_at_diagnosis INTEGER,
    age_at_death INTEGER,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS social_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    smoking_status VARCHAR(50),
    smoking_pack_years DECIMAL(5,2),
    alcohol_use VARCHAR(50),
    alcohol_quantity VARCHAR(100),
    drug_use VARCHAR(50),
    exercise_frequency VARCHAR(100),
    diet VARCHAR(100),
    occupation VARCHAR(255),
    living_situation VARCHAR(255),
    marital_status VARCHAR(50),
    education_level VARCHAR(100),
    employment_status VARCHAR(100),
    physical_activity VARCHAR(255),
    diet_notes TEXT,
    sleep_hours_per_night INTEGER,
    caffeine_use VARCHAR(255),
    stress_level VARCHAR(50),
    social_support TEXT,
    travel_history TEXT,
    pets TEXT,
    hobbies TEXT,
    safety_concerns TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- VISITS/ENCOUNTERS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS visits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    visit_date TIMESTAMP NOT NULL,
    visit_type VARCHAR(50),
    provider_id UUID NOT NULL REFERENCES users(id),
    vitals JSONB,
    note_draft TEXT,
    note_signed_by UUID REFERENCES users(id),
    note_signed_at TIMESTAMP,
    addendums JSONB,
    locked BOOLEAN DEFAULT false,
    status VARCHAR(50) DEFAULT 'draft',
    encounter_date DATE,
    note_type VARCHAR(100),
    clinic_id UUID,
    last_level_billed INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_visits_patient ON visits(patient_id);
CREATE INDEX IF NOT EXISTS idx_visits_date ON visits(visit_date DESC);

-- ============================================
-- ORDERS & DIAGNOSTICS
-- ============================================

CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    visit_id UUID REFERENCES visits(id),
    order_type VARCHAR(50) NOT NULL CHECK (order_type IN ('lab', 'imaging', 'rx', 'referral')),
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'completed', 'cancelled')),
    ordered_by UUID NOT NULL REFERENCES users(id),
    order_payload JSONB,
    external_order_id VARCHAR(255),
    test_name VARCHAR(255),
    test_code VARCHAR(50),
    result_value TEXT,
    result_units VARCHAR(50),
    reference_range VARCHAR(100),
    abnormal_flags VARCHAR(10),
    completed_at TIMESTAMP,
    external_id VARCHAR(255),
    reviewed BOOLEAN DEFAULT false,
    reviewed_at TIMESTAMP,
    reviewed_by UUID REFERENCES users(id),
    comment TEXT,
    comments JSONB DEFAULT '[]'::jsonb,
    clinic_id UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_sets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    items JSONB DEFAULT '[]',
    created_by UUID,
    clinic_id UUID,
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_orders_patient ON orders(patient_id);

CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    visit_id UUID REFERENCES visits(id),
    uploader_id UUID NOT NULL REFERENCES users(id),
    doc_type VARCHAR(50) CHECK (doc_type IN ('imaging', 'consult', 'lab', 'other')),
    filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    mime_type VARCHAR(100),
    file_size BIGINT,
    tags TEXT[],
    reviewed BOOLEAN DEFAULT false,
    reviewed_at TIMESTAMP,
    reviewed_by UUID REFERENCES users(id),
    comment TEXT,
    comments JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_documents_patient ON documents(patient_id);

CREATE TABLE IF NOT EXISTS referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    visit_id UUID REFERENCES visits(id),
    created_by UUID NOT NULL REFERENCES users(id),
    recipient_name VARCHAR(255),
    recipient_specialty VARCHAR(100),
    recipient_address TEXT,
    reason TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'completed', 'cancelled')),
    referral_letter TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- MESSAGING & WORKFLOW
-- ============================================

CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    from_user_id UUID NOT NULL REFERENCES users(id),
    to_user_id UUID REFERENCES users(id),
    subject VARCHAR(255),
    body TEXT NOT NULL,
    message_type VARCHAR(50) DEFAULT 'message' CHECK (message_type IN ('message', 'task')),
    task_status VARCHAR(50) DEFAULT 'open' CHECK (task_status IN ('open', 'in_progress', 'completed')),
    priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    read_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- APPOINTMENTS
-- ============================================

CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    provider_id UUID NOT NULL REFERENCES users(id),
    appointment_date DATE NOT NULL,
    appointment_time TIME NOT NULL,
    duration INTEGER DEFAULT 30,
    appointment_type VARCHAR(50) DEFAULT 'Follow-up' CHECK (appointment_type IN ('Follow-up', 'New Patient', 'Sick Visit', 'Physical')),
    status VARCHAR(50) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'checked-in', 'in-progress', 'completed', 'cancelled', 'no-show')),
    notes TEXT,
    created_by UUID NOT NULL REFERENCES users(id),
    clinic_id UUID,
    patient_status VARCHAR(50) DEFAULT 'scheduled',
    room_sub_status VARCHAR(50),
    current_room VARCHAR(20),
    arrival_time TIMESTAMP,
    checkout_time TIMESTAMP,
    cancellation_reason TEXT,
    status_history JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- AUDIT & SESSION TABLES
-- ============================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(50),
    target_id UUID,
    entity_type VARCHAR(50),
    entity_id UUID,
    ip_address VARCHAR(45),
    actor_ip VARCHAR(45),
    user_agent TEXT,
    actor_user_agent TEXT,
    outcome VARCHAR(20),
    request_id VARCHAR(50),
    session_id VARCHAR(50),
    details JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON audit_logs(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);

CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    expires_at TIMESTAMP NOT NULL,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- ============================================
-- BILLING TABLES
-- ============================================

CREATE TABLE IF NOT EXISTS fee_schedule (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code_type VARCHAR(20) NOT NULL CHECK (code_type IN ('CPT', 'HCPCS', 'ICD10')),
    code VARCHAR(50) NOT NULL,
    description TEXT,
    fee_amount DECIMAL(10, 2),
    price_level VARCHAR(20) DEFAULT 'Standard',
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(code_type, code, price_level)
);

CREATE TABLE IF NOT EXISTS billing_modifiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(5) NOT NULL UNIQUE,
    description TEXT,
    is_standard BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fee_schedule_code ON fee_schedule(code_type, code);

CREATE TABLE IF NOT EXISTS claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    encounter_id UUID NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
    version INTEGER NOT NULL DEFAULT 1,
    payer_id UUID, -- References insurance_policies or similar
    status INTEGER DEFAULT 0,
    payer_type INTEGER DEFAULT 0,
    bill_process INTEGER DEFAULT 0,
    bill_time TIMESTAMP,
    process_time TIMESTAMP,
    process_file VARCHAR(255),
    target VARCHAR(30),
    x12_partner_id INTEGER,
    submitted_claim TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(patient_id, encounter_id, version)
);

CREATE TABLE IF NOT EXISTS x12_partners (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    id_number VARCHAR(255),
    x12_sender_id VARCHAR(255),
    x12_receiver_id VARCHAR(255),
    processing_format VARCHAR(50),
    x12_isa01 VARCHAR(2) DEFAULT '00',
    x12_isa02 VARCHAR(10) DEFAULT '          ',
    x12_isa03 VARCHAR(2) DEFAULT '00',
    x12_isa04 VARCHAR(10) DEFAULT '          ',
    x12_isa05 CHAR(2) DEFAULT 'ZZ',
    x12_isa07 CHAR(2) DEFAULT 'ZZ',
    x12_isa14 CHAR(1) DEFAULT '0',
    x12_isa15 CHAR(1) DEFAULT 'P',
    x12_gs02 VARCHAR(15),
    x12_gs03 VARCHAR(15),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_claims_patient ON claims(patient_id);
CREATE INDEX IF NOT EXISTS idx_claims_visit ON claims(encounter_id);

CREATE TABLE IF NOT EXISTS insurance_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    payer_id VARCHAR(50),
    plan_type VARCHAR(50),
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- CLINICAL DECISION SUPPORT
-- ============================================

CREATE TABLE IF NOT EXISTS clinical_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    alert_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) DEFAULT 'normal' CHECK (severity IN ('low', 'normal', 'high', 'critical')),
    message TEXT NOT NULL,
    rule_name VARCHAR(100),
    active BOOLEAN DEFAULT true,
    acknowledged_by UUID REFERENCES users(id),
    acknowledged_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_clinical_alerts_patient ON clinical_alerts(patient_id);
CREATE INDEX IF NOT EXISTS idx_clinical_alerts_active ON clinical_alerts(active, severity);

CREATE TABLE IF NOT EXISTS lab_reference_ranges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_name VARCHAR(255) NOT NULL,
    test_code VARCHAR(50),
    age_min INTEGER,
    age_max INTEGER,
    sex VARCHAR(10),
    normal_min DECIMAL(10, 2),
    normal_max DECIMAL(10, 2),
    units VARCHAR(50),
    critical_low DECIMAL(10, 2),
    critical_high DECIMAL(10, 2),
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- SETTINGS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(255) UNIQUE NOT NULL,
    value TEXT,
    description TEXT,
    category VARCHAR(100),
    is_public BOOLEAN DEFAULT false,
    updated_by UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- ENCRYPTION KEYS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS encryption_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_id VARCHAR(255),
    key_type VARCHAR(50) NOT NULL,
    key_version INTEGER DEFAULT 1,
    dek_encrypted TEXT,
    encrypted_key TEXT NOT NULL,
    algorithm VARCHAR(50) DEFAULT 'AES-256-GCM',
    is_active BOOLEAN DEFAULT TRUE,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    rotated_at TIMESTAMP
);

-- Insert dummy encryption key
INSERT INTO encryption_keys (key_id, key_type, encrypted_key, dek_encrypted, key_version, is_active, active, algorithm)
VALUES ('master-key-1', 'DEK', 'dummy_encrypted_key_placeholder', 'dummy_encrypted_key_placeholder', 1, TRUE, TRUE, 'AES-256-GCM')
ON CONFLICT DO NOTHING;

-- ============================================
-- CANCELLATION FOLLOWUPS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS cancellation_followups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id UUID,
    patient_id UUID REFERENCES patients(id),
    provider_id UUID REFERENCES users(id),
    status VARCHAR(50) DEFAULT 'pending',
    reason TEXT,
    addressed_by UUID REFERENCES users(id),
    addressed_at TIMESTAMP,
    dismissed_by UUID REFERENCES users(id),
    dismissed_at TIMESTAMP,
    dismiss_reason TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cancellation_followup_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    followup_id UUID NOT NULL,
    note TEXT NOT NULL,
    note_type VARCHAR(50) DEFAULT 'general',
    created_by UUID,
    created_by_name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- ADDITIONAL SETTINGS TABLES
-- ============================================

CREATE TABLE IF NOT EXISTS practice_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    practice_name VARCHAR(255),
    practice_type VARCHAR(100),
    tax_id VARCHAR(50),
    npi VARCHAR(20),
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(50),
    zip VARCHAR(20),
    phone VARCHAR(20),
    fax VARCHAR(20),
    email VARCHAR(255),
    website VARCHAR(255),
    logo_url TEXT DEFAULT 'data:image/svg+xml,%3Csvg xmlns=''http://www.w3.org/2000/svg'' width=''200'' height=''200'' viewBox=''0 0 200 200''%3E%3Crect width=''200'' height=''200'' fill=''%23f8fafc'' rx=''8''/%3E%3Crect x=''60'' y=''45'' width=''80'' height=''90'' fill=''none'' stroke=''%23cbd5e1'' stroke-width=''3'' rx=''4''/%3E%3Crect x=''75'' y=''60'' width=''20'' height=''15'' fill=''%23cbd5e1'' rx=''2''/%3E%3Crect x=''105'' y=''60'' width=''20'' height=''15'' fill=''%23cbd5e1'' rx=''2''/%3E%3Crect x=''75'' y=''85'' width=''20'' height=''15'' fill=''%23cbd5e1'' rx=''2''/%3E%3Crect x=''105'' y=''85'' width=''20'' height=''15'' fill=''%23cbd5e1'' rx=''2''/%3E%3Crect x=''88'' y=''110'' width=''24'' height=''25'' fill=''%23cbd5e1'' rx=''2''/%3E%3Ctext x=''100'' y=''165'' text-anchor=''middle'' font-family=''Arial,sans-serif'' font-size=''14'' font-weight=''600'' fill=''%2394a3b8''%3ENO LOGO%3C/text%3E%3C/svg%3E',
    timezone VARCHAR(50) DEFAULT 'America/New_York',
    date_format VARCHAR(20) DEFAULT 'MM/DD/YYYY',
    time_format VARCHAR(10) DEFAULT '12h',
    default_price_level VARCHAR(20) DEFAULT 'Standard',
    updated_by UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS security_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    password_min_length INTEGER DEFAULT 8,
    password_require_uppercase BOOLEAN DEFAULT TRUE,
    password_require_lowercase BOOLEAN DEFAULT TRUE,
    password_require_number BOOLEAN DEFAULT TRUE,
    password_require_special BOOLEAN DEFAULT TRUE,
    session_timeout_minutes INTEGER DEFAULT 30,
    max_login_attempts INTEGER DEFAULT 5,
    lockout_duration_minutes INTEGER DEFAULT 15,
    require_2fa BOOLEAN DEFAULT FALSE,
    require_2fa_for_admin BOOLEAN DEFAULT FALSE,
    inactivity_timeout_minutes INTEGER DEFAULT 15,
    audit_log_retention_days INTEGER DEFAULT 365,
    ip_whitelist TEXT,
    updated_by UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS clinical_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    require_dx_on_visit BOOLEAN DEFAULT TRUE,
    require_vitals_on_visit BOOLEAN DEFAULT FALSE,
    enable_clinical_alerts BOOLEAN DEFAULT TRUE,
    enable_drug_interaction_check BOOLEAN DEFAULT TRUE,
    enable_allergy_alerts BOOLEAN DEFAULT TRUE,
    default_visit_duration_minutes INTEGER DEFAULT 15,
    updated_by UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS email_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    smtp_host VARCHAR(255),
    smtp_port INTEGER,
    smtp_secure BOOLEAN DEFAULT TRUE,
    smtp_username VARCHAR(255),
    smtp_password VARCHAR(255),
    from_name VARCHAR(255),
    from_email VARCHAR(255),
    reply_to_email VARCHAR(255),
    enabled BOOLEAN DEFAULT FALSE,
    test_email VARCHAR(255),
    updated_by UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS feature_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feature_key VARCHAR(100),
    category VARCHAR(100),
    enabled BOOLEAN DEFAULT FALSE,
    config_data JSONB,
    updated_by UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(feature_key)
);

-- ============================================
-- SUPERBILL SYSTEM (Commercial Grade)
-- ============================================

DO $$ BEGIN
    CREATE TYPE superbill_status AS ENUM ('DRAFT', 'READY', 'FINALIZED', 'VOID');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    tax_id VARCHAR(50),
    npi VARCHAR(10),
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(50),
    zip VARCHAR(20),
    phone VARCHAR(20),
    email VARCHAR(255),
    billing_contact_name VARCHAR(255),
    billing_contact_phone VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id),
    name VARCHAR(255) NOT NULL,
    npi VARCHAR(10),
    pos_code VARCHAR(10) DEFAULT '11',
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(50),
    zip VARCHAR(20),
    phone VARCHAR(20),
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payer_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payer_name VARCHAR(255) NOT NULL,
    payer_id VARCHAR(50), 
    plan_type VARCHAR(50),
    address_line1 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(50),
    zip VARCHAR(20),
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- ============================================
-- FEE SHEET CATEGORIES (OpenEMR Feature)
-- Quick-access code groups like "New Patient", "Established Patient"
-- ============================================

CREATE TABLE IF NOT EXISTS fee_sheet_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fee_sheet_category_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES fee_sheet_categories(id) ON DELETE CASCADE,
    code_type VARCHAR(20) NOT NULL CHECK (code_type IN ('CPT', 'HCPCS', 'ICD10')),
    code VARCHAR(20) NOT NULL,
    description TEXT,
    default_modifier VARCHAR(20),
    default_units INTEGER DEFAULT 1,
    default_fee DECIMAL(12, 2),
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(category_id, code_type, code)
);

CREATE INDEX IF NOT EXISTS idx_fee_sheet_categories_active ON fee_sheet_categories(is_active, display_order);
CREATE INDEX IF NOT EXISTS idx_fee_sheet_category_codes_category ON fee_sheet_category_codes(category_id);

CREATE TABLE IF NOT EXISTS superbills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    visit_id UUID NOT NULL UNIQUE REFERENCES visits(id) ON DELETE CASCADE,
    note_id UUID,
    status superbill_status DEFAULT 'DRAFT',
    version INTEGER DEFAULT 1,
    service_date_from DATE NOT NULL,

    service_date_to DATE NOT NULL,
    place_of_service VARCHAR(10) NOT NULL DEFAULT '11',
    claim_frequency_code VARCHAR(1) DEFAULT '1',
    referring_provider_id UUID REFERENCES users(id),
    rendering_provider_id UUID NOT NULL REFERENCES users(id),
    billing_provider_id UUID NOT NULL REFERENCES users(id),
    facility_location_id UUID REFERENCES locations(id),
    insurance_policy_id UUID REFERENCES payer_policies(id),
    insurance_provider_override VARCHAR(255),
    insurance_id_override VARCHAR(100),
    authorization_number VARCHAR(100),
    billing_notes TEXT,
    denial_reason TEXT,
    resubmission_count INT DEFAULT 0,
    claim_status VARCHAR(20) CHECK (claim_status IN ('PENDING', 'SUBMITTED', 'PAID', 'DENIED', 'ADJUSTED')),
    accident_related_employment BOOLEAN DEFAULT false,
    accident_related_auto BOOLEAN DEFAULT false,
    accident_related_other BOOLEAN DEFAULT false,
    accident_state VARCHAR(2),
    accident_date DATE,
    total_charges DECIMAL(12, 2) DEFAULT 0.00,
    total_units INTEGER DEFAULT 0,
    paid_amount DECIMAL(10, 2),
    finalized_at TIMESTAMP,
    finalized_by UUID REFERENCES users(id),
    voided_at TIMESTAMP,
    voided_by UUID REFERENCES users(id),
    void_reason TEXT,
    ready_at TIMESTAMP,
    ready_by UUID REFERENCES users(id),
    previous_version_id UUID REFERENCES superbills(id),
    revision_reason TEXT,
    submitted_at TIMESTAMP,
    paid_at TIMESTAMP,
    created_by UUID NOT NULL REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS superbill_diagnoses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    superbill_id UUID NOT NULL REFERENCES superbills(id) ON DELETE CASCADE,
    icd10_code VARCHAR(20) NOT NULL,
    description TEXT,
    sequence INTEGER NOT NULL,
    source VARCHAR(50) DEFAULT 'MANUAL',
    present_on_admission BOOLEAN,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(superbill_id, icd10_code),
    UNIQUE(superbill_id, sequence)
);

CREATE TABLE IF NOT EXISTS superbill_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    superbill_id UUID NOT NULL REFERENCES superbills(id) ON DELETE CASCADE,
    cpt_code VARCHAR(10) NOT NULL,
    description TEXT,
    modifier1 VARCHAR(5),
    modifier2 VARCHAR(5),
    modifier3 VARCHAR(5),
    modifier4 VARCHAR(5),
    units INTEGER NOT NULL DEFAULT 1,
    charge DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    diagnosis_pointers VARCHAR(50),
    ndc_code VARCHAR(20),
    drug_unit VARCHAR(10),
    drug_quantity DECIMAL(10, 3),
    service_date DATE,
    place_of_service_override VARCHAR(10),
    rendering_provider_id_override UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS superbill_suggested_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    superbill_id UUID NOT NULL REFERENCES superbills(id) ON DELETE CASCADE,
    source VARCHAR(50) NOT NULL,
    source_id UUID,
    cpt_code VARCHAR(10) NOT NULL,
    description TEXT,
    modifier1 VARCHAR(5),
    modifier2 VARCHAR(5),
    units INTEGER DEFAULT 1,
    charge DECIMAL(12, 2) DEFAULT 0.00,
    diagnosis_pointers VARCHAR(50),
    service_date DATE,
    status VARCHAR(20) DEFAULT 'PENDING',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS superbill_payments_summary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    superbill_id UUID NOT NULL REFERENCES superbills(id) ON DELETE CASCADE,
    patient_paid DECIMAL(12, 2) DEFAULT 0.00,
    insurance_paid DECIMAL(12, 2) DEFAULT 0.00,
    adjustment DECIMAL(12, 2) DEFAULT 0.00,
    balance_due DECIMAL(12, 2) DEFAULT 0.00,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(superbill_id)
);

CREATE TABLE IF NOT EXISTS superbill_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    superbill_id UUID NOT NULL REFERENCES superbills(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    action VARCHAR(50) NOT NULL,
    changes JSONB,
    reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_superbills_patient ON superbills(patient_id);
CREATE INDEX IF NOT EXISTS idx_superbills_visit ON superbills(visit_id);
CREATE INDEX IF NOT EXISTS idx_superbills_status ON superbills(status);
CREATE INDEX IF NOT EXISTS idx_superbill_diagnoses_superbill ON superbill_diagnoses(superbill_id);
CREATE INDEX IF NOT EXISTS idx_superbill_lines_superbill ON superbill_lines(superbill_id);
CREATE INDEX IF NOT EXISTS idx_suggested_lines_superbill ON superbill_suggested_lines(superbill_id);
CREATE INDEX IF NOT EXISTS idx_audit_superbill ON superbill_audit_logs(superbill_id);

-- ============================================
-- OPENEMR PORT: CORE BILLING TABLES
-- ============================================

CREATE TABLE IF NOT EXISTS billing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    code_type VARCHAR(15) NOT NULL, -- 1=ICD9, 2=ICD10, 3=CPT4, 4=HCPCS, etc.
    code VARCHAR(20) NOT NULL,
    pid UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    encounter UUID NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
    provider_id UUID REFERENCES users(id),
    user_id UUID REFERENCES users(id),
    groupname VARCHAR(255),
    authorized BOOLEAN DEFAULT FALSE,
    code_text TEXT,
    billed BOOLEAN DEFAULT FALSE,
    activity BOOLEAN DEFAULT TRUE,
    payer_id UUID, -- References payer_policies(id) or similar
    bill_process SMALLINT DEFAULT 0,
    bill_date TIMESTAMP,
    process_date TIMESTAMP,
    process_file VARCHAR(255),
    modifier1 VARCHAR(12) DEFAULT '',
    modifier2 VARCHAR(12) DEFAULT '',
    modifier3 VARCHAR(12) DEFAULT '',
    modifier4 VARCHAR(12) DEFAULT '',
    units INTEGER DEFAULT 1,
    fee DECIMAL(12, 2) DEFAULT 0.00,
    justify VARCHAR(255), -- Colon-separated diagnosis pointers
    target VARCHAR(30),
    x12_partner_id INTEGER,
    ndc_info VARCHAR(255),
    notecodes VARCHAR(25) DEFAULT '',
    external_id VARCHAR(50),
    pricelevel VARCHAR(31) DEFAULT '',
    revenue_code VARCHAR(6) DEFAULT '',
    chargecat VARCHAR(31) DEFAULT ''
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_billing_encounter_code_once
ON billing(encounter, code, COALESCE(modifier1,''))
WHERE activity = true;



CREATE INDEX IF NOT EXISTS idx_billing_encounter ON billing(encounter);
CREATE INDEX IF NOT EXISTS idx_billing_patient ON billing(pid);



CREATE TABLE IF NOT EXISTS ar_session (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payer_id UUID, -- NULL=patient, else references insurance_companies.id
    user_id UUID NOT NULL REFERENCES users(id),
    closed BOOLEAN DEFAULT FALSE,
    reference VARCHAR(255) DEFAULT '',
    check_date DATE,
    deposit_date DATE,
    pay_total DECIMAL(12, 2) DEFAULT 0.00,
    global_amount DECIMAL(12, 2) DEFAULT 0.00,
    payment_type VARCHAR(50),
    description TEXT,
    adjustment_code VARCHAR(50),
    post_to_date DATE,
    patient_id UUID REFERENCES patients(id),
    encounter UUID REFERENCES visits(id), -- Linked encounter for copays
    payment_method VARCHAR(25),
    idempotency_key UUID UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_ar_session_patient_copay_per_encounter
ON ar_session(encounter)
WHERE payment_type = 'Patient Payment';

CREATE TABLE IF NOT EXISTS ar_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pid UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    encounter UUID NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
    sequence_no INTEGER NOT NULL,
    code_type VARCHAR(12) DEFAULT '',
    code VARCHAR(20) DEFAULT '',
    modifier VARCHAR(12) DEFAULT '',
    payer_type INTEGER DEFAULT 0, -- 0=pt, 1=ins1, 2=ins2, etc.
    post_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    post_user UUID REFERENCES users(id),
    session_id UUID REFERENCES ar_session(id),
    memo VARCHAR(255) DEFAULT '',
    pay_amount DECIMAL(12, 2) DEFAULT 0.00,
    adj_amount DECIMAL(12, 2) DEFAULT 0.00,
    follow_up CHAR(1),
    follow_up_note TEXT,
    account_code VARCHAR(15),
    reason_code VARCHAR(255),
    deleted TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ar_activity_encounter ON ar_activity(pid, encounter);

CREATE TABLE IF NOT EXISTS claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES patients(id),
    encounter_id UUID REFERENCES visits(id),
    status INTEGER DEFAULT 0, -- 0=Ready, 1=Billed
    payer_id INTEGER, -- X12 Partner ID
    bill_date TIMESTAMP,
    process_date TIMESTAMP,
    process_file VARCHAR(255),
    submitted_claim TEXT, -- X12 content
    target VARCHAR(30),
    version INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    idempotency_key UUID UNIQUE
);

CREATE TABLE IF NOT EXISTS billing_event_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(50) NOT NULL,
    actor_id UUID REFERENCES users(id),
    visit_id UUID REFERENCES visits(id),
    claim_id UUID REFERENCES claims(id),
    session_id UUID REFERENCES ar_session(id),
    details JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_billing_log_visit ON billing_event_log(visit_id);
CREATE INDEX IF NOT EXISTS idx_billing_log_claim ON billing_event_log(claim_id);
CREATE INDEX IF NOT EXISTS idx_billing_log_session ON billing_event_log(session_id);

-- ============================================
-- E-PRESCRIBING SYSTEM
-- ============================================

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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pharmacies_location ON pharmacies(latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pharmacies_ncpdp ON pharmacies(ncpdp_id) WHERE ncpdp_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS medication_database (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rxcui VARCHAR(20) UNIQUE,
    name VARCHAR(500) NOT NULL,
    synonym VARCHAR(500),
    tty VARCHAR(50),
    strength VARCHAR(100),
    form VARCHAR(100),
    route VARCHAR(100),
    ndc VARCHAR(20),
    fda_drug_code VARCHAR(20),
    controlled_substance BOOLEAN DEFAULT false,
    schedule VARCHAR(10),
    drug_class VARCHAR(255),
    drug_category VARCHAR(255),
    fda_approved BOOLEAN DEFAULT true,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    search_vector tsvector GENERATED ALWAYS AS (
        to_tsvector('english', 
            COALESCE(name, '') || ' ' || 
            COALESCE(synonym, '') || ' ' || 
            COALESCE(strength, '') || ' ' || 
            COALESCE(form, '')
        )
    ) STORED
);

CREATE INDEX IF NOT EXISTS idx_medication_search ON medication_database USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_medication_rxcui ON medication_database(rxcui) WHERE rxcui IS NOT NULL;

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
    sent_at TIMESTAMP WITH TIME ZONE,
    received_at TIMESTAMP WITH TIME ZONE,
    filled_at TIMESTAMP WITH TIME ZONE,
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_prescriptions_patient ON prescriptions(patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prescriptions_status ON prescriptions(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prescriptions_prescriber ON prescriptions(prescriber_id, created_at DESC);

CREATE TABLE IF NOT EXISTS prescription_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prescription_id UUID NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
    interaction_type VARCHAR(50),
    severity VARCHAR(50),
    description TEXT,
    medication_name VARCHAR(500),
    medication_rxcui VARCHAR(20),
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_interactions_prescription ON prescription_interactions(prescription_id);


CREATE TABLE IF NOT EXISTS drug_inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    drug_id UUID NOT NULL, -- References medication_database(id)
    warehouse_id UUID,
    on_hand INTEGER DEFAULT 0,
    cost DECIMAL(12, 2) DEFAULT 0.00,
    lot_number VARCHAR(255),
    expiration DATE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_drug_inventory_non_negative CHECK (on_hand >= 0)
);

CREATE INDEX IF NOT EXISTS idx_drug_inventory_drug ON drug_inventory(drug_id);
CREATE INDEX IF NOT EXISTS idx_drug_inventory_fifo ON drug_inventory(drug_id, expiration, id);

CREATE TABLE IF NOT EXISTS drug_sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    drug_id UUID, -- References medication_database(id) or drugs(id)
    inventory_id UUID,
    prescription_id UUID REFERENCES prescriptions(id),
    pid UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    encounter UUID NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    sale_date DATE NOT NULL DEFAULT CURRENT_DATE,
    quantity INTEGER DEFAULT 0,
    fee DECIMAL(12, 2) DEFAULT 0.00,
    billed BOOLEAN DEFAULT FALSE,
    notes VARCHAR(255),
    bill_date TIMESTAMP,
    pricelevel VARCHAR(31) DEFAULT '',
    selector VARCHAR(255),
    trans_type SMALLINT DEFAULT 1, -- 1=sale, 2=purchase, 3=return, 4=transfer, 5=adjustment
    chargecat VARCHAR(31) DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

`;

module.exports = tenantSchemaSQL;
