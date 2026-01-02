-- Sales Inquiries table for tracking sandbox access requests and sales leads
-- Run this on the production database

CREATE TABLE IF NOT EXISTS sales_inquiries (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    practice_name VARCHAR(255),
    provider_count VARCHAR(50),
    message TEXT,
    interest_type VARCHAR(50),
    source VARCHAR(100),
    status VARCHAR(50) DEFAULT 'new',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Index for filtering by status
CREATE INDEX IF NOT EXISTS idx_sales_inquiries_status ON sales_inquiries(status);

-- Index for sorting by date
CREATE INDEX IF NOT EXISTS idx_sales_inquiries_created_at ON sales_inquiries(created_at DESC);
