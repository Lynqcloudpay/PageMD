-- Migration for Patient Portal Appointments (Explicit Schema)
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (
        SELECT schema_name 
        FROM information_schema.schemata 
        WHERE schema_name NOT LIKE 'pg_%' 
        AND schema_name NOT IN ('information_schema', 'public')
    ) LOOP
        -- Portal Appointment Requests
        EXECUTE format('
            CREATE TABLE IF NOT EXISTS %I.portal_appointment_requests (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                patient_id UUID NOT NULL REFERENCES %I.patients(id) ON DELETE CASCADE,
                portal_account_id UUID NOT NULL REFERENCES %I.patient_portal_accounts(id) ON DELETE CASCADE,
                preferred_date DATE NOT NULL,
                preferred_time_range VARCHAR(50),
                appointment_type VARCHAR(50),
                reason TEXT,
                status VARCHAR(20) DEFAULT ''pending'' CHECK (status IN (''pending'', ''confirmed'', ''declined'', ''cancelled'')),
                staff_notes TEXT,
                appointment_id UUID REFERENCES %I.appointments(id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )', r.schema_name, r.schema_name, r.schema_name, r.schema_name);

        EXECUTE format('CREATE INDEX IF NOT EXISTS idx_portal_appt_req_patient ON %I.portal_appointment_requests(patient_id)', r.schema_name);
        EXECUTE format('CREATE INDEX IF NOT EXISTS idx_portal_appt_req_account ON %I.portal_appointment_requests(portal_account_id)', r.schema_name);

    END LOOP;
END $$;
