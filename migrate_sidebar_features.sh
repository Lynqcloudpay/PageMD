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
    
    -- Insert default items for each specialty if they don't exist
    
    -- Cardiology
    INSERT INTO health_maintenance (patient_id, item_name, status, due_date, specialty_focus)
    SELECT id, 'Lipid Profile', 'Due Soon', CURRENT_DATE + interval '1 month', 'Cardiology'
    FROM patients
    WHERE id NOT IN (SELECT patient_id FROM health_maintenance WHERE item_name = 'Lipid Profile' AND specialty_focus = 'Cardiology');

    -- Primary Care
    INSERT INTO health_maintenance (patient_id, item_name, status, due_date, specialty_focus)
    SELECT id, 'Annual Physical', 'Pending', CURRENT_DATE + interval '3 months', 'Primary Care'
    FROM patients
    WHERE id NOT IN (SELECT patient_id FROM health_maintenance WHERE item_name = 'Annual Physical' AND specialty_focus = 'Primary Care');

    -- Endocrinology
    INSERT INTO health_maintenance (patient_id, item_name, status, due_date, specialty_focus)
    SELECT id, 'HbA1c Monitoring', 'Due Soon', CURRENT_DATE + interval '2 weeks', 'Endocrinology'
    FROM patients
    WHERE id NOT IN (SELECT patient_id FROM health_maintenance WHERE item_name = 'HbA1c Monitoring' AND specialty_focus = 'Endocrinology');

    -- Gastroenterology
    INSERT INTO health_maintenance (patient_id, item_name, status, due_date, specialty_focus)
    SELECT id, 'Colonoscopy Screening', 'Scheduled', CURRENT_DATE + interval '6 months', 'Gastroenterology'
    FROM patients
    WHERE id NOT IN (SELECT patient_id FROM health_maintenance WHERE item_name = 'Colonoscopy Screening' AND specialty_focus = 'Gastroenterology');

    -- Pulmonology
    INSERT INTO health_maintenance (patient_id, item_name, status, due_date, specialty_focus)
    SELECT id, 'PFTs Baseline', 'Pending', CURRENT_DATE + interval '1 year', 'Pulmonology'
    FROM patients
    WHERE id NOT IN (SELECT patient_id FROM health_maintenance WHERE item_name = 'PFTs Baseline' AND specialty_focus = 'Pulmonology');
  \""
done
