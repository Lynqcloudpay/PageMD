# Revert Instructions

This document provides instructions on how to revert the application to the last known stable version (**v1.27.0-stable**).

## Local Development Revert
If you are working locally and need to go back to this version:

1. **Fetch the latest tags:**
   ```bash
   git fetch --tags
   ```

2. **Hard reset to the stable tag:**
   ```bash
   git reset --hard v1.27.0-stable
   ```
   *Warning: This will discard any uncommitted local changes.*

## Production/Server Revert (pagemdemr.com)
If something breaks in production and you need to roll back:

1. **SSH into the server or run locally if you have the key:**
   ```bash
   # From your local machine with the deployment key
   ssh -i lightsail-key.pem ubuntu@pagemdemr.com
   ```

2. **Navigate to the EMR directory:**
   ```bash
   cd emr
   ```

3. **Force a revert to the stable tag:**
   ```bash
   git fetch --tags
   git reset --hard v1.27.0-stable
   ```

4. **Rebuild and restart containers:**
   ```bash
   cd deploy
   docker compose -f docker-compose.prod.yml up -d --build
   ```

## Tag Summary: v1.27.0-stable
- **ID:** `v1.27.0-stable`
- **Date:** February 27, 2026
- **Key Features:**
  - Multiple Encounter Vitals: Support for rechecking vitals (BP/HR) in a single visit.
  - Clinical History Tracking: Encounter vitals history with abnormal value highlighting (Red).
  - UI Refinements: Ultra-thin premium section headers and improved visual depth.
  - Robust stability and cross-device synchronization.
