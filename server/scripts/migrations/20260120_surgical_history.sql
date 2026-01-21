-- Add surgical_history table
CREATE TABLE IF NOT EXISTS surgical_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  procedure_name VARCHAR(255) NOT NULL,
  date DATE,
  surgeon VARCHAR(255),
  facility VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for surgical_history
CREATE INDEX IF NOT EXISTS idx_surgical_history_patient ON surgical_history(patient_id);
