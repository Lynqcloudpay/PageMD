-- Fix documents table doc_type constraint to include 'other', 'profile_photo', and 'visit_note' (found in existing data)
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_doc_type_check;
ALTER TABLE documents ADD CONSTRAINT documents_doc_type_check 
  CHECK (doc_type IN ('imaging', 'consult', 'lab', 'other', 'profile_photo', 'visit_note'));

-- Create vitals table if it doesn't exist
CREATE TABLE IF NOT EXISTS vitals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    encounter_id UUID REFERENCES visits(id) ON DELETE SET NULL,
    height NUMERIC(10,2),
    weight NUMERIC(10,2),
    bmi NUMERIC(10,2),
    bp_systolic INTEGER,
    bp_diastolic INTEGER,
    heart_rate INTEGER,
    respiratory_rate INTEGER,
    temperature NUMERIC(5,2),
    oxygen_saturation INTEGER,
    pain_score INTEGER,
    head_circumference NUMERIC(10,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id)
);

-- Index for vitals
CREATE INDEX IF NOT EXISTS idx_vitals_patient ON vitals(patient_id);
CREATE INDEX IF NOT EXISTS idx_vitals_encounter ON vitals(encounter_id);
