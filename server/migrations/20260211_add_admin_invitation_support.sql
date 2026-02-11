-- Migration: Add invitation support to Platform and Sales admin tables

-- Update super_admins (Platform Admin)
ALTER TABLE super_admins 
ADD COLUMN IF NOT EXISTS invite_token UUID,
ADD COLUMN IF NOT EXISTS invite_expires_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE super_admins 
ALTER COLUMN password_hash DROP NOT NULL;

-- Update sales_team_users (Sales Admin)
ALTER TABLE sales_team_users 
ADD COLUMN IF NOT EXISTS invite_token UUID,
ADD COLUMN IF NOT EXISTS invite_expires_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE sales_team_users 
ALTER COLUMN password_hash DROP NOT NULL;
