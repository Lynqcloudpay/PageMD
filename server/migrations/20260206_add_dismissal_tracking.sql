-- Add dismissal tracking columns to sales_inquiries
-- These track when/why/by whom a lead was dismissed for salvage recovery

ALTER TABLE sales_inquiries 
ADD COLUMN IF NOT EXISTS dismissal_reason VARCHAR(50);

ALTER TABLE sales_inquiries 
ADD COLUMN IF NOT EXISTS dismissal_notes TEXT;

ALTER TABLE sales_inquiries 
ADD COLUMN IF NOT EXISTS dismissed_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE sales_inquiries 
ADD COLUMN IF NOT EXISTS dismissed_by INTEGER REFERENCES sales_users(id);

-- Create index for efficient salvage queries
CREATE INDEX IF NOT EXISTS idx_sales_inquiries_dismissal 
ON sales_inquiries(dismissal_reason) WHERE dismissal_reason IS NOT NULL;

COMMENT ON COLUMN sales_inquiries.dismissal_reason IS 'Reason for dismissal: spam, not_interested, bad_timing, budget, competitor, wrong_contact, other';
COMMENT ON COLUMN sales_inquiries.dismissal_notes IS 'Required notes explaining why the lead was dismissed';
COMMENT ON COLUMN sales_inquiries.dismissed_at IS 'Timestamp when the lead was dismissed';
COMMENT ON COLUMN sales_inquiries.dismissed_by IS 'User ID of the seller who dismissed the lead';
