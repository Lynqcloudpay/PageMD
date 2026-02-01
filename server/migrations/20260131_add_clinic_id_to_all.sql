-- Migration to add clinic_id to missing tables for multi-tenancy consistency
-- This resolves the "column clinic_id does not exist" errors in /api/inbox/stats and other endpoints

-- Add to documents
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'clinic_id') THEN
    ALTER TABLE documents ADD COLUMN clinic_id UUID REFERENCES clinics(id);
  END IF;
END $$;

-- Add to referrals
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'referrals' AND column_name = 'clinic_id') THEN
    ALTER TABLE referrals ADD COLUMN clinic_id UUID REFERENCES clinics(id);
  END IF;
END $$;

-- Add to messages
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'clinic_id') THEN
    ALTER TABLE messages ADD COLUMN clinic_id UUID REFERENCES clinics(id);
  END IF;
END $$;

-- Add to portal_appointment_requests
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'portal_appointment_requests' AND column_name = 'clinic_id') THEN
    ALTER TABLE portal_appointment_requests ADD COLUMN clinic_id UUID REFERENCES clinics(id);
  END IF;
END $$;

-- Add to portal_messages
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'portal_messages' AND column_name = 'clinic_id') THEN
    ALTER TABLE portal_messages ADD COLUMN clinic_id UUID REFERENCES clinics(id);
  END IF;
END $$;

-- Add to portal_message_threads
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'portal_message_threads' AND column_name = 'clinic_id') THEN
    ALTER TABLE portal_message_threads ADD COLUMN clinic_id UUID REFERENCES clinics(id);
  END IF;
END $$;
