# How to Add DoseSpot Environment Variables

## Step 1: Edit the Production Environment File

On your production server, edit the `.env.prod` file:

```bash
# SSH into your server
ssh ubuntu@bemypcp.com

# Navigate to the deploy directory
cd /path/to/your/emr/deploy

# Edit the .env.prod file (or create it if it doesn't exist)
nano .env.prod
```

## Step 2: Add the DoseSpot Variables

Add these lines to your `.env.prod` file:

```bash
# ============================================
# ePrescribing (DoseSpot)
# ============================================
# Set to 'dosespot' to enable DoseSpot, or 'internal' to use built-in engine
EPRESCRIBE_PROVIDER=dosespot

# DoseSpot API configuration (get these from your DoseSpot vendor portal)
DOSESPOT_BASE_URL=https://api.dosespot.com
DOSESPOT_CLIENT_ID=your_actual_client_id_here
DOSESPOT_CLIENT_SECRET=your_actual_client_secret_here
DOSESPOT_CLINIC_ID=your_actual_clinic_id_here
DOSESPOT_WEBHOOK_SECRET=your_webhook_secret_here

# Enable EPCS (controlled substances) - only set to true after certification
EPRESCRIBE_EPCS_ENABLED=false
```

**Important:** Replace the placeholder values with your actual DoseSpot credentials from your vendor account.

## Step 3: Restart Docker Containers

After saving the file, restart the API container to load the new variables:

```bash
# From the deploy directory
docker-compose -f docker-compose.prod.yml restart api

# Or if you need to rebuild
docker-compose -f docker-compose.prod.yml up -d --build api
```

## Step 4: Verify It's Working

Check the API logs to confirm DoseSpot is initialized:

```bash
docker logs emr-api | grep -i dosespot
```

You should see either:
- `[DoseSpotService] EPRESCRIBE_PROVIDER is not set to "dosespot", service disabled` (if not configured)
- Or no errors if DoseSpot is properly configured

## Alternative: Use Internal Engine (No DoseSpot)

If you want to use the built-in prescription engine instead:

```bash
# In .env.prod, either:
EPRESCRIBE_PROVIDER=internal

# Or simply don't set it (defaults to internal)
```

## Getting DoseSpot Credentials

1. Log into your DoseSpot vendor portal
2. Navigate to API/Integration settings
3. Generate or retrieve:
   - Client ID
   - Client Secret
   - Clinic ID
   - Webhook Secret (for status updates)

## Security Notes

- **Never commit `.env.prod` to git** - it contains sensitive credentials
- Keep your DoseSpot credentials secure
- Rotate secrets regularly
- Use different credentials for development vs production

## Troubleshooting

If DoseSpot doesn't work after adding variables:

1. **Check variables are loaded:**
   ```bash
   docker exec emr-api env | grep DOSESPOT
   ```

2. **Check API logs:**
   ```bash
   docker logs emr-api --tail 50
   ```

3. **Verify provider setting:**
   ```bash
   curl https://bemypcp.com/api/eprescribe/status
   ```
   Should return `{"enabled": true, "provider": "dosespot", ...}` if configured correctly

