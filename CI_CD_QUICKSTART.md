# 🚀 Quick Start: Automatic Deployment Setup

This guide will help you set up automatic deployment so your code changes are instantly reflected on https://bemypcp.com

## ⚡ One-Time Setup (5 minutes)

### Step 1: Get Your SSH Key

Find your SSH private key. It's usually:
- On your computer: `~/.ssh/id_rsa` or `~/.ssh/your-key.pem`
- Or download from AWS Lightsail console

**Copy the ENTIRE contents** including:
```
-----BEGIN OPENSSH PRIVATE KEY-----
[your key content]
-----END OPENSSH PRIVATE KEY-----
```

### Step 2: Add GitHub Secrets

1. Go to: https://github.com/Lynqcloudpay/PageMD/settings/secrets/actions
2. Click **"New repository secret"** three times:

   **Secret 1: `LIGHTSAIL_SSH_KEY`**
   - Value: Paste your entire SSH private key (from Step 1)

   **Secret 2: `LIGHTSAIL_HOST`**
   - Value: `bemypcp.com`

   **Secret 3: `LIGHTSAIL_USER`**
   - Value: `ubuntu`

### Step 3: Done! 🎉

That's it! Now every time you push to `main` branch, your site will automatically update.

## 🔄 How to Use

### Automatic Deployment (Recommended)

1. Make your code changes
2. Commit and push:
   ```bash
   git add .
   git commit -m "Your change description"
   git push origin main
   ```
3. Go to https://github.com/Lynqcloudpay/PageMD/actions
4. Watch the deployment happen! ✅

### Manual Deployment

1. Go to: https://github.com/Lynqcloudpay/PageMD/actions
2. Click **"Deploy to AWS Lightsail"**
3. Click **"Run workflow"** → **"Run workflow"**

## 📊 What Happens During Deployment

1. ✅ Code is pulled from GitHub
2. ✅ Docker containers are rebuilt
3. ✅ Services are restarted
4. ✅ Your website is updated!

**Total time: ~2-3 minutes**

## 🔍 Check Deployment Status

- GitHub Actions: https://github.com/Lynqcloudpay/PageMD/actions
- Your website: https://bemypcp.com

## ❗ Troubleshooting

**"Permission denied" error?**
- Check that `LIGHTSAIL_SSH_KEY` secret includes the full key with `-----BEGIN` and `-----END` lines

**Deployment fails?**
- Check the Actions tab for detailed error messages
- Make sure all 3 secrets are set correctly

**Need to change deployment directory?**
- The workflow uses `/home/ubuntu/emr` by default
- Edit `.github/workflows/deploy-to-lightsail.yml` if your path is different

## 📚 More Details

- Full setup guide: `GITHUB_ACTIONS_SETUP.md`
- Manual deployment: `deploy-to-lightsail.sh`

---

**Quick Reference:**
- Server: bemypcp.com (52.207.142.228)
- User: ubuntu  
- App Path: /home/ubuntu/emr
- Website: https://bemypcp.com

