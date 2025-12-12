# Git Authentication Setup

## Issue
Repository exists but Git can't authenticate. Need to set up credentials.

## Solution: Use Personal Access Token

### Step 1: Create Personal Access Token on GitHub

1. Go to GitHub: https://github.com/settings/tokens
2. Click "Generate new token" → "Generate new token (classic)"
3. Give it a name: "PageMD Push Token"
4. Select scopes:
   - ✅ `repo` (Full control of private repositories)
   - ✅ `workflow` (if you use GitHub Actions)
5. Click "Generate token"
6. **Copy the token immediately** (you won't see it again!)

### Step 2: Push Using Token

When you push, use your token as the password:

```bash
git push origin main
```

When prompted:
- **Username**: Your GitHub username
- **Password**: Paste your Personal Access Token (NOT your GitHub password)

---

## Alternative: Use SSH (More Secure)

### Step 1: Check for SSH Key

```bash
ls -la ~/.ssh/id_rsa.pub
```

If file exists, you have a key. If not, create one:

```bash
ssh-keygen -t ed25519 -C "your_email@example.com"
```

### Step 2: Add SSH Key to GitHub

1. Copy your public key:
   ```bash
   cat ~/.ssh/id_rsa.pub
   ```

2. Go to GitHub: https://github.com/settings/keys
3. Click "New SSH key"
4. Paste your key and save

### Step 3: Update Remote to Use SSH

```bash
git remote set-url origin git@github.com:Lynqcloudpay/PageMD.git
git push origin main
```

---

## Quick Test

Try pushing again after setting up authentication:

```bash
git push origin main
```

If you get authentication prompt, use your Personal Access Token.

---

## Current Status

✅ Repository: https://github.com/Lynqcloudpay/PageMD.git  
✅ Commit ready: `a4a5a54`  
❌ Need authentication to push






















