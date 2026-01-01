# STABLE VERSION RECOVERY GUIDE

## Current Stable Version
**Tag:** `v1.1.0-stable`
**Date:** January 01, 2026
**Commit Hash:** `200e1096eeacdfb8fa218fd9173bf82c934ae837`

## Features in This Stable Version
✅ **CORE FIX:** Synchronized Dashboard "In Basket" count with actual `inbox_items` table.
✅ **CORE FIX:** Robust HTML Entity Decoding for medications (specifically handles slashes like `&#x2F;` and `&sol;`).
✅ **ENHANCEMENT:** Integrated **Clinical Notes** (co-signing) and **Referrals** into the unified In Basket.
✅ **UI IMPROVEMENT:** Added specialized detail panes for Referrals and Notes in the In Basket.
✅ **CRITICAL FIX:** Resolved decryption and display issues across Schedule, Inbox, Superbills, and Visits.
✅ **UI POLISH:** Unified 4-pass textarea-based HTML decoding across all clinical modules.

## How to Revert to This Stable Version

### Option 1: Quick Revert (Recommended)
```bash
cd "/Volumes/Mel's SSD/paper emr"

# Fetch latest tags
git fetch --all --tags

# Revert to stable tag
git checkout v1.1.0-stable

# Deploy to production (using your SSH key)
./deploy-fast.sh /path/to/your/deploy_key.pem
```

### Option 2: Revert by Commit Hash
```bash
cd "/Volumes/Mel's SSD/paper emr"

# Revert to specific commit
git checkout 200e1096eeacdfb8fa218fd9173bf82c934ae837

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

1. **Dashboard Sync:** Check that the "In Basket" count matches the actual number of items in the In Basket page.
2. **Medication Display:** Verify medications with slashes (e.g., Sacubitril/Valsartan) display correctly without `&#x2F;`.
3. **In Basket Categories:** Verify "Clinical Notes" and "Referrals" appear in the In Basket sidebar.
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
