-- Add finalization tracking columns for converted leads
-- A finalized lead is considered "done" and won't appear in active searches
-- until they re-enroll via a new sandbox verification code

ALTER TABLE sales_inquiries 
ADD COLUMN IF NOT EXISTS is_finalized BOOLEAN DEFAULT false;

ALTER TABLE sales_inquiries 
ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMP WITH TIME ZONE;

-- Index for efficient filtering of active leads
CREATE INDEX IF NOT EXISTS idx_sales_inquiries_finalized 
ON sales_inquiries(is_finalized) WHERE is_finalized = false;

COMMENT ON COLUMN sales_inquiries.is_finalized IS 'True when lead is converted and considered complete. Reset to false if customer re-enrolls.';
COMMENT ON COLUMN sales_inquiries.finalized_at IS 'Timestamp when the lead was finalized (converted).';
