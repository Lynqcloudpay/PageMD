-- Migration: Upgrade sales_inquiries with UUID and Profile tracking
-- Date: 2026-02-05

-- 1. Add UUID column for secure frictionless tracking
ALTER TABLE sales_inquiries ADD COLUMN IF NOT EXISTS uuid UUID DEFAULT gen_random_uuid();

-- 2. Add lead_profile for persistent metadata (e.g. physician preferences)
ALTER TABLE sales_inquiries ADD COLUMN IF NOT EXISTS lead_profile JSONB DEFAULT '{}';

-- 3. Add activity tracking
ALTER TABLE sales_inquiries ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 4. Add email_verified flag if missing (we previously used status, but this is cleaner)
ALTER TABLE sales_inquiries ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;

-- 5. Backfill UUIDs for existing leads
UPDATE sales_inquiries SET uuid = gen_random_uuid() WHERE uuid IS NULL;

-- 6. Indices for faster lookup
CREATE INDEX IF NOT EXISTS idx_sales_inquiries_uuid ON sales_inquiries(uuid);
CREATE INDEX IF NOT EXISTS idx_sales_inquiries_email_lower ON sales_inquiries(LOWER(email));
