# ✅ Deployment Setup Checklist

Follow these steps to set up automatic deployment.

## Step 1: Add GitHub Secrets ⚠️ DO THIS FIRST

Go to: **https://github.com/Lynqcloudpay/PageMD/settings/secrets/actions**

Click **"New repository secret"** for each:

### ✅ Secret 1: `LIGHTSAIL_SSH_KEY`
- **Name**: `LIGHTSAIL_SSH_KEY`
- **Value**: Paste your ENTIRE RSA private key (the one starting with `-----BEGIN RSA PRIVATE KEY-----`)
- Must include BEGIN and END lines
- Click **"Add secret"**

### ✅ Secret 2: `LIGHTSAIL_HOST`
- **Name**: `LIGHTSAIL_HOST`
- **Value**: `bemypcp.com`
- Click **"Add secret"**

### ✅ Secret 3: `LIGHTSAIL_USER`
- **Name**: `LIGHTSAIL_USER`
- **Value**: `ubuntu`
- Click **"Add secret"**

---

## Step 2: Commit and Push Changes

```bash
# Make sure you're in the project directory
cd "/Volumes/Mel's SSD/paper emr"

# Add all the new files
git add .github/workflows/deploy-to-lightsail.yml
git add GITHUB_ACTIONS_SETUP.md
git add CI_CD_QUICKSTART.md
git add DEPLOYMENT_CHECKLIST.md
git add test-ssh-connection.sh

# Commit
git commit -m "Add automatic deployment with GitHub Actions"

# Push to GitHub
git push origin main
```

---

## Step 3: Test the Deployment

1. Go to: **https://github.com/Lynqcloudpay/PageMD/actions**
2. You should see **"Deploy to AWS Lightsail"** workflow
3. Click on it to see it running
4. Wait for it to complete (2-3 minutes)

---

## Step 4: Verify It Works

1. Make a small test change to your code
2. Commit and push:
   ```bash
   # Make a small change (e.g., add a comment)
   git add .
   git commit -m "Test deployment"
   git push origin main
   ```
3. Go to Actions tab and watch the deployment
4. Check your website: **https://bemypcp.com**

---

## 🔒 Security Notes

- ✅ Your private key is now stored securely in GitHub Secrets
- ✅ It's encrypted and only accessible during workflow runs
- ✅ Never commit the private key to your repository
- ✅ The `.gitignore` already excludes `.pem` and `.key` files

---

## ❓ Troubleshooting

**If deployment fails:**

1. Check the Actions tab for error messages
2. Verify all 3 secrets are set correctly
3. Make sure the SSH key includes BEGIN and END lines
4. Test SSH connection manually:
   ```bash
   ./test-ssh-connection.sh ~/.ssh/your-key.pem
   ```

**If you need to update the SSH key:**

1. Go to GitHub Secrets
2. Find `LIGHTSAIL_SSH_KEY`
3. Click **"Update"**
4. Paste the new key

---

## 📚 Additional Resources

- Quick Start: `CI_CD_QUICKSTART.md`
- Detailed Guide: `GITHUB_ACTIONS_SETUP.md`
- Manual Deployment: `deploy-to-lightsail.sh`

---

**Current Configuration:**
- Server: bemypcp.com (52.207.142.228)
- User: ubuntu
- App Path: /home/ubuntu/emr
- Website: https://bemypcp.com
- Repository: https://github.com/Lynqcloudpay/PageMD






