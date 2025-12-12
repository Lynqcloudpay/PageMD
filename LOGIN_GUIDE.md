# How to Log In to the EMR Application

## Quick Start

### Option 1: Use Seeded Users (Recommended)

1. **Seed the database with test users:**
   ```bash
   cd server
   npm run seed
   ```

2. **Login with these credentials:**

   **Doctor/Clinician:**
   - Email: `doctor@clinic.com`
   - Password: `Password123!`

   **Nurse:**
   - Email: `nurse@clinic.com`
   - Password: `Password123!`

   **Admin:**
   - Email: `admin@clinic.com`
   - Password: `Password123!`

3. **Login via API:**
   ```bash
   curl -X POST http://localhost:3000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{
       "email": "doctor@clinic.com",
       "password": "Password123!"
     }'
   ```

   Or use the frontend login page at: `http://localhost:5173`

---

### Option 2: Development Mode (No Database Required)

If you want to test without setting up the database:

1. **Set DEV_MODE in your `.env` file:**
   ```bash
   cd server
   echo "DEV_MODE=true" >> .env
   echo "NODE_ENV=development" >> .env
   ```

2. **Login with mock credentials:**
   - Email: `doctor@clinic.com` or `test@test.com`
   - Password: (any password works in dev mode)

   **Note:** This only works when `NODE_ENV !== 'production'` for security.

---

### Option 3: Register a New User

**In Development Mode:**
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your@email.com",
    "password": "YourPassword123!",
    "firstName": "Your",
    "lastName": "Name",
    "role": "clinician"
  }'
```

**In Production:**
- Registration is admin-only
- An admin must create users

---

## Login Endpoint

**URL:** `POST /api/auth/login`

**Request Body:**
```json
{
  "email": "doctor@clinic.com",
  "password": "Password123!"
}
```

**Success Response:**
```json
{
  "user": {
    "id": 1,
    "email": "doctor@clinic.com",
    "first_name": "Dr.",
    "last_name": "Rodriguez",
    "role": "clinician"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Use the token in subsequent requests:**
```bash
curl http://localhost:3000/api/patients \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

## Troubleshooting

### "User not found" or "Invalid credentials"
- Make sure you've run `npm run seed` to create users
- Check that PostgreSQL is running
- Verify database connection in `.env`

### "DEV_MODE is not allowed in production"
- Remove `DEV_MODE=true` from `.env` if `NODE_ENV=production`
- Use real database authentication instead

### Database connection errors
- Check PostgreSQL is running: `pg_isready`
- Verify `.env` has correct DB credentials
- Run migrations: `npm run migrate`

---

## User Roles & Permissions

- **clinician**: Full access to charts, orders, e-prescribing, signing notes
- **nurse**: Vitals entry, intake, messaging, order requests
- **front_desk**: Appointments, demographics, document uploads
- **admin**: User management, audit logs, full system access

---

## Frontend Login

If you have the frontend running:

1. Navigate to: `http://localhost:5173`
2. Use the login form
3. Enter credentials from above
4. You'll be redirected to the dashboard

---

**Need help?** Check the main README.md for full setup instructions.





















