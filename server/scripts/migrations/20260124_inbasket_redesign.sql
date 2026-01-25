-- InBasket Redesign Migration
-- Adds physician review workflow, task management, and quality metrics tracking

-- 1. Enhance inbox_items table with review workflow fields
ALTER TABLE inbox_items ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE inbox_items ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id);
ALTER TABLE inbox_items ADD COLUMN IF NOT EXISTS findings TEXT;
ALTER TABLE inbox_items ADD COLUMN IF NOT EXISTS plan TEXT;
ALTER TABLE inbox_items ADD COLUMN IF NOT EXISTS metric_tags TEXT[];
ALTER TABLE inbox_items ADD COLUMN IF NOT EXISTS document_type VARCHAR(100);
ALTER TABLE inbox_items ADD COLUMN IF NOT EXISTS source_facility VARCHAR(255);
ALTER TABLE inbox_items ADD COLUMN IF NOT EXISTS source_provider VARCHAR(255);
ALTER TABLE inbox_items ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ;
ALTER TABLE inbox_items ADD COLUMN IF NOT EXISTS is_urgent BOOLEAN DEFAULT FALSE;
ALTER TABLE inbox_items ADD COLUMN IF NOT EXISTS document_url TEXT;

-- 2. Create clinical_tasks table for dedicated task management
CREATE TABLE IF NOT EXISTS clinical_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(500) NOT NULL,
  description TEXT,
  patient_id UUID REFERENCES patients(id),
  assigned_to UUID REFERENCES users(id) NOT NULL,
  assigned_by UUID REFERENCES users(id) NOT NULL,
  category VARCHAR(50) DEFAULT 'general',
  priority VARCHAR(20) DEFAULT 'routine',
  status VARCHAR(20) DEFAULT 'open',
  due_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES users(id),
  source_inbox_item_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create index for common queries
CREATE INDEX IF NOT EXISTS idx_clinical_tasks_assigned_to ON clinical_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_clinical_tasks_assigned_by ON clinical_tasks(assigned_by);
CREATE INDEX IF NOT EXISTS idx_clinical_tasks_status ON clinical_tasks(status);
CREATE INDEX IF NOT EXISTS idx_clinical_tasks_patient_id ON clinical_tasks(patient_id);
CREATE INDEX IF NOT EXISTS idx_clinical_tasks_due_date ON clinical_tasks(due_date);

-- 3. Create quality_metrics table for preventive care tracking
CREATE TABLE IF NOT EXISTS quality_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) NOT NULL,
  metric_type VARCHAR(100) NOT NULL,
  result_date DATE,
  result_value VARCHAR(255),
  next_due_date DATE,
  inbox_item_id UUID,
  document_id UUID,
  reviewed_by UUID REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_quality_metrics_patient_id ON quality_metrics(patient_id);
CREATE INDEX IF NOT EXISTS idx_quality_metrics_type ON quality_metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_quality_metrics_due_date ON quality_metrics(next_due_date);

-- 4. Create internal_messages table for staff-to-staff messaging
CREATE TABLE IF NOT EXISTS internal_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID,
  sender_id UUID REFERENCES users(id) NOT NULL,
  recipient_id UUID REFERENCES users(id) NOT NULL,
  subject VARCHAR(500),
  body TEXT NOT NULL,
  patient_id UUID REFERENCES patients(id),
  read_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  parent_message_id UUID REFERENCES internal_messages(id),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_internal_messages_recipient ON internal_messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_internal_messages_sender ON internal_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_internal_messages_thread ON internal_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_internal_messages_patient ON internal_messages(patient_id);

-- 5. Update trigger for updated_at on clinical_tasks
CREATE OR REPLACE FUNCTION update_clinical_tasks_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS clinical_tasks_update_timestamp ON clinical_tasks;
CREATE TRIGGER clinical_tasks_update_timestamp
  BEFORE UPDATE ON clinical_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_clinical_tasks_timestamp();

-- 6. Add updated_at trigger to quality_metrics
DROP TRIGGER IF EXISTS quality_metrics_update_timestamp ON quality_metrics;
CREATE TRIGGER quality_metrics_update_timestamp
  BEFORE UPDATE ON quality_metrics
  FOR EACH ROW
  EXECUTE FUNCTION update_clinical_tasks_timestamp();

-- Done
SELECT 'InBasket redesign migration completed successfully' as status;
