-- Migration: Ensure all Sales columns exist
-- Date: 2026-02-06

-- 1. Ensure sales_inquiries has all advanced columns
DO $$ 
BEGIN 
    -- uuid
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales_inquiries' AND column_name='uuid') THEN
        ALTER TABLE sales_inquiries ADD COLUMN uuid UUID DEFAULT gen_random_uuid();
    END IF;
    -- referral_code
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales_inquiries' AND column_name='referral_code') THEN
        ALTER TABLE sales_inquiries ADD COLUMN referral_code VARCHAR(100);
    END IF;
    -- referral_activated
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales_inquiries' AND column_name='referral_activated') THEN
        ALTER TABLE sales_inquiries ADD COLUMN referral_activated BOOLEAN DEFAULT false;
    END IF;
    -- referral_activated_at
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales_inquiries' AND column_name='referral_activated_at') THEN
        ALTER TABLE sales_inquiries ADD COLUMN referral_activated_at TIMESTAMP WITH TIME ZONE;
    END IF;
    -- verification_token
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales_inquiries' AND column_name='verification_token') THEN
        ALTER TABLE sales_inquiries ADD COLUMN verification_token TEXT;
    END IF;
    -- verification_code
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales_inquiries' AND column_name='verification_code') THEN
        ALTER TABLE sales_inquiries ADD COLUMN verification_code VARCHAR(10);
    END IF;
    -- verification_expires_at
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales_inquiries' AND column_name='verification_expires_at') THEN
        ALTER TABLE sales_inquiries ADD COLUMN verification_expires_at TIMESTAMP WITH TIME ZONE;
    END IF;
    -- email_verified
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales_inquiries' AND column_name='email_verified') THEN
        ALTER TABLE sales_inquiries ADD COLUMN email_verified BOOLEAN DEFAULT false;
    END IF;
    -- recaptcha_score
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales_inquiries' AND column_name='recaptcha_score') THEN
        ALTER TABLE sales_inquiries ADD COLUMN recaptcha_score DECIMAL(3,2);
    END IF;
    -- is_disposable_email
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales_inquiries' AND column_name='is_disposable_email') THEN
        ALTER TABLE sales_inquiries ADD COLUMN is_disposable_email BOOLEAN DEFAULT false;
    END IF;
    -- suggested_seller_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales_inquiries' AND column_name='suggested_seller_id') THEN
        ALTER TABLE sales_inquiries ADD COLUMN suggested_seller_id INTEGER;
    END IF;
    -- last_activity_at
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales_inquiries' AND column_name='last_activity_at') THEN
        ALTER TABLE sales_inquiries ADD COLUMN last_activity_at TIMESTAMP WITH TIME ZONE;
    END IF;
    -- is_claimed
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales_inquiries' AND column_name='is_claimed') THEN
        ALTER TABLE sales_inquiries ADD COLUMN is_claimed BOOLEAN DEFAULT false;
    END IF;
    -- claimed_by
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales_inquiries' AND column_name='claimed_by') THEN
        ALTER TABLE sales_inquiries ADD COLUMN claimed_by INTEGER;
    END IF;
    -- claimed_at
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales_inquiries' AND column_name='claimed_at') THEN
        ALTER TABLE sales_inquiries ADD COLUMN claimed_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- 2. Ensure sales_team_users exists and has meeting_link
CREATE TABLE IF NOT EXISTS sales_team_users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE,
    zoom_link VARCHAR(255),
    meeting_link VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    role VARCHAR(50) DEFAULT 'seller',
    last_assigned_at TIMESTAMP WITH TIME ZONE
);

-- 3. Ensure sales_demos exists
CREATE TABLE IF NOT EXISTS sales_demos (
    id SERIAL PRIMARY KEY,
    inquiry_id INTEGER REFERENCES sales_inquiries(id) ON DELETE CASCADE,
    seller_id INTEGER REFERENCES sales_team_users(id),
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    notes TEXT,
    zoom_link VARCHAR(255),
    meeting_link VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending', 
    response_notes TEXT,
    responded_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE
);

-- 4. Ensure sales_inquiry_logs exists
CREATE TABLE IF NOT EXISTS sales_inquiry_logs (
    id SERIAL PRIMARY KEY,
    inquiry_id INTEGER REFERENCES sales_inquiries(id) ON DELETE CASCADE,
    admin_id INTEGER REFERENCES sales_team_users(id),
    admin_name VARCHAR(100),
    type VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Final check for meeting_link columns
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales_team_users' AND column_name='meeting_link') THEN
        ALTER TABLE sales_team_users ADD COLUMN meeting_link VARCHAR(255);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales_demos' AND column_name='meeting_link') THEN
        ALTER TABLE sales_demos ADD COLUMN meeting_link VARCHAR(255);
    END IF;
END $$;
