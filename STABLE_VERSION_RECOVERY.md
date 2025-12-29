# STABLE VERSION RECOVERY GUIDE

## Current Stable Version
**Tag:** `stable-release-v1.0`
**Date:** December 29, 2025

## Features in This Stable Version
✅ **CRITICAL FIX:** Correctly decrypts patient names in Schedule, Inbox, Superbills, and Visits
✅ **CRITICAL FIX:** Resolved Content Security Policy (CSP) blocking logins on bemypcp.com (added mult-domain support)
✅ **ENHANCEMENT:** Updated Landing Page with "Made for Physicians by Physicians" branding and verified copy
✅ Social History inline editing with proper field mapping
✅ Social History real-time sync via event listeners
✅ Navigation buttons correctly point to Patient Chart
✅ Pending Notes shows all draft visits
✅ Visit notes load correctly
✅ All PAMFOS working
✅ Backend API stable and running
✅ Database healthy
✅ Caddy reverse proxy correctly configured for bemypcp.com

## How to Revert to This Stable Version

### Option 1: Quick Revert (Recommended)
```bash
cd "/Volumes/Mel's SSD/paper emr"

# Revert to stable version
git fetch origin
git checkout v1.0.0-stable

# Deploy to production
./deploy-to-lightsail.sh temp_deploy_key
```

### Option 2: Revert by Commit Hash
```bash
cd "/Volumes/Mel's SSD/paper emr"

# Revert to specific commit
git checkout ad13621fa329f3065321150fad3b3e7f05bace61

# Deploy to production
./deploy-to-lightsail.sh temp_deploy_key
```

### Option 3: Create New Branch from Stable
```bash
cd "/Volumes/Mel's SSD/paper emr"

# Create a recovery branch
git checkout -b recovery-from-stable v1.0.0-stable

# Deploy to production
./deploy-to-lightsail.sh temp_deploy_key
```

## Emergency Server Recovery

If the deployment fails or server is unresponsive:

```bash
# SSH into the server
ssh -i temp_deploy_key ubuntu@bemypcp.com

# Navigate to deployment directory
cd /home/ubuntu/emr/deploy

# Restart all services
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d

# Check service status
docker compose -f docker-compose.prod.yml ps

# View logs if needed
docker compose -f docker-compose.prod.yml logs api
docker compose -f docker-compose.prod.yml logs db
```

## Verify Deployment Success

After reverting, verify the following:

1. **Login Works:** Visit https://bemypcp.com and log in
2. **Visit Notes Load:** Open a patient chart and create/view a visit note
3. **Social History Saves:** Edit social history fields and verify they save
4. **Pending Notes Shows Drafts:** Check the Pending Notes tab shows draft visits
5. **Navigation Works:** Test "Back to Patient Chart" buttons

## Important Files Modified in This Version

### Frontend Changes:
- `client/src/pages/VisitNote.jsx` - Social History inline editing, navigation fixes, event listener
- `client/src/pages/PendingNotes.jsx` - (No changes, but works with backend fix)

### Backend Changes:
- `server/routes/appointments.js` - Added encryption metadata selection and decryption logic
- `server/routes/inbox.js` - Added encryption metadata selection and decryption logic
- `server/routes/visits.js` - Added encryption metadata selection and decryption logic
- `server/routes/superbills.js` - Added encryption metadata selection and decryption logic
- `server/middleware/https.js` - Updated CSP for multi-domain support
- `deploy/Caddyfile` - Updated configuration for bemypcp.com and CSP
- `deploy-fast.sh` - Added Caddy container restart

### Frontend Changes:
- `client/src/pages/LandingPage.jsx` - Updated branding and copy

## Database State
The database schema is stable and requires no migrations for this version.

## Known Issues (None)
This version has no known critical issues. All core functionality is working as expected.

## Next Steps After Revert
1. Test all critical features
2. Identify what broke in the newer version
3. Fix the issue in a new branch
4. Test thoroughly before deploying
5. Create a new stable tag when ready

## Support
If you encounter issues reverting:
1. Check the deployment logs
2. Verify SSH key permissions: `chmod 600 temp_deploy_key`
3. Ensure Docker is running on the server
4. Check server disk space: `df -h`
5. Review server logs: `docker compose -f docker-compose.prod.yml logs`

---
**Last Updated:** December 21, 2025
**Maintained By:** Development Team
