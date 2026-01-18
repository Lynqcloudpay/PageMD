-- Mother Patient System Base Schema
-- Immutable Event Ledger
CREATE TABLE IF NOT EXISTS patient_event (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL,
    patient_id UUID NOT NULL,
    encounter_id UUID,
    event_type TEXT NOT NULL,
    event_version INT NOT NULL DEFAULT 1,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    refs JSONB NOT NULL DEFAULT '{}'::jsonb,
    source_module TEXT NOT NULL,
    actor_user_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    hash TEXT
);

-- Indexes for Event Ledger
CREATE INDEX IF NOT EXISTS idx_patient_event_patient ON patient_event(clinic_id, patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_patient_event_encounter ON patient_event(clinic_id, encounter_id, created_at DESC) WHERE encounter_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_patient_event_type ON patient_event(clinic_id, event_type);
CREATE INDEX IF NOT EXISTS idx_patient_event_payload ON patient_event USING GIN (payload);
CREATE INDEX IF NOT EXISTS idx_patient_event_refs ON patient_event USING GIN (refs);

-- Prevent Updates/Deletes on Event Ledger
CREATE OR REPLACE FUNCTION prevent_event_mutation()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'UPDATE' OR TG_OP = 'DELETE') THEN
        IF (current_setting('app.migration_mode', true) = 'on') THEN
            RETURN NULL;
        END IF;
        RAISE EXCEPTION 'Updates and Deletes are not allowed on the immutable patient_event ledger.';
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_event_mutation ON patient_event;
CREATE TRIGGER trg_prevent_event_mutation
BEFORE UPDATE OR DELETE ON patient_event
FOR EACH ROW EXECUTE FUNCTION prevent_event_mutation();


-- Projection: Latest Vitals
CREATE TABLE IF NOT EXISTS patient_state_vitals_latest (
    clinic_id UUID NOT NULL,
    patient_id UUID NOT NULL,
    bp_systolic INT,
    bp_diastolic INT,
    heart_rate INT,
    respiration_rate INT,
    temperature DECIMAL(5,2),
    oxygen_saturation INT,
    weight DECIMAL(8,2), -- in lbs or kg
    height DECIMAL(8,2), -- in inches or cm
    bmi DECIMAL(5,2),
    pain_score INT,
    recorded_at TIMESTAMPTZ,
    last_event_id UUID,
    updated_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (clinic_id, patient_id)
);

-- Projection: Medications
CREATE TABLE IF NOT EXISTS patient_state_medications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL,
    patient_id UUID NOT NULL,
    medication_name TEXT NOT NULL,
    dosage TEXT,
    route TEXT,
    frequency TEXT,
    status TEXT DEFAULT 'active',
    start_date DATE,
    end_date DATE,
    rxnorm_id TEXT,
    last_event_id UUID,
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ps_meds_patient ON patient_state_medications(clinic_id, patient_id);

-- Projection: Problems
CREATE TABLE IF NOT EXISTS patient_state_problems (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL,
    patient_id UUID NOT NULL,
    problem_name TEXT NOT NULL,
    icd10_code TEXT,
    status TEXT DEFAULT 'active',
    onset_date DATE,
    resolution_date DATE,
    last_event_id UUID,
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ps_problems_patient ON patient_state_problems(clinic_id, patient_id);

-- Projection: Open/Pending Orders
CREATE TABLE IF NOT EXISTS patient_state_orders_open (
    id UUID PRIMARY KEY, -- Match original order ID
    clinic_id UUID NOT NULL,
    patient_id UUID NOT NULL,
    order_type TEXT NOT NULL,
    order_description TEXT,
    status TEXT NOT NULL,
    ordered_at TIMESTAMPTZ,
    last_event_id UUID,
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ps_orders_patient ON patient_state_orders_open(clinic_id, patient_id);

-- Projection: Allergies
CREATE TABLE IF NOT EXISTS patient_state_allergies (
    clinic_id UUID NOT NULL,
    patient_id UUID NOT NULL,
    allergy_id UUID NOT NULL,
    allergen TEXT NOT NULL,
    reaction TEXT,
    severity TEXT,
    status TEXT DEFAULT 'active',
    onset_date DATE,
    last_event_id UUID,
    updated_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (clinic_id, patient_id, allergy_id)
);

-- Projection: Last Visit Summary
CREATE TABLE IF NOT EXISTS patient_state_last_visit (
    clinic_id UUID NOT NULL,
    patient_id UUID NOT NULL,
    visit_id UUID NOT NULL,
    visit_date DATE NOT NULL,
    visit_type TEXT,
    provider_id UUID,
    summary JSONB,
    last_event_id UUID,
    updated_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (clinic_id, patient_id)
);

-- Narrative Documents (Visit Notes, Reports, etc)
CREATE TABLE IF NOT EXISTS patient_document (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL,
    patient_id UUID NOT NULL,
    encounter_id UUID,
    doc_type TEXT NOT NULL, -- visit_note, lab_report, imaging_report, consult, message, upload
    title TEXT,
    storage_type TEXT DEFAULT 'disk', -- disk, content_only, external
    file_path TEXT,
    content_text TEXT,
    content_json JSONB,
    status TEXT DEFAULT 'draft', -- draft, signed, amended, retracted
    version INT DEFAULT 1,
    author_user_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    search_vector tsvector GENERATED ALWAYS AS (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content_text, ''))) STORED
);

CREATE INDEX IF NOT EXISTS idx_patient_doc_patient ON patient_document(clinic_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_doc_encounter ON patient_document(clinic_id, encounter_id);
CREATE INDEX IF NOT EXISTS idx_patient_doc_search ON patient_document USING GIN (search_vector);

-- Document Versioning
CREATE TABLE IF NOT EXISTS patient_document_version (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES patient_document(id) ON DELETE CASCADE,
    version INT NOT NULL,
    content_text TEXT,
    content_json JSONB,
    file_path TEXT,
    author_user_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pdv_doc ON patient_document_version(document_id, version);

-- Mother Audit Log
CREATE TABLE IF NOT EXISTS mother_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id TEXT,
    clinic_id UUID NOT NULL,
    patient_id UUID NOT NULL,
    encounter_id UUID,
    actor_user_id UUID NOT NULL,
    action TEXT NOT NULL, -- read, write, backfill
    event_ids UUID[],
    details JSONB,
    timestamp TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mother_audit_patient ON mother_audit_log(clinic_id, patient_id, timestamp DESC);
