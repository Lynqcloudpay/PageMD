#!/bin/bash
# Get all tenant schemas
SCHEMAS=$(ssh -i temp_deploy_key ubuntu@pagemdemr.com "docker exec emr-db psql -U emr_user -d emr_db -t -c \"SELECT nspname FROM pg_catalog.pg_namespace WHERE nspname LIKE 'tenant_%';\"")

for SCHEMA in $SCHEMAS; do
  echo "Applying migration to $SCHEMA..."
  ssh -i temp_deploy_key ubuntu@pagemdemr.com "docker exec emr-db psql -U emr_user -d emr_db -c \"
    SET search_path TO $SCHEMA, public;
    
    -- Add sticky note field to patients
    ALTER TABLE patients ADD COLUMN IF NOT EXISTS reminder_note TEXT;

    -- Create health maintenance table
    CREATE TABLE IF NOT EXISTS health_maintenance (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      item_name VARCHAR(255) NOT NULL,
      status VARCHAR(50) DEFAULT 'Pending', -- 'Completed', 'Overdue', 'Due Soon', 'Scheduled'
      last_performed DATE,
      due_date DATE,
      notes TEXT,
      specialty_focus VARCHAR(100) DEFAULT 'Cardiology',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_health_maintenance_patient ON health_maintenance(patient_id);
    
    -- Insert default cardiology focus items if none exist for existing patients
    INSERT INTO health_maintenance (patient_id, item_name, status, due_date, specialty_focus)
    SELECT id, 'Lipid Profile (Annual)', 'Due Soon', CURRENT_DATE + interval '1 month', 'Cardiology'
    FROM patients
    WHERE id NOT IN (SELECT patient_id FROM health_maintenance WHERE item_name = 'Lipid Profile (Annual)');

    INSERT INTO health_maintenance (patient_id, item_name, status, due_date, specialty_focus)
    SELECT id, 'Echocardiogram', 'Pending', CURRENT_DATE + interval '6 months', 'Cardiology'
    FROM patients
    WHERE id NOT IN (SELECT patient_id FROM health_maintenance WHERE item_name = 'Echocardiogram');

    INSERT INTO health_maintenance (patient_id, item_name, status, due_date, specialty_focus)
    SELECT id, 'Stress Test', 'Scheduled', CURRENT_DATE + interval '2 weeks', 'Cardiology'
    FROM patients
    WHERE id NOT IN (SELECT patient_id FROM health_maintenance WHERE item_name = 'Stress Test');
  \""
done
