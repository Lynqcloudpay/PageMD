# Deploy Login Timeout Fix

## Changes Made
1. **Client timeout increased**: 20s → 45s for login requests
2. **General API timeout**: 10s → 30s  
3. **Database connection timeout**: 5s → 10s (production)
4. **Caddy reverse proxy**: Added explicit timeout configuration

## Files Changed
- `client/src/services/api.js` - Increased timeouts
- `server/db.js` - Increased database connection timeout
- `deploy/Caddyfile` - Added transport timeout config
- `client/vite.config.js` - Optimized build performance

## Manual Deployment Steps

Since SSH key is not available locally, deploy manually:

### Option 1: SSH to Server and Deploy
```bash
# Connect to server (use your SSH key)
ssh ubuntu@bemypcp.com

# Navigate to app directory
cd /home/ubuntu/emr

# Pull latest changes
git stash || true
git fetch origin
git checkout main
git pull origin main

# Rebuild and restart services
cd deploy
docker compose -f docker-compose.prod.yml up -d --build api web

# Verify deployment
docker compose -f docker-compose.prod.yml ps
curl -I https://bemypcp.com/api/health
```

### Option 2: Use GitHub Actions
1. Push changes to GitHub (if not already pushed)
2. Go to: https://github.com/Lynqcloudpay/PageMD/actions
3. Manually trigger "Deploy to AWS Lightsail" workflow
4. Wait for deployment to complete

### Option 3: Direct File Update on Server
If you have server access, you can manually update the files:

1. **Update `client/src/services/api.js`** on server:
   - Change login timeout to 45000
   - Change general timeout to 30000

2. **Update `server/db.js`** on server:
   - Change connectionTimeoutMillis to 10000 for production

3. **Rebuild containers**:
   ```bash
   cd /home/ubuntu/emr/deploy
   docker compose -f docker-compose.prod.yml build --no-cache api web
   docker compose -f docker-compose.prod.yml up -d api web
   ```

## Verification

After deployment, test login:
1. Go to https://bemypcp.com/login
2. Try logging in with your credentials
3. Should no longer timeout after 20 seconds

## Rollback

If issues occur, rollback:
```bash
cd /home/ubuntu/emr
git checkout HEAD~1
cd deploy
docker compose -f docker-compose.prod.yml up -d --build api web
```






