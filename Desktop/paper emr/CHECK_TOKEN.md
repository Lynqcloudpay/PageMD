# How to Check Your Login Token

## In Browser Console

**Open your browser's Developer Console:**
- Chrome/Edge: Press `F12` or `Ctrl+Shift+I` (Windows) / `Cmd+Option+I` (Mac)
- Firefox: Press `F12` or `Ctrl+Shift+K` (Windows) / `Cmd+Option+K` (Mac)
- Safari: Enable Developer menu first, then `Cmd+Option+C`

**Then run this command:**
```javascript
localStorage.getItem('token')
```

**Expected result:**
- If logged in: A long string starting with `eyJ...` (JWT token)
- If not logged in: `null`

---

## Check Token Details

**To see if token exists and its length:**
```javascript
const token = localStorage.getItem('token');
console.log('Token exists:', !!token);
console.log('Token length:', token ? token.length : 0);
console.log('Token preview:', token ? token.substring(0, 50) + '...' : 'No token');
```

**To decode token (see expiration):**
```javascript
const token = localStorage.getItem('token');
if (token) {
  const payload = JSON.parse(atob(token.split('.')[1]));
  console.log('Token payload:', payload);
  console.log('Expires:', new Date(payload.exp * 1000));
  console.log('User ID:', payload.userId);
}
```

---

## If Token is Missing

1. **Clear everything and try again:**
   ```javascript
   localStorage.clear();
   location.reload();
   ```

2. **Then log in:**
   - Email: `admin@clinic.com`
   - Password: `Admin@2025!Secure`

3. **After login, check again:**
   ```javascript
   localStorage.getItem('token')
   ```

---

## Manual Token Test

If you want to manually set a token for testing:

1. **Get token from API:**
   ```bash
   curl -X POST http://localhost:3000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@clinic.com","password":"Admin@2025!Secure"}'
   ```

2. **Copy the token from the response**

3. **Set it in browser console:**
   ```javascript
   localStorage.setItem('token', 'PASTE_YOUR_TOKEN_HERE');
   location.reload();
   ```

---

## Verify Token is Being Sent

**Check Network tab:**
1. Open DevTools → Network tab
2. Make any API request (e.g., load patients)
3. Click on the request
4. Check "Headers" → "Request Headers"
5. Look for: `Authorization: Bearer eyJ...`

If you don't see the Authorization header, the token isn't being sent.

---

**Last Updated:** December 19, 2024





