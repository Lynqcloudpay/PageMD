-- Smart Gate Lead Verification Migration
-- Adds columns for email verification, reCAPTCHA scoring, and disposable email detection

-- Add verification token and expiry
ALTER TABLE sales_inquiries 
ADD COLUMN IF NOT EXISTS verification_token VARCHAR(255),
ADD COLUMN IF NOT EXISTS verification_expires_at TIMESTAMP WITH TIME ZONE;

-- Add email verification status
ALTER TABLE sales_inquiries 
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;

-- Add reCAPTCHA score tracking
ALTER TABLE sales_inquiries 
ADD COLUMN IF NOT EXISTS recaptcha_score FLOAT;

-- Add disposable email flag
ALTER TABLE sales_inquiries 
ADD COLUMN IF NOT EXISTS is_disposable_email BOOLEAN DEFAULT FALSE;

-- Index for token lookups
CREATE INDEX IF NOT EXISTS idx_sales_inquiries_verification_token 
ON sales_inquiries(verification_token) WHERE verification_token IS NOT NULL;
