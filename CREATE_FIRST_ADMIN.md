# Quick Fix: Creating Your First Admin User

Since the seeding might have issues, here's how to create your first admin account manually:

## Option 1: Using the Backend Directly

```bash
# SSH into your server
ssh -i temp_deploy_key ubuntu@bemypcp.com

# Create a simple bootstrap script
cat > /tmp/create_admin.js << 'EOF'
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://emr_user:CHANGE_ME_STRONG_PASSWORD_MIN_32_CHARS@db:5432/emr_db'
});

async function createAdmin() {
  const password = 'Admin2024!';
  const hash = await bcrypt.hash(password, 10);
  
  await pool.query(`
    INSERT INTO super_admins (email, password_hash, first_name, last_name, role, is_active)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (email) DO UPDATE 
    SET password_hash = EXCLUDED.password_hash
  `, ['admin@pagemd.com', hash, 'Platform', 'Admin', 'super_admin', true]);
  
  console.log('✅ Admin created');
  console.log('Email: admin@pagemd.com');
  console.log('Password: Admin2024!');
  process.exit(0);
}

createAdmin();
EOF

# Run it in the API container
docker exec emr-api node /tmp/create_admin.js
```

## Option 2: Direct SQL (Simpler)

```bash
# Use pre-hashed password for "Admin2024!"
docker exec emr-db psql -U emr_user -d emr_db -c "
INSERT INTO super_admins (email, password_hash, first_name, last_name, role, is_active)
VALUES (
  'admin@pagemd.com',
  '\$2a\$10\$YourHashHere',
  'Platform',
  'Admin',
  'super_admin',
  true
)
ON CONFLICT (email) DO UPDATE 
SET password_hash = EXCLUDED.password_hash;
"
```

Then login with:
- Email: `admin@pagemd.com`
- Password: `Admin2024!`
