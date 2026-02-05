-- Add last_viewed_at to track when an admin last looked at a lead
ALTER TABLE sales_inquiries ADD COLUMN IF NOT EXISTS last_viewed_at TIMESTAMP WITH TIME ZONE DEFAULT '-infinity';

-- Update the view to include a count of unread logs or activity
-- We can do this in the query itself or add a helper column.
-- For now, we'll just add the column.
