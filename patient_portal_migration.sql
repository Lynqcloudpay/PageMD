-- Global Patient Lookup (in Control/Public DB)
CREATE TABLE IF NOT EXISTS public.platform_patient_lookup (
    email VARCHAR(255) PRIMARY KEY,
    clinic_id UUID REFERENCES public.clinics(id) ON DELETE CASCADE,
    schema_name VARCHAR(63) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_platform_patient_email ON public.platform_patient_lookup(email);

-- Function to apply patient portal tables to a schema
CREATE OR REPLACE FUNCTION public.apply_patient_portal_to_schema(target_schema TEXT) 
RETURNS VOID AS $$
BEGIN
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.patient_portal_accounts (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            patient_id UUID NOT NULL REFERENCES %I.patients(id) ON DELETE CASCADE,
            email VARCHAR(255) UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            status VARCHAR(20) DEFAULT ''invited'' CHECK (status IN (''invited'', ''active'', ''locked'')),
            last_login_at TIMESTAMP,
            mfa_enabled BOOLEAN DEFAULT FALSE,
            mfa_secret_encrypted TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS %I.patient_portal_invites (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            patient_id UUID NOT NULL REFERENCES %I.patients(id) ON DELETE CASCADE,
            email VARCHAR(255) NOT NULL,
            token_hash TEXT NOT NULL,
            expires_at TIMESTAMP NOT NULL,
            used_at TIMESTAMP,
            created_by_user_id UUID REFERENCES %I.users(id),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS %I.patient_portal_permissions (
            account_id UUID PRIMARY KEY REFERENCES %I.patient_portal_accounts(id) ON DELETE CASCADE,
            can_view_notes BOOLEAN DEFAULT TRUE,
            can_view_labs BOOLEAN DEFAULT TRUE,
            can_view_documents BOOLEAN DEFAULT TRUE,
            can_message BOOLEAN DEFAULT TRUE,
            can_request_appointments BOOLEAN DEFAULT TRUE,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS %I.patient_portal_audit_log (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            account_id UUID REFERENCES %I.patient_portal_accounts(id) ON DELETE SET NULL,
            patient_id UUID REFERENCES %I.patients(id) ON DELETE CASCADE,
            action VARCHAR(100) NOT NULL,
            resource_type VARCHAR(50),
            resource_id UUID,
            ip_address INET,
            user_agent TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS %I.portal_message_threads (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            patient_id UUID NOT NULL REFERENCES %I.patients(id),
            subject TEXT NOT NULL,
            status TEXT DEFAULT ''open'' CHECK (status IN (''open'', ''closed'')),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS %I.portal_messages (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            thread_id UUID NOT NULL REFERENCES %I.portal_message_threads(id),
            sender_type TEXT NOT NULL CHECK (sender_type IN (''patient'', ''staff'')),
            sender_id UUID NOT NULL,
            content TEXT NOT NULL,
            read_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS %I.portal_appointment_requests (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            patient_id UUID NOT NULL REFERENCES %I.patients(id),
            preferred_date DATE,
            preferred_time TEXT,
            reason TEXT,
            status TEXT DEFAULT ''pending'' CHECK (status IN (''pending'', ''approved'', ''denied'', ''cancelled'')),
            staff_notes TEXT,
            provider_id UUID REFERENCES %I.users(id),
            processed_by UUID REFERENCES %I.users(id),
            processed_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS %I.patient_portal_password_resets (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            email TEXT NOT NULL,
            token_hash TEXT NOT NULL,
            expires_at TIMESTAMP NOT NULL,
            used_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_portal_accounts_patient_%s ON %I.patient_portal_accounts(patient_id);
        CREATE INDEX IF NOT EXISTS idx_portal_accounts_email_%s ON %I.patient_portal_accounts(email);
        CREATE INDEX IF NOT EXISTS idx_portal_invites_patient_%s ON %I.patient_portal_invites(patient_id);
        CREATE INDEX IF NOT EXISTS idx_portal_audit_patient_%s ON %I.patient_portal_audit_log(patient_id);
    ', 
    target_schema, target_schema, 
    target_schema, target_schema, target_schema, 
    target_schema, target_schema, 
    target_schema, target_schema, target_schema,
    target_schema, target_schema,
    target_schema, target_schema,
    target_schema, target_schema,
    target_schema, target_schema,
    target_schema, target_schema,
    target_schema, target_schema,
    target_schema, target_schema,
    target_schema, target_schema,
    target_schema, target_schema,
    target_schema, target_schema
    );
END;
$$ LANGUAGE plpgsql;

-- Apply to existing tenant schemas
DO $$
DECLARE
    schema_rec RECORD;
BEGIN
    FOR schema_rec IN SELECT schema_name FROM public.clinics LOOP
        PERFORM public.apply_patient_portal_to_schema(schema_rec.schema_name);
    END LOOP;
END $$;
