-- Grant admin privileges to user without changing role
-- This SQL can be run directly in the database container

-- First, ensure is_admin column exists
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- Update the user (replace email with actual email)
UPDATE users 
SET is_admin = true, updated_at = CURRENT_TIMESTAMP
WHERE email = 'mjrodriguez14@live.com';

-- Verify the update
SELECT 
  u.id, 
  u.email, 
  u.first_name, 
  u.last_name, 
  u.role_id, 
  u.is_admin, 
  r.name as role_name
FROM users u
LEFT JOIN roles r ON u.role_id = r.id
WHERE u.email = 'mjrodriguez14@live.com';



