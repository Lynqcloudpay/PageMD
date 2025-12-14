# GitHub Actions Deployment Setup Guide

This guide will help you set up automatic deployment to your AWS Lightsail server whenever you push code to the `main` branch.

## 🔐 Step 1: Get Your SSH Private Key

You need the SSH private key that allows access to your Lightsail server.

**You already have your RSA private key!** Use the key you have (starting with `-----BEGIN RSA PRIVATE KEY-----`).

### Option A: Save Key to File (Recommended for Testing)

1. Create a secure file with your key:
   ```bash
   # Save your private key to a file
   nano ~/.ssh/lightsail_key.pem
   # Paste your entire key (including BEGIN/END lines)
   # Save and exit (Ctrl+X, then Y, then Enter)
   ```

2. Set secure permissions:
   ```bash
   chmod 600 ~/.ssh/lightsail_key.pem
   ```

3. Test the connection:
   ```bash
   # From your project directory
   ./test-ssh-connection.sh ~/.ssh/lightsail_key.pem
   ```

### Option B: Use Key Directly for GitHub Secrets

Just copy the entire key content (starting with `-----BEGIN RSA PRIVATE KEY-----` and ending with `-----END RSA PRIVATE KEY-----`) to use in Step 2.

## 🔑 Step 2: Add GitHub Secrets

1. Go to your GitHub repository: https://github.com/Lynqcloudpay/PageMD
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret** for each of the following:

### Required Secrets:

#### `LIGHTSAIL_SSH_KEY`
- **Value**: Paste your entire SSH private key (from Step 1)
- **IMPORTANT**: Include the `-----BEGIN RSA PRIVATE KEY-----` and `-----END RSA PRIVATE KEY-----` lines
- Paste the complete key including all lines between BEGIN and END
- This is the private key content, NOT the file path
- **Example format:**
  ```
  -----BEGIN RSA PRIVATE KEY-----
  MIIEowIBAAKCAQEAxpxa0IWCUUamGFqIxEhVaMMask0P26cw09eG/eXE4AbfrL2+
  [all the key content]
  1wlNySh1AZ6WoZCHvDnqa/dBlQxzQ9sZCAemOOUEBwKWsG6JIAwE
  -----END RSA PRIVATE KEY-----
  ```

#### `LIGHTSAIL_HOST`
- **Value**: `bemypcp.com` (or `52.207.142.228` if domain doesn't work)
- This is your server's hostname or IP address

#### `LIGHTSAIL_USER`
- **Value**: `ubuntu`
- This is the SSH username for your Lightsail server

## ✅ Step 3: Verify Setup

1. Make sure your secrets are added:
   - ✅ `LIGHTSAIL_SSH_KEY`
   - ✅ `LIGHTSAIL_HOST`
   - ✅ `LIGHTSAIL_USER`

2. The workflow file is already created at `.github/workflows/deploy-to-lightsail.yml`

## 🚀 Step 4: Test the Deployment

### Automatic Deployment
1. Make a small change to your code
2. Commit and push to `main` branch:
   ```bash
   git add .
   git commit -m "Test deployment"
   git push origin main
   ```
3. Go to your GitHub repository → **Actions** tab
4. You should see the "Deploy to AWS Lightsail" workflow running
5. Click on it to see the deployment progress

### Manual Deployment
1. Go to **Actions** tab in GitHub
2. Select **Deploy to AWS Lightsail** workflow
3. Click **Run workflow** → **Run workflow**
4. This will trigger a deployment immediately

## 📝 How It Works

When you push to the `main` branch:

1. ✅ GitHub Actions checks out your code
2. ✅ Sets up SSH connection to your Lightsail server
3. ✅ SSH's into the server and:
   - Navigates to `/home/ubuntu/emr`
   - Pulls latest changes from GitHub
   - Checks environment configuration
   - Rebuilds Docker containers
   - Restarts services
4. ✅ Your website at https://bemypcp.com is updated!

## 🔧 Troubleshooting

### Deployment fails with "Permission denied (publickey)"

- **Problem**: SSH key is incorrect or not added properly
- **Solution**: 
  - Verify `LIGHTSAIL_SSH_KEY` secret includes the full private key
  - Make sure it includes `-----BEGIN` and `-----END` lines
  - Check that the key matches the public key on your server

### Deployment fails with "Host key verification failed"

- **Problem**: SSH host key not in known_hosts
- **Solution**: The workflow automatically adds the host key, but if it persists, check `LIGHTSAIL_HOST` is correct

### Deployment fails with "Directory not found"

- **Problem**: The app directory path on the server is different
- **Solution**: 
  - SSH into your server: `ssh ubuntu@bemypcp.com`
  - Find where your app is: `find ~ -name "docker-compose.prod.yml" -type f`
  - Update the `DEPLOY_DIR` variable in the workflow file if needed (currently set to `/home/ubuntu/emr`)

### Containers don't restart

- **Problem**: Docker Compose path or permissions issue
- **Solution**: 
  - SSH into server and check: `docker compose version`
  - If using older Docker Compose (not plugin), change `docker compose` to `docker-compose` in the workflow

## 🔄 Workflow Features

- ✅ **Automatic**: Deploys on every push to `main` branch
- ✅ **Manual**: Can be triggered manually from GitHub Actions tab
- ✅ **Safe**: Only rebuilds containers, preserves database
- ✅ **Visible**: See deployment progress in GitHub Actions tab

## 📚 Additional Notes

- The workflow preserves your `.env.prod` file (doesn't overwrite it)
- Database data is preserved (stored in Docker volumes)
- If deployment fails, your site continues running with the previous version
- You can view deployment logs in the GitHub Actions tab

## 🆘 Need Help?

If you encounter issues:
1. Check the **Actions** tab in GitHub for detailed error messages
2. SSH into your server manually and test the deployment commands
3. Verify all three secrets are correctly set in GitHub

---

**Quick Reference:**
- Server: `bemypcp.com` (52.207.142.228)
- User: `ubuntu`
- App Directory: `/home/ubuntu/emr`
- Website: https://bemypcp.com

