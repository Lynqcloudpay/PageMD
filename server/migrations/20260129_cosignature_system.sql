-- Migration: Commercial-Grade Clinical Cosignature System
-- Date: 2026-01-29

-- 1. Add columns to visits table (targeting tenant_gov_p2)
ALTER TABLE tenant_gov_p2.visits ADD COLUMN IF NOT EXISTS cosigned_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE tenant_gov_p2.visits ADD COLUMN IF NOT EXISTS cosigned_by UUID REFERENCES tenant_gov_p2.users(id);
ALTER TABLE tenant_gov_p2.visits ADD COLUMN IF NOT EXISTS attestation_text TEXT;
ALTER TABLE tenant_gov_p2.visits ADD COLUMN IF NOT EXISTS authorship_model VARCHAR(50) DEFAULT 'Addendum';

-- 2. Ensure status enum includes 'preliminary' if it were an enum, 
-- but it's a character varying(50), so we just add a check constraint if desired.
ALTER TABLE tenant_gov_p2.visits DROP CONSTRAINT IF EXISTS visits_status_check;
ALTER TABLE tenant_gov_p2.visits ADD CONSTRAINT visits_status_check 
    CHECK (status IN ('draft', 'preliminary', 'signed', 'voided', 'retracted'));

-- 3. Add Resident and Medical Student roles to tenant_gov_p2.roles
INSERT INTO tenant_gov_p2.roles (name, description, is_system_role)
VALUES 
    ('Resident', 'Licensed physician in training (requires cosignature)', true),
    ('Medical Student', 'Student in medical school (requires cosignature and verification)', true)
ON CONFLICT (name) DO NOTHING;

-- 4. Add Resident and Medical Student roles to public.roles for consistency
INSERT INTO public.roles (name, description, is_system_role)
VALUES 
    ('Resident', 'Licensed physician in training (requires cosignature)', true),
    ('Medical Student', 'Student in medical school (requires cosignature and verification)', true)
ON CONFLICT (name) DO NOTHING;

-- 5. Add columns to public.visits for consistency (even if not active)
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS cosigned_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS cosigned_by UUID REFERENCES public.users(id);
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS attestation_text TEXT;
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS authorship_model VARCHAR(50) DEFAULT 'Addendum';
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'draft';

-- 6. Add sign_cosignature privilege if not exists
INSERT INTO privileges (name, description, category)
VALUES ('notes:cosign', 'Ability to cosign clinical notes and apply attestations', 'Clinical')
ON CONFLICT (name) DO NOTHING;
