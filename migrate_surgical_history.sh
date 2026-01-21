#!/bin/bash
# Get all tenant schemas
SCHEMAS=$(docker exec emr-db psql -U emr_user -d emr_db -t -c "SELECT nspname FROM pg_catalog.pg_namespace WHERE nspname LIKE 'tenant_%';")

for SCHEMA in $SCHEMAS; do
  echo "Applying migration to $SCHEMA..."
  docker exec emr-db psql -U emr_user -d emr_db -c "
    SET search_path TO $SCHEMA, public;
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
    CREATE INDEX IF NOT EXISTS idx_surgical_history_patient ON surgical_history(patient_id);
  "
done
