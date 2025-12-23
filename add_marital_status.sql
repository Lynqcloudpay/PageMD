-- Add marital_status column to social_history table
ALTER TABLE social_history ADD COLUMN IF NOT EXISTS marital_status VARCHAR(50);
