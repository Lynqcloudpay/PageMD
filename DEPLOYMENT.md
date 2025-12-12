# EMR Production Deployment Guide - AWS Lightsail

**HIPAA-Compliant Deployment with Docker, Caddy, and Encrypted Backups**

---

## 📋 Prerequisites

- AWS account with Lightsail access
- Domain name (or subdomain)
- SSH key pair
- Basic knowledge of Docker and Linux

---

## 🚀 Step 1: Provision AWS Lightsail Instance

### 1.1 Create Instance

1. Log into AWS Console → Lightsail
2. Click **"Create instance"**
3. Choose:
   - **Platform:** Linux/Unix
   - **Blueprint:** Ubuntu 22.04 LTS
   - **Instance plan:** $10/month (2GB RAM, 1 vCPU) minimum
   - **Instance name:** `emr-production`
4. Click **"Create instance"**

### 1.2 Attach Static IP

1. Go to **Networking** → **Static IPs**
2. Click **"Create static IP"**
3. Attach to your instance
4. **Note the IP address** (you'll need it for DNS)

### 1.3 Configure Firewall

1. Go to **Networking** → **Firewall**
2. Add rules:
   - **HTTP (80):** Allow from `0.0.0.0/0`
   - **HTTPS (443):** Allow from `0.0.0.0/0`
   - **SSH (22):** Allow from **YOUR_IP_ADDRESS** only
3. Save rules

### 1.4 Enable Disk Encryption

Lightsail automatically encrypts volumes. Verify:
1. Go to instance → **Storage**
2. Ensure **"Encryption"** shows as enabled

---

## 🌐 Step 2: Configure Domain

### 2.1 DNS Configuration

1. Go to your domain registrar (GoDaddy, Namecheap, etc.)
2. Add/Edit DNS records:
   ```
   Type: A
   Name: @ (or yourdomain.com)
   Value: [Your Lightsail Static IP]
   TTL: 3600
   ```
3. (Optional) Add www subdomain:
   ```
   Type: A
   Name: www
   Value: [Your Lightsail Static IP]
   TTL: 3600
   ```
4. Wait for DNS propagation (5-60 minutes)

### 2.2 Verify DNS

```bash
# Check DNS resolution
dig yourdomain.com
# Should return your Lightsail IP
```

---

## 🔧 Step 3: Initial Server Setup

### 3.1 Connect to Server

```bash
# Download SSH key from Lightsail
# Or use your existing SSH key

ssh -i ~/.ssh/your-key.pem ubuntu@[YOUR_STATIC_IP]
```

### 3.2 Update System

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install -y git curl wget
```

### 3.3 Install Docker

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo apt install -y docker-compose-plugin

# Add user to docker group
sudo usermod -aG docker ubuntu

# Log out and back in for group changes to take effect
exit
```

Reconnect:
```bash
ssh -i ~/.ssh/your-key.pem ubuntu@[YOUR_STATIC_IP]
```

### 3.4 Verify Docker

```bash
docker --version
docker compose version
```

---

## 📦 Step 4: Deploy Application

### 4.1 Clone Repository

```bash
# Create app directory
mkdir -p /home/ubuntu/app
cd /home/ubuntu/app

# Clone your repository
git clone https://github.com/yourusername/paper-emr.git .

# Or upload files via SCP
# scp -r -i ~/.ssh/your-key.pem ./paper-emr ubuntu@[YOUR_IP]:/home/ubuntu/app
```

### 4.2 Configure Environment

```bash
cd /home/ubuntu/app/deploy

# Copy example environment file
cp env.prod.example .env.prod

# Edit environment variables
nano .env.prod
```

**Required changes in `.env.prod`:**
```bash
# Update these values:
DOMAIN=yourdomain.com
LETSENCRYPT_EMAIL=admin@yourdomain.com
APP_BASE_URL=https://yourdomain.com

# Generate strong secrets:
SESSION_SECRET=$(openssl rand -base64 32)
JWT_SECRET=$(openssl rand -base64 32)
BACKUP_ENCRYPTION_KEY=$(openssl rand -base64 32)

# Set database password:
DB_PASSWORD=<strong-password-min-32-chars>

# Ensure these are set:
NODE_ENV=production
ENABLE_PHI_ENCRYPTION=true
FORCE_HTTPS=true
ENABLE_AUDIT_LOGGING=true
```

### 4.3 Update Caddyfile

```bash
# Edit Caddyfile to use your domain
nano /home/ubuntu/app/deploy/Caddyfile
```

The Caddyfile uses `${DOMAIN}` variable from `.env.prod`, so it should work automatically.

### 4.4 Build and Start Services

```bash
cd /home/ubuntu/app/deploy

# Build and start all services
docker compose -f docker-compose.prod.yml up -d --build

# Check status
docker compose -f docker-compose.prod.yml ps

# View logs
docker compose -f docker-compose.prod.yml logs -f
```

### 4.5 Run Database Migrations

```bash
# Wait for database to be ready (30 seconds)
sleep 30

# Run migrations inside API container
docker compose -f docker-compose.prod.yml exec api npm run migrate

# Or if you have a migration script:
docker compose -f docker-compose.prod.yml exec api node scripts/migrate.js
```

---

## ✅ Step 5: Verify Deployment

### 5.1 Check Services

```bash
# Check all containers are running
docker compose -f docker-compose.prod.yml ps

# Should show:
# - emr-db (healthy)
# - emr-api (healthy)
# - emr-web (running)
# - emr-caddy (running)
```

### 5.2 Test HTTPS

```bash
# Test HTTPS redirect
curl -I http://yourdomain.com
# Should redirect to https://

# Test HTTPS
curl -I https://yourdomain.com
# Should return 200 OK
```

### 5.3 Test API

```bash
# Test health endpoint
curl https://yourdomain.com/api/health
# Should return: {"status":"ok"}

# Test from browser
# Visit: https://yourdomain.com
# Should show login page
```

### 5.4 Verify Security

1. **HTTPS Enforcement:**
   - Visit `http://yourdomain.com` → Should redirect to HTTPS

2. **Security Headers:**
   ```bash
   curl -I https://yourdomain.com | grep -i "strict-transport-security"
   # Should show HSTS header
   ```

3. **Login Test:**
   - Visit `https://yourdomain.com`
   - Try logging in
   - Verify session timeout works (15 minutes)

---

## 🔐 Step 6: Configure Backups

### 6.1 Set Up Automated Backups

```bash
# Create backup directory
mkdir -p /home/ubuntu/backups

# Add to crontab
crontab -e

# Add this line (runs daily at 2 AM):
0 2 * * * cd /home/ubuntu/app && docker compose -f deploy/docker-compose.prod.yml exec -T db /bin/bash -c "PGPASSWORD=\$DB_PASSWORD pg_dump -U emr_user -h localhost emr_db" | /home/ubuntu/app/server/scripts/backup_db.sh
```

**Better approach - use the backup script directly:**

```bash
# Create backup script wrapper
nano /home/ubuntu/backup-daily.sh
```

Add:
```bash
#!/bin/bash
cd /home/ubuntu/app
source deploy/.env.prod
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=emr_db
export DB_USER=emr_user
export DB_PASSWORD="$DB_PASSWORD"
export BACKUP_ENCRYPTION_KEY="$BACKUP_ENCRYPTION_KEY"
export BACKUP_DIR=/home/ubuntu/backups

docker compose -f deploy/docker-compose.prod.yml exec -T db pg_dump -U "$DB_USER" -h localhost "$DB_NAME" | \
  /home/ubuntu/app/server/scripts/backup_db.sh
```

```bash
chmod +x /home/ubuntu/backup-daily.sh

# Add to crontab
crontab -e
# Add: 0 2 * * * /home/ubuntu/backup-daily.sh >> /home/ubuntu/backup.log 2>&1
```

### 6.2 Test Backup

```bash
# Run backup manually
/home/ubuntu/backup-daily.sh

# Verify backup created
ls -lh /home/ubuntu/backups/
```

### 6.3 Configure S3 Backup (Optional)

```bash
# Install AWS CLI
sudo apt install -y awscli

# Configure AWS credentials
aws configure

# Set S3 bucket in .env.prod
# AWS_S3_BACKUP_BUCKET=your-emr-backups-bucket
# AWS_S3_BACKUP_REGION=us-east-1
```

---

## 📊 Step 7: Set Up Monitoring

### 7.1 Health Check Endpoint

The API already has `/api/health`. Set up external monitoring:

**Option 1: Healthchecks.io (Free)**
1. Sign up at https://healthchecks.io
2. Create a check
3. Set URL: `https://yourdomain.com/api/health`
4. Set interval: 5 minutes

**Option 2: AWS CloudWatch (Paid)**
1. Create CloudWatch alarm
2. Monitor HTTP endpoint
3. Set up SNS notifications

### 7.2 Log Retention

```bash
# Create log rotation script
nano /home/ubuntu/rotate-logs.sh
```

Add:
```bash
#!/bin/bash
# Archive logs older than 7 days
find /var/lib/docker/volumes -name "*.log" -mtime +7 -exec gzip {} \;

# Upload to S3 (if configured)
# aws s3 sync /var/lib/docker/volumes/your_log_volume/_data s3://your-bucket/logs/
```

```bash
chmod +x /home/ubuntu/rotate-logs.sh

# Add to crontab (weekly)
crontab -e
# Add: 0 3 * * 0 /home/ubuntu/rotate-logs.sh
```

---

## 🔄 Step 8: Maintenance Commands

### 8.1 View Logs

```bash
# All services
docker compose -f deploy/docker-compose.prod.yml logs -f

# Specific service
docker compose -f deploy/docker-compose.prod.yml logs -f api
docker compose -f deploy/docker-compose.prod.yml logs -f caddy
```

### 8.2 Restart Services

```bash
# Restart all
docker compose -f deploy/docker-compose.prod.yml restart

# Restart specific service
docker compose -f deploy/docker-compose.prod.yml restart api
```

### 8.3 Update Application

```bash
cd /home/ubuntu/app

# Pull latest changes
git pull

# Rebuild and restart
cd deploy
docker compose -f docker-compose.prod.yml up -d --build

# Run migrations if needed
docker compose -f docker-compose.prod.yml exec api npm run migrate
```

### 8.4 Backup Database

```bash
# Manual backup
/home/ubuntu/backup-daily.sh

# Or using docker
docker compose -f deploy/docker-compose.prod.yml exec -T db \
  pg_dump -U emr_user emr_db > backup.sql
```

### 8.5 Restore Database

```bash
# Decrypt and restore
cd /home/ubuntu/app
source deploy/.env.prod
export DB_PASSWORD="$DB_PASSWORD"
export BACKUP_ENCRYPTION_KEY="$BACKUP_ENCRYPTION_KEY"

# Restore from encrypted backup
server/scripts/restore_db.sh /home/ubuntu/backups/emr_backup_YYYYMMDD_HHMMSS.sql.enc
```

---

## 🛡️ Step 9: Security Hardening

### 9.1 SSH Security

```bash
# Disable password authentication
sudo nano /etc/ssh/sshd_config
# Set: PasswordAuthentication no
# Set: PermitRootLogin no

sudo systemctl restart sshd
```

### 9.2 Firewall (UFW)

```bash
# Install UFW
sudo apt install -y ufw

# Allow SSH (important - do this first!)
sudo ufw allow 22/tcp

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

### 9.3 Fail2ban (Optional)

```bash
# Install fail2ban
sudo apt install -y fail2ban

# Configure
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

---

## 📝 Step 10: Compliance Documentation

### 10.1 Create Compliance Folder Structure

```bash
cd /home/ubuntu/app
mkdir -p compliance/{BAA,policies,risk_assessment,training}
```

### 10.2 Store BAAs

- Download BAAs from:
  - AWS Lightsail (via AWS Artifact)
  - Domain registrar (if applicable)
- Store in `compliance/BAA/`

### 10.3 Document Policies

Create policy documents in `compliance/policies/`:
- Privacy Policy
- Security Policy
- Access Control Policy
- Password Policy
- Incident Response Plan
- Backup & Recovery Policy

---

## 🚨 Troubleshooting

### Issue: Caddy SSL Certificate Not Working

```bash
# Check Caddy logs
docker compose -f deploy/docker-compose.prod.yml logs caddy

# Verify DNS is pointing to your IP
dig yourdomain.com

# Check firewall allows port 80 (for Let's Encrypt validation)
```

### Issue: Database Connection Failed

```bash
# Check database logs
docker compose -f deploy/docker-compose.prod.yml logs db

# Verify database is running
docker compose -f deploy/docker-compose.prod.yml ps db

# Test connection
docker compose -f deploy/docker-compose.prod.yml exec db psql -U emr_user -d emr_db
```

### Issue: API Not Starting

```bash
# Check API logs
docker compose -f deploy/docker-compose.prod.yml logs api

# Verify environment variables
docker compose -f deploy/docker-compose.prod.yml exec api env | grep -E "NODE_ENV|ENABLE_PHI_ENCRYPTION"

# Check production safety checks passed
docker compose -f deploy/docker-compose.prod.yml logs api | grep "Production safety checks"
```

### Issue: HTTPS Not Enforcing

```bash
# Check FORCE_HTTPS is set
docker compose -f deploy/docker-compose.prod.yml exec api env | grep FORCE_HTTPS

# Check Caddy is handling HTTPS
docker compose -f deploy/docker-compose.prod.yml logs caddy | grep "certificate"
```

---

## ✅ Post-Deployment Checklist

- [ ] HTTPS is working (no HTTP access)
- [ ] Login works
- [ ] RBAC is enforced
- [ ] Audit logs are writing
- [ ] Backups are running
- [ ] Monitoring is configured
- [ ] All BAAs are signed and stored
- [ ] Policies are documented
- [ ] Staff training completed
- [ ] Incident response plan ready

---

## 📞 Support

- **AWS Lightsail Docs:** https://lightsail.aws.amazon.com/ls/docs/
- **Caddy Docs:** https://caddyserver.com/docs/
- **Docker Docs:** https://docs.docker.com/

---

## 💰 Estimated Monthly Costs

- **Lightsail Instance:** $10-20/month
- **Static IP:** Free (first one)
- **Domain:** $10-15/year
- **SSL Certificate:** Free (Let's Encrypt)
- **S3 Backups (optional):** $1-5/month
- **Total:** ~$12-25/month

---

**Last Updated:** January 2025

