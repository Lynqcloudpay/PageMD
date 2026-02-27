# STABLE VERSION RECOVERY GUIDE

## Current Stable Version
**Tag:** `v1.27.0-stable`
**Date:** February 27, 2026
**Commit Hash:** `677405907b2df28aa9f7c96807008db1015e0aa2`

## Features in This Stable Version
✅ **ENCOUNTER VITALS:** Support for multiple vitals readings (e.g., repeating BP) within a single visit note.
✅ **HISTORY TRACKING:** Automated history table for current encounter readings with clinical timestamps.
✅ **ABNORMAL HIGHLIGHTING:** Integrated red visual alerts for abnormal Vital Signs in the encounter history table.
✅ **UI REFINEMENT:** Ultra-thin premium section headers with improved depth and visual separation.
✅ **DELETION SUPPORT:** Ability to safely remove specific vitals readings from history.
✅ **BACKWARD COMPATIBILITY:** Robust handling of legacy single-set vitals records and new array formats.

## How to Revert to This Stable Version

### Option 1: Quick Revert (Recommended)
```bash
cd "/Volumes/Mel's SSD/paper emr"

# Fetch latest tags
git fetch --all --tags

# Revert to stable tag
git checkout v1.27.0-stable

# Deploy to production (using your SSH key)
./deploy-fast.sh /path/to/your/deploy_key.pem
```

### Option 2: Revert by Commit Hash
```bash
cd "/Volumes/Mel's SSD/paper emr"

# Revert to specific commit
git checkout 677405907b2df28aa9f7c96807008db1015e0aa2

# Deploy to production
./deploy-fast.sh /path/to/your/deploy_key.pem
```

---

## Emergency Server Recovery

If the deployment fails or the server is unresponsive:

### 1. Check Service Status
```bash
# SSH into the server
ssh -i deploy_key.pem ubuntu@pagemdemr.com

# Navigate to deployment directory
cd /home/ubuntu/emr/deploy

# Check container status
docker compose -f docker-compose.prod.yml ps
```

### 2. Restart Services
```bash
# Restart all services
docker compose -f docker-compose.prod.yml restart api
docker compose -f docker-compose.prod.yml restart caddy
```

### 3. View Logs for Debugging
```bash
docker compose -f docker-compose.prod.yml logs -f api
```

---

## Verify Deployment Success

After reverting, verify the following:

1. **Vitals History:** Check that the "New Reading" button adds a set and abnormal values highlight red.
2. **Section Headers:** Verify headers are ultra-thin and have a subtle blue background.
3. **Deletion:** Ensure you can delete a reading from the history table.
4. **Login:** Ensure you can log in at https://pagemdemr.com.

## Important Files in This Version

### Backend:
- `server/routes/inbasket.js` - Centralized sync logic for Labs, Docs, Referrals, and Notes.
- `server/routes/reports.js` - Dashboard statistics logic synced with Inbox.

### Frontend:
- `client/src/pages/Inbasket.jsx` - UI for unified categories and detail panes.
- `client/src/pages/Snapshot.jsx` - Patient overview with robust decoding.
- `client/src/components/ActionModals.jsx` - Order/Prescription modals with decoding fixes.
- `client/src/components/PatientChartPanel.jsx` - Chart summary with decoding fixes.

---
**Last Updated:** January 01, 2026
**Version:** 1.1.0 (Stable)
