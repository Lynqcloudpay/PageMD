# 🔍 Debugging Deployment Failures

If your GitHub Actions deployment is failing, follow these steps to diagnose and fix the issue.

## Step 1: Check the Workflow Logs

1. Go to: https://github.com/Lynqcloudpay/PageMD/actions
2. Click on the failed workflow run
3. Click on the "Deploy to Production" job
4. Expand the failed step to see the error message

## Common Issues and Solutions

### ❌ SSH Connection Failed

**Error:** `Connection timed out` or `Permission denied (publickey)` or `SSH connection test failed`

**Causes:**
- **Connection timed out**: Lightsail firewall blocking SSH from GitHub Actions
- SSH key not matching the server
- Key format issues
- Wrong host or user

#### Fix Connection Timeout (Most Common!)

**Error:** `connect to host *** port 22: Connection timed out`

This means your Lightsail firewall is blocking GitHub Actions.

**Quick Fix:**
1. Go to AWS Lightsail Console → Your Instance → Networking → Firewall
2. Edit SSH (22) rule to allow from `0.0.0.0/0`
3. Save
4. Wait 1-2 minutes, then retry deployment

**Detailed instructions:** See `FIX_FIREWALL.md`

**Why this is safe:**
- SSH key authentication is still required
- Only your GitHub Actions can authenticate with the stored key
- This is standard practice for automated deployments

**Solutions:**

1. **Verify your SSH key format:**
   - The key in GitHub Secrets should start with `-----BEGIN RSA PRIVATE KEY-----` or `-----BEGIN OPENSSH PRIVATE KEY-----`
   - Must include the END line: `-----END RSA PRIVATE KEY-----` or `-----END OPENSSH PRIVATE KEY-----`
   - No extra spaces or characters

2. **Test SSH connection manually:**
   ```bash
   # Save your key to a file locally
   nano ~/.ssh/test_lightsail_key
   # Paste your private key, save (Ctrl+X, Y, Enter)
   chmod 600 ~/.ssh/test_lightsail_key
   
   # Test connection
   ssh -i ~/.ssh/test_lightsail_key ubuntu@bemypcp.com
   ```
   
   If this works, your key is correct. If not, the key on the server might be different.

3. **Check GitHub Secrets:**
   - Go to: https://github.com/Lynqcloudpay/PageMD/settings/secrets/actions
   - Verify `LIGHTSAIL_SSH_KEY` contains the EXACT key (copy-paste from the file you just tested)
   - Make sure there are no extra spaces or line breaks

4. **If key doesn't work, you may need to add it to the server:**
   ```bash
   # SSH into server (using a working method)
   ssh ubuntu@bemypcp.com
   
   # Add your public key to authorized_keys
   echo "your-public-key-here" >> ~/.ssh/authorized_keys
   chmod 600 ~/.ssh/authorized_keys
   ```

### ❌ Directory Not Found

**Error:** `App directory not found!` or `deploy/ directory not found`

**Solutions:**

1. **Find where your app is actually located:**
   ```bash
   ssh ubuntu@bemypcp.com
   find ~ -name "docker-compose.prod.yml" -type f
   ```

2. **If the directory is different, update the workflow:**
   - Edit `.github/workflows/deploy-to-lightsail.yml`
   - Change the `DEPLOY_DIR` value in the `env:` section
   - Or add your directory to the search paths

3. **If the app doesn't exist on the server, you need to clone it first:**
   ```bash
   ssh ubuntu@bemypcp.com
   cd /home/ubuntu
   git clone https://github.com/Lynqcloudpay/PageMD.git emr
   cd emr
   ```

### ❌ Git Repository Not Found

**Error:** `Not a git repository!` or `Git pull failed`

**Solutions:**

1. **If the directory exists but isn't a git repo:**
   - The workflow will try to initialize it automatically
   - Or manually initialize:
     ```bash
     ssh ubuntu@bemypcp.com
     cd /home/ubuntu/emr  # or wherever your app is
     git init
     git remote add origin https://github.com/Lynqcloudpay/PageMD.git
     git fetch origin
     git checkout -b main origin/main
     ```

### ❌ Docker Command Failed

**Error:** `docker compose` command failed

**Solutions:**

1. **Check if Docker Compose is installed:**
   ```bash
   ssh ubuntu@bemypcp.com
   docker compose version
   ```
   
   If that fails, try:
   ```bash
   docker-compose version
   ```
   
   If it's the old version (`docker-compose`), we may need to update the workflow.

2. **Check Docker permissions:**
   ```bash
   # Make sure ubuntu user is in docker group
   sudo usermod -aG docker ubuntu
   # Log out and back in
   exit
   ssh ubuntu@bemypcp.com
   docker ps  # Should work without sudo
   ```

### ❌ Environment File Missing

**Error:** `.env.prod not found`

**Solutions:**

1. **The workflow will create it from the example, but you need to configure it:**
   ```bash
   ssh ubuntu@bemypcp.com
   cd /home/ubuntu/emr/deploy
   nano .env.prod
   # Fill in all required values (see env.prod.example)
   ```

## Step 2: Manual Testing

Before relying on GitHub Actions, test the deployment manually:

1. **Test SSH connection:**
   ```bash
   ./test-ssh-connection.sh ~/.ssh/your-key
   ```

2. **Test deployment script:**
   ```bash
   ./deploy-to-lightsail.sh ~/.ssh/your-key
   ```

## Step 3: View Detailed Logs

The improved workflow now includes verbose SSH output. Check the workflow logs for:
- SSH connection details
- Directory search results
- Git operation results
- Docker command outputs

## Quick Fix Checklist

- [ ] SSH key in GitHub Secrets matches the server
- [ ] LIGHTSAIL_HOST is correct (`bemypcp.com`)
- [ ] LIGHTSAIL_USER is correct (`ubuntu`)
- [ ] App directory exists on server (`/home/ubuntu/emr` or similar)
- [ ] App directory is a git repository
- [ ] Docker and docker compose are installed
- [ ] Ubuntu user has docker permissions (no sudo needed)

## Still Having Issues?

1. Check the latest workflow run logs: https://github.com/Lynqcloudpay/PageMD/actions
2. Compare with the error messages above
3. Try manual deployment first: `./deploy-to-lightsail.sh`
4. Verify server setup matches the deployment guide

---

**Server Info:**
- Host: bemypcp.com (52.207.142.228)
- User: ubuntu
- Expected App Path: /home/ubuntu/emr

