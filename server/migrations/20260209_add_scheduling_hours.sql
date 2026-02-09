-- Migration: Add scheduling start and end times to clinic/practice settings
-- Default hours: 07:00 to 19:00

-- Ensure we hit the correct tenant schema if running manually
SET search_path TO tenant_gov_p2, public;

-- 1. Practice Settings (Local / Tenant)
ALTER TABLE practice_settings ADD COLUMN IF NOT EXISTS scheduling_start_time TIME DEFAULT '07:00';
ALTER TABLE practice_settings ADD COLUMN IF NOT EXISTS scheduling_end_time TIME DEFAULT '19:00';

-- 2. Clinical Settings (Tenant)
ALTER TABLE clinical_settings ADD COLUMN IF NOT EXISTS scheduling_start_time TIME DEFAULT '07:00';
ALTER TABLE clinical_settings ADD COLUMN IF NOT EXISTS scheduling_end_time TIME DEFAULT '19:00';

-- 3. Clinic Settings (Control DB / Public)
-- Check in all relevant locations
DO $$ 
BEGIN 
  -- Handle public.clinics if used for settings
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'clinics') THEN
    ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS scheduling_start_time TIME DEFAULT '07:00';
    ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS scheduling_end_time TIME DEFAULT '19:00';
  END IF;

  -- Handle public.clinic_settings if it exists
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'clinic_settings') THEN
    ALTER TABLE public.clinic_settings ADD COLUMN IF NOT EXISTS scheduling_start_time TIME DEFAULT '07:00';
    ALTER TABLE public.clinic_settings ADD COLUMN IF NOT EXISTS scheduling_end_time TIME DEFAULT '19:00';
  END IF;
END $$;
