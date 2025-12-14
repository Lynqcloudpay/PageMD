# Creating Real Production Accounts

This guide shows you how to create real production user accounts (not mock/dev accounts).

---

## Method 1: Create First Admin User (Recommended for Production)

### Step 1: Use the Production Admin Setup Script

This script creates a real admin account directly in the database:

```bash
cd server
node scripts/setup-production-admin.js
```

The script will prompt you for:
- Admin email address
- Admin password (must meet password policy: 12+ chars, complexity required)
- Admin first name
- Admin last name

**Example:**
```bash
$ node scripts/setup-production-admin.js

Enter admin email: admin@yourclinic.com
Enter admin password: YourSecurePassword123!
Enter admin first name: John
Enter admin last name: Smith

✅ Production admin account created successfully!
```

### Step 2: Login with Your Admin Account

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@yourclinic.com",
    "password": "YourSecurePassword123!"
  }'
```

---

## Method 2: Create Admin via Database (Direct SQL)

If you prefer to create the admin user directly via SQL:

```bash
# Connect to your database
psql -h localhost -U postgres -d paper_emr

# Create admin user (replace values with your own)
INSERT INTO users (
  email, 
  password_hash, 
  first_name, 
  last_name, 
  role, 
  active
) VALUES (
  'admin@yourclinic.com',
  '$2a$12$YOUR_BCRYPT_HASH_HERE',  -- Generate with: node -e "console.log(require('bcryptjs').hashSync('YourPassword123!', 12))"
  'John',
  'Smith',
  'admin',
  true
);
```

**Generate password hash:**
```bash
cd server
node -e "const bcrypt = require('bcryptjs'); bcrypt.hash('YourPassword123!', 12).then(hash => console.log(hash));"
```

---

## Method 3: Create Admin via API (If You Have Admin Access)

If you already have an admin account, you can create new users via the API:

```bash
# First, login as admin to get token
TOKEN=$(curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@yourclinic.com",
    "password": "YourPassword123!"
  }' | jq -r '.token')

# Create new user (admin only in production)
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "email": "doctor@yourclinic.com",
    "password": "SecurePassword123!",
    "firstName": "Jane",
    "lastName": "Doe",
    "role": "clinician"
  }'
```

**Note:** In production (`NODE_ENV=production`), registration requires admin authentication. In development, anyone can register.

---

## Method 4: Use Seed Script (For Testing/Development Only)

**⚠️ WARNING:** The seed script creates test accounts. Only use this for development/testing, NOT production.

```bash
cd server
npm run seed
```

This creates:
- `doctor@clinic.com` / `Password123!`
- `nurse@clinic.com` / `Password123!`
- `admin@clinic.com` / `Password123!`

**Do NOT use these in production!**

---

## Production Login Process

### 1. Ensure Production Mode

Make sure your `.env` file has:
```bash
NODE_ENV=production
DEV_MODE=false  # Must be false in production
```

### 2. Login via API

```bash
curl -X POST https://your-production-domain.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@yourclinic.com",
    "password": "YourSecurePassword123!"
  }'
```

### 3. Use the Token

The response includes a JWT token. Use it for all subsequent API requests:

```bash
TOKEN="your-jwt-token-here"

# Example: Get patients
curl https://your-production-domain.com/api/patients \
  -H "Authorization: Bearer $TOKEN"
```

---

## Password Requirements

Production passwords must meet these requirements:
- **Minimum 12 characters**
- **At least one uppercase letter**
- **At least one lowercase letter**
- **At least one number**
- **At least one special character**
- **Not a common password**

Examples of valid passwords:
- ✅ `SecurePassword123!`
- ✅ `MyClinic2024#Pass`
- ❌ `password` (too short, too common)
- ❌ `Password123` (no special character)

---

## User Roles Available

- **admin**: Full system access, user management, audit logs
- **clinician**: Full access to charts, orders, e-prescribing, signing notes
- **nurse**: Vitals entry, intake, messaging, order requests
- **front_desk**: Appointments, demographics, document uploads

---

## Security Notes

1. **Never use mock/dev accounts in production**
   - DEV_MODE is automatically disabled in production
   - Mock logins are blocked when `NODE_ENV=production`

2. **First admin must be created manually**
   - Use `setup-production-admin.js` script
   - Or create directly in database
   - Or temporarily allow registration in development, then switch to production

3. **All subsequent users require admin**
   - In production, only admins can create new users
   - Use the `/api/auth/register` endpoint with admin token

4. **Password security**
   - Passwords are hashed with bcrypt (12 rounds)
   - Never store passwords in plaintext
   - Use strong, unique passwords

---

## Troubleshooting

### "Registration is disabled in production"
- You need an admin account first
- Use `setup-production-admin.js` to create the first admin
- Then use that admin to create other users

### "DEV_MODE is not allowed in production"
- Remove `DEV_MODE=true` from `.env`
- Set `NODE_ENV=production`
- Use real database authentication

### "User already exists"
- The email is already registered
- Use a different email or reset the existing account

### "Password validation failed"
- Your password doesn't meet requirements
- See "Password Requirements" section above

---

## Quick Start for Production

```bash
# 1. Set production mode
cd server
echo "NODE_ENV=production" >> .env
echo "DEV_MODE=false" >> .env

# 2. Create first admin
node scripts/setup-production-admin.js

# 3. Login and get token
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@yourclinic.com",
    "password": "YourSecurePassword123!"
  }'

# 4. Use token for all API requests
```

---

**For more details, see:** `LOGIN_GUIDE.md`





