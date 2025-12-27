-- Control Database Schema
-- This database manages clinic registration and multi-tenancy routing.
-- NO patient data should ever be stored here.

-- 1. Clinics Table: Registered tenants
CREATE TABLE clinics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(50) UNIQUE NOT NULL,           -- Used in URL (e.g., clinicA)
    display_name VARCHAR(255) NOT NULL,         -- Friendly name
    legal_name VARCHAR(255),                    -- For legal documents
    specialty VARCHAR(100),                     -- Cardiology, Primary Care, etc.
    logo_url TEXT,
    phone VARCHAR(20),
    fax VARCHAR(20),
    email VARCHAR(255),
    website TEXT,
    address_line1 TEXT,
    address_line2 TEXT,
    city VARCHAR(100),
    state VARCHAR(50),
    zip VARCHAR(20),
    tax_id VARCHAR(50),
    npi VARCHAR(20),
    status VARCHAR(20) DEFAULT 'active',        -- active, suspended, deactivated
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Clinic DB Connections: SUPER ADMIN ONLY
-- This table stores credentials to sensitive clinical databases.
CREATE TABLE clinic_db_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
    db_type VARCHAR(20) DEFAULT 'postgres',
    host VARCHAR(255) NOT NULL,
    port INTEGER DEFAULT 5432,
    db_name VARCHAR(255) NOT NULL,
    db_user VARCHAR(255) NOT NULL,
    db_password_encrypted TEXT NOT NULL,         -- Should be encrypted as requested
    ssl_mode VARCHAR(20) DEFAULT 'require',     -- standard postgres ssl modes
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(clinic_id)
);

-- 3. Clinic Settings: Global UI/UX preferences
CREATE TABLE clinic_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
    letterhead_template VARCHAR(50) DEFAULT 'standard',
    time_zone VARCHAR(50) DEFAULT 'America/New_York',
    date_format VARCHAR(20) DEFAULT 'MM/DD/YYYY',
    time_format VARCHAR(10) DEFAULT '12h',
    default_form_settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(clinic_id)
);

-- 4. Platform Admin Users (Your IT Team)
-- Multiple users can manage the platform with different permission levels
CREATE TABLE IF NOT EXISTS super_admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    role VARCHAR(50) DEFAULT 'support',          -- super_admin, admin, support, billing, it_manager
    is_active BOOLEAN DEFAULT TRUE,
    mfa_enabled BOOLEAN DEFAULT FALSE,
    mfa_secret TEXT,
    last_login_at TIMESTAMP WITH TIME ZONE,
    last_login_ip INET,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES super_admins(id),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Platform Admin Roles & Permissions
CREATE TABLE IF NOT EXISTS platform_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) UNIQUE NOT NULL,           -- Super Admin, Support Manager, Billing Admin, IT Manager
    description TEXT,
    permissions JSONB DEFAULT '{}',             -- JSON array of permission keys
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Platform Admin Sessions (for proper session management)
CREATE TABLE IF NOT EXISTS platform_admin_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID REFERENCES super_admins(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_super_admins_email ON super_admins(email);
CREATE INDEX IF NOT EXISTS idx_super_admins_role ON super_admins(role);
CREATE INDEX IF NOT EXISTS idx_platform_sessions_token ON platform_admin_sessions(token);
CREATE INDEX IF NOT EXISTS idx_platform_sessions_admin ON platform_admin_sessions(admin_id);
CREATE INDEX IF NOT EXISTS idx_platform_sessions_expires ON platform_admin_sessions(expires_at);

-- Trigger for updated_at
CREATE TRIGGER update_super_admins_updated_at
    BEFORE UPDATE ON super_admins
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Seed Platform Admin Roles
INSERT INTO platform_roles (name, description, permissions) VALUES
    ('Super Admin', 'Full platform access - can manage everything', 
     '["*"]'),
    ('Support Manager', 'Manage support tickets and view clinic details', 
     '["tickets:*", "clinics:view", "clinics:edit_status"]'),
    ('Billing Admin', 'Manage subscriptions, payments, and revenue', 
     '["subscriptions:*", "payments:*", "revenue:view", "clinics:view"]'),
    ('IT Manager', 'Technical management - database, infrastructure, monitoring', 
     '["clinics:*", "database:view", "logs:view", "system:monitor"]'),
    ('Analyst', 'View-only access for reporting and analytics', 
     '["clinics:view", "revenue:view", "analytics:view"]')
ON CONFLICT (name) DO NOTHING;

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_clinics_updated_at
    BEFORE UPDATE ON clinics
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
