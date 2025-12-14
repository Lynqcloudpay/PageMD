# Troubleshooting Guide

## Common Issues and Solutions

### 401 Unauthorized Errors

**Symptoms:**
- `401 (Unauthorized)` errors on API requests
- "No token provided" or "Invalid token" errors

**Solutions:**

1. **Check if you're logged in:**
   - Open browser DevTools → Application → Local Storage
   - Look for `token` or `authToken`
   - If missing, log in again

2. **Verify token is being sent:**
   - Check Network tab in DevTools
   - Look for `Authorization: Bearer <token>` header
   - If missing, check frontend API configuration

3. **Token expired:**
   - Tokens expire after 24 hours
   - Log out and log in again

4. **Invalid credentials:**
   - Verify email: `admin@clinic.com`
   - Verify password: `Admin@2025!Secure`
   - Try logging in via API directly:
     ```bash
     curl -X POST http://localhost:3000/api/auth/login \
       -H "Content-Type: application/json" \
       -d '{"email":"admin@clinic.com","password":"Admin@2025!Secure"}'
     ```

---

### 403 Forbidden Errors

**Symptoms:**
- `403 (Forbidden)` errors on API requests
- "Insufficient permissions" messages

**Solutions:**

1. **Admin user should bypass privilege checks:**
   - Admin users have `role_name = 'Admin'` and `is_admin = true`
   - If you're getting 403 as admin, check:
     ```sql
     SELECT email, role_id, is_admin, 
            (SELECT name FROM roles WHERE id = users.role_id) as role_name
     FROM users WHERE email = 'admin@clinic.com';
     ```

2. **Verify privileges are assigned:**
   ```sql
   SELECT p.name 
   FROM privileges p
   JOIN role_privileges rp ON p.id = rp.privilege_id
   JOIN users u ON rp.role_id = u.role_id
   WHERE u.email = 'admin@clinic.com' AND p.name LIKE 'patient:%';
   ```

3. **Check authorization middleware:**
   - Admin users should bypass `requirePrivilege` checks
   - Verify `userService.isAdmin()` returns true

---

### 500 Internal Server Error

**Symptoms:**
- `500 (Internal Server Error)` on patient routes
- "Failed to encrypt PHI field" errors in logs

**Solutions:**

1. **KMS Provider Issue:**
   - Error: "KMS_PROVIDER=local is not allowed in production"
   - **Fix:** Local KMS is now allowed on localhost even in production mode
   - Restart server after fix

2. **Encryption Key Missing:**
   - Check `encryption_keys` table has an active key:
     ```sql
     SELECT * FROM encryption_keys WHERE active = true;
     ```
   - If empty, run: `node scripts/setup-test-db.js`

3. **Database Connection:**
   - Verify PostgreSQL is running
   - Check `.env` has correct DB credentials

---

### CORS Errors

**Symptoms:**
- "Access-Control-Allow-Origin" errors
- Preflight requests failing

**Solutions:**

1. **CORS is configured** - Should work after server restart
2. **Check FRONTEND_URL in .env:**
   ```bash
   FRONTEND_URL=http://localhost:5173
   ```
3. **Verify CORS middleware is before HTTPS enforcement**

---

### Login Failed

**Symptoms:**
- "Login failed. Please check your credentials"
- Can't log in with admin credentials

**Solutions:**

1. **Verify admin account exists:**
   ```bash
   cd server
   node scripts/create-production-admin.js
   ```

2. **Check password:**
   - Default: `Admin@2025!Secure`
   - Or check database:
     ```sql
     SELECT email FROM users WHERE email = 'admin@clinic.com';
     ```

3. **Reset password:**
   ```bash
   cd server
   export ADMIN_PASSWORD="YourNewPassword123!"
   node scripts/create-production-admin.js
   ```

---

### Patients Not Loading

**Symptoms:**
- Patient list is empty
- 401/403/500 errors when fetching patients

**Solutions:**

1. **Check authentication:**
   - Verify you're logged in
   - Check token is valid

2. **Check encryption:**
   - If 500 error, check server logs for encryption errors
   - Verify KMS is working (local KMS allowed on localhost)

3. **Check database:**
   ```sql
   SELECT COUNT(*) FROM patients;
   ```
   - If 0, create a test patient

---

## Quick Diagnostic Commands

### Check Server Status
```bash
curl http://localhost:3000/api/health
```

### Test Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@clinic.com","password":"Admin@2025!Secure"}'
```

### Test API with Token
```bash
TOKEN="your-token-here"
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/patients
```

### Check Database
```bash
cd server
node -e "const {Pool}=require('pg');require('dotenv').config();const p=new Pool({host:process.env.DB_HOST||'localhost',database:process.env.DB_NAME||'paper_emr',user:process.env.DB_USER||'postgres',password:process.env.DB_PASSWORD||'postgres'});p.query('SELECT COUNT(*) as count FROM users').then(r=>{console.log('Users:',r.rows[0].count);p.end();});"
```

---

## Still Having Issues?

1. **Check server logs:**
   ```bash
   cd server
   tail -50 server.log
   ```

2. **Check browser console** for frontend errors

3. **Verify environment:**
   ```bash
   cd server
   cat .env | grep -E "NODE_ENV|DEV_MODE|KMS_PROVIDER|FRONTEND_URL"
   ```

4. **Restart everything:**
   ```bash
   # Stop server
   pkill -f "node.*index.js"
   
   # Restart
   cd server
   npm start
   ```

---

**Last Updated:** December 19, 2024





