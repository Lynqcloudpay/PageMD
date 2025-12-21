# Revert Instructions

This document provides instructions on how to revert the application to the last known stable version (**v1.1-stable**).

## Local Development Revert
If you are working locally and need to go back to this version:

1. **Fetch the latest tags:**
   ```bash
   git fetch --tags
   ```

2. **Hard reset to the stable tag:**
   ```bash
   git reset --hard v1.1-stable
   ```
   *Warning: This will discard any uncommitted local changes.*

## Production/Server Revert (bemypcp.com)
If something breaks in production and you need to roll back:

1. **SSH into the server or run locally if you have the key:**
   ```bash
   # From your local machine with the deployment key
   ssh -i temp_deploy_key ubuntu@bemypcp.com
   ```

2. **Navigate to the EMR directory:**
   ```bash
   cd emr
   ```

3. **Force a revert to the stable tag:**
   ```bash
   git fetch --tags
   git reset --hard v1.1-stable
   ```

4. **Rebuild and restart containers:**
   ```bash
   cd deploy
   docker compose -f docker-compose.prod.yml up -d --build
   ```

## Tag Summary: v1.1-stable
- **ID:** `v1.1-stable`
- **Date:** December 21, 2024
- **Key Fixes:**
  - Resolved 500 API errors in Documents and E-Prescribe.
  - Fixed Sidebar navigation items (Schedule, Patients, etc.) being hidden.
  - Unified Visit Note view (always opens in a modal, no more blank tabs).
  - Role-based default scopes (Physicians see "My Schedule" by default).
