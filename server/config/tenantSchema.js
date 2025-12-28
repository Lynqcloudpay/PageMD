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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO roles (name, description, is_system_role) VALUES 
    ('Admin', 'Clinic Administrator with full access', true),
    ('Physician', 'Licensed physician with full clinical privileges', true),
    ('staff', 'Clinic Staff', true)
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
    first_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100),
    last_name VARCHAR(100) NOT NULL,
    preferred_name VARCHAR(100),
    name_prefix VARCHAR(50),
    name_suffix VARCHAR(50),
    previous_name VARCHAR(255),
    dob DATE NOT NULL,
    date_of_birth DATE,
    sex VARCHAR(10) CHECK (sex IN ('M', 'F', 'Other')),
    gender VARCHAR(50),
    ssn_encrypted TEXT,
    phone VARCHAR(20),
    phone_cell VARCHAR(20),
    phone_home VARCHAR(20),
    phone_work VARCHAR(20),
    phone_preferred VARCHAR(20),
    communication_preference VARCHAR(50),
    phone_secondary VARCHAR(20),
    email VARCHAR(255),
    email_secondary VARCHAR(255),
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(50),
    zip VARCHAR(20),
    country VARCHAR(100) DEFAULT 'United States',
    address_type VARCHAR(50) DEFAULT 'Home',
    primary_care_provider UUID REFERENCES users(id),
    interpreter_needed BOOLEAN DEFAULT FALSE,
    consent_to_text BOOLEAN DEFAULT FALSE,
    consent_to_email BOOLEAN DEFAULT FALSE,
    employer_name VARCHAR(255),
    employment_status VARCHAR(100),
    occupation VARCHAR(255),
    emergency_contact_name VARCHAR(255),
    emergency_contact_phone VARCHAR(20),
    emergency_contact_relationship VARCHAR(100),
    emergency_contact_address TEXT,
    emergency_contact_2_name VARCHAR(255),
    emergency_contact_2_phone VARCHAR(20),
    emergency_contact_2_relationship VARCHAR(100),
    insurance_provider VARCHAR(255),
    insurance_id VARCHAR(100),
    insurance_group_number VARCHAR(100),
    insurance_member_id VARCHAR(100),
    insurance_plan_name VARCHAR(255),
    insurance_plan_type VARCHAR(100),
    insurance_subscriber_name VARCHAR(255),
    insurance_subscriber_dob DATE,
    insurance_subscriber_relationship VARCHAR(100),
    insurance_copay VARCHAR(100),
    insurance_effective_date DATE,
    insurance_expiry_date DATE,
    insurance_notes TEXT,
    pharmacy_name VARCHAR(255),
    pharmacy_address TEXT,
    pharmacy_phone VARCHAR(20),
    pharmacy_npi VARCHAR(20),
    pharmacy_fax VARCHAR(20),
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
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(code_type, code)
);

CREATE INDEX IF NOT EXISTS idx_fee_schedule_code ON fee_schedule(code_type, code);

CREATE TABLE IF NOT EXISTS claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visit_id UUID REFERENCES visits(id),
    patient_id UUID NOT NULL REFERENCES patients(id),
    diagnosis_codes JSONB,
    procedure_codes JSONB,
    total_amount DECIMAL(10, 2),
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'paid', 'denied', 'cancelled')),
    insurance_provider VARCHAR(255),
    claim_number VARCHAR(100),
    submitted_at TIMESTAMP,
    paid_at TIMESTAMP,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_claims_patient ON claims(patient_id);
CREATE INDEX IF NOT EXISTS idx_claims_visit ON claims(visit_id);

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
    logo_url TEXT DEFAULT 'data:image/svg+xml,%3Csvg xmlns=''http://www.w3.org/2000/svg'' width=''200'' height=''200'' viewBox=''0 0 200 200''%3E%3Crect width=''200'' height=''200'' fill=''%23f8fafc''/%3E%3Ccircle cx=''100'' cy=''100'' r=''75'' fill=''%23e2e8f0'' stroke=''%23cbd5e1'' stroke-width=''2''/%3E%3Cpath d=''M100 55 L100 145 M55 100 L145 100'' stroke=''%233b82f6'' stroke-width=''16'' stroke-linecap=''round''/%3E%3Ccircle cx=''100'' cy=''100'' r=''35'' fill=''none'' stroke=''%233b82f6'' stroke-width=''4''/%3E%3C/svg%3E',
    timezone VARCHAR(50) DEFAULT 'America/New_York',
    date_format VARCHAR(20) DEFAULT 'MM/DD/YYYY',
    time_format VARCHAR(10) DEFAULT '12h',
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
`;

module.exports = tenantSchemaSQL;
