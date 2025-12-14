# 🔥 Fix: Connection Timeout Error

## Problem
The error "Connection timed out" means your AWS Lightsail firewall is blocking SSH connections from GitHub Actions.

## Solution: Update Lightsail Firewall

You need to allow SSH (port 22) from all IP addresses so GitHub Actions can connect.

### Step 1: Access AWS Lightsail Console

1. Go to: https://lightsail.aws.amazon.com/
2. Log in to your AWS account
3. Find your instance (the one with IP `52.207.142.228`)

### Step 2: Update Firewall Rules

1. Click on your Lightsail instance
2. Click on the **"Networking"** tab
3. Scroll down to **"Firewall"** section
4. Find the SSH (22) rule

### Step 3: Edit the SSH Rule

**You'll see the SSH rule is currently restricted to a specific IP (like `73.56.192.125`)**

1. Click the **Edit icon** (pencil) next to the SSH rule in the table
2. **Uncheck the "Restrict to IP address" checkbox**
   - This will automatically set it to "Any IPv4 address" (same as your HTTP/HTTPS rules)
   - Do NOT try to enter `0.0.0.0/0` manually - Lightsail doesn't accept that format
3. Click **"Save"** or **"Save rule"**

**Note:** Your HTTP (80) and HTTPS (443) rules already allow "Any IPv4 address" - SSH should match this setting by unchecking the restriction.

**Option B: Keep restricted but add GitHub IP ranges** (More secure but requires maintenance)

GitHub Actions IP ranges change frequently. You'd need to:
1. Find current GitHub Actions IP ranges: https://api.github.com/meta
2. Add each range to your firewall
3. Update regularly when they change

**Option A is recommended** because:
- ✅ SSH key authentication provides security
- ✅ No maintenance needed
- ✅ Works with GitHub Actions automatically
- ✅ Common practice for automated deployments

### Step 4: Verify the Change

1. The firewall rule should now show:
   - SSH (22) - TCP - 0.0.0.0/0
2. Wait 1-2 minutes for the change to take effect

### Step 5: Test the Deployment

1. Go back to GitHub: https://github.com/Lynqcloudpay/PageMD/actions
2. Click **"Deploy to AWS Lightsail"** workflow
3. Click **"Run workflow"** → **"Run workflow"**
4. The deployment should now connect successfully!

## Security Note

Allowing SSH from `0.0.0.0/0` is safe because:
- ✅ Your SSH key is required to connect (password auth should be disabled)
- ✅ Only your private key (stored securely in GitHub Secrets) can authenticate
- ✅ Random connection attempts will be rejected without the key
- ✅ This is standard practice for automated deployments

## Alternative: Use a Webhook (More Complex)

If you prefer not to open SSH to all IPs, you can:
1. Set up a webhook endpoint on your server
2. Have GitHub Actions trigger the webhook
3. Have your server pull and deploy on webhook receipt

This requires more setup but keeps SSH more restricted.

---

**Quick Summary:**
1. Go to Lightsail Console → Your Instance → Networking → Firewall
2. Add/edit SSH (22) rule to allow from `0.0.0.0/0`
3. Save
4. Test deployment again

**This should fix the "Connection timed out" error!**

