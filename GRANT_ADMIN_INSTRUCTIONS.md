# Grant Admin Privileges to Physician User

## ✅ Local Database - COMPLETED

The user `mjrodriguez14@live.com` has been granted admin privileges on your local database while keeping their Physician role.

## 🔄 Production Database - ACTION REQUIRED

To grant admin privileges on the production server (bemypcp.com), you need to run the script on the server.

### Option 1: Run via SSH (Recommended)

1. SSH into your production server:
   ```bash
   ssh ubuntu@bemypcp.com
   ```

2. Navigate to the app directory:
   ```bash
   cd /home/ubuntu/emr
   ```

3. Pull the latest code (if not already up to date):
   ```bash
   git pull origin main
   ```

4. Run the script inside the API container:
   ```bash
   cd deploy
   docker compose -f docker-compose.prod.yml exec api node scripts/grant-admin-to-physician.js mjrodriguez14@live.com
   ```

### Option 2: Run via Docker Exec

If you're already connected to the server:

```bash
cd /home/ubuntu/emr/deploy
docker compose -f docker-compose.prod.yml exec api node scripts/grant-admin-to-physician.js mjrodriguez14@live.com
```

### What the Script Does

1. ✅ Ensures the `is_admin` column exists in the users table
2. ✅ Finds the user by email (`mjrodriguez14@live.com`)
3. ✅ Sets `is_admin = true` **without changing their role_id**
4. ✅ The user keeps their Physician role and gains admin privileges

### Verification

After running the script, you should see output like:

```
✅ Successfully granted admin privileges!

Updated user:
  ID: ...
  Name: Melanio Rodriguez
  Email: mjrodriguez14@live.com
  Role: Physician (role_id: ...) - KEPT
  is_admin: true - GRANTED

The user now has:
  ✅ Admin privileges (can manage users, roles, settings, etc.)
  ✅ Physician role privileges (clinical access preserved)
```

### What This Means

The user `mjrodriguez14@live.com` will now have:

- **Admin Access:**
  - Manage users (create, edit, suspend, delete)
  - Manage roles and privileges
  - Access system settings
  - View audit logs
  - All admin-level features

- **Physician Access (Preserved):**
  - All clinical privileges
  - Can document visits
  - Can e-prescribe
  - Can sign notes
  - All physician-specific features

---

**Note:** The script has been committed and will be automatically deployed to your server. You just need to run it once via SSH to apply the database change.







