-- Add verification_code column to sales_inquiries
ALTER TABLE sales_inquiries 
ADD COLUMN IF NOT EXISTS verification_code VARCHAR(6);

-- Optional: Add index for faster lookup during code verification
CREATE INDEX IF NOT EXISTS idx_sales_inquiries_code ON sales_inquiries(verification_code);
