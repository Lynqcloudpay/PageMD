# HIPAA-Compliant Online Deployment Guide

**Date:** January 2025  
**Purpose:** Complete guide for deploying your EMR system online while maintaining HIPAA compliance

---

## 📋 Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Infrastructure Requirements](#infrastructure-requirements)
3. [Hosting Options](#hosting-options)
4. [Security Configuration](#security-configuration)
5. [Database Security](#database-security)
6. [Network Security](#network-security)
7. [Business Associate Agreements (BAAs)](#business-associate-agreements)
8. [Legal & Administrative Requirements](#legal--administrative-requirements)
9. [Monitoring & Logging](#monitoring--logging)
10. [Backup & Disaster Recovery](#backup--disaster-recovery)
11. [Post-Deployment Compliance](#post-deployment-compliance)

---

## ✅ Pre-Deployment Checklist

### Code Security (Already Implemented ✅)
- [x] Field-level encryption for PHI
- [x] RBAC enforcement
- [x] PHI-safe logging
- [x] HTTPS enforcement
- [x] Session timeout
- [x] Audit logging
- [x] Input sanitization

### Infrastructure Requirements (To Do)
- [ ] SSL/TLS certificate (HTTPS)
- [ ] HIPAA-compliant hosting provider
- [ ] Encrypted database at rest
- [ ] Encrypted database backups
- [ ] Firewall configuration
- [ ] DDoS protection
- [ ] Intrusion detection
- [ ] Business Associate Agreements (BAAs)

---

## 🏗️ Infrastructure Requirements

### 1. **SSL/TLS Certificate (REQUIRED)**

**Why:** HIPAA requires encryption in transit. All data must be encrypted between client and server.

**Options:**
- **Let's Encrypt** (Free, automated renewal)
- **Cloudflare SSL** (Free with CDN)
- **Commercial SSL** (DigiCert, GlobalSign, etc.)

**Implementation:**
```bash
# Using Let's Encrypt with Certbot
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

**Configuration in your server:**
```javascript
// server/index.js - Already configured for HTTPS enforcement
// Ensure NODE_ENV=production to enable HTTPS redirects
```

### 2. **Database Encryption at Rest**

**Why:** HIPAA requires encryption of PHI at rest.

**Options:**
- **AWS RDS:** Enable encryption at rest (AES-256)
- **Azure SQL:** Transparent Data Encryption (TDE)
- **Google Cloud SQL:** Encryption at rest enabled by default
- **Self-hosted PostgreSQL:** Use encrypted filesystem or pgcrypto

**PostgreSQL Setup:**
```sql
-- Enable pgcrypto extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Your application already handles field-level encryption
-- Database-level encryption adds another layer
```

### 3. **Backup Encryption**

**Status:** ✅ Already implemented in `server/scripts/backup-database.js`

**Ensure:**
- Backups are encrypted (AES-256-GCM)
- Backup storage is encrypted
- Backup access is restricted
- Backup retention policy is followed

---

## 🌐 Hosting Options

### Option 1: **AWS (Recommended for HIPAA)**

**HIPAA Compliance:** ✅ AWS signs BAAs

**Services:**
- **EC2** or **ECS** for application hosting
- **RDS PostgreSQL** with encryption at rest
- **S3** for encrypted file storage
- **CloudFront** for CDN
- **WAF** for web application firewall
- **CloudWatch** for monitoring

**Estimated Cost:** $200-500/month (small practice)

**Setup Steps:**
1. Sign AWS BAA
2. Enable encryption on RDS
3. Configure security groups (firewall)
4. Set up CloudWatch monitoring
5. Configure automated backups

### Option 2: **Azure (HIPAA Compliant)**

**HIPAA Compliance:** ✅ Azure signs BAAs

**Services:**
- **Azure App Service** for hosting
- **Azure Database for PostgreSQL** with TDE
- **Azure Blob Storage** for files
- **Azure Front Door** for CDN
- **Azure Security Center** for monitoring

**Estimated Cost:** $200-500/month

### Option 3: **Google Cloud Platform (HIPAA Compliant)**

**HIPAA Compliance:** ✅ GCP signs BAAs

**Services:**
- **Cloud Run** or **Compute Engine** for hosting
- **Cloud SQL for PostgreSQL** with encryption
- **Cloud Storage** for files
- **Cloud CDN** for content delivery
- **Cloud Monitoring** for logs

**Estimated Cost:** $200-500/month

### Option 4: **Dedicated HIPAA-Compliant Hosting**

**Providers:**
- **Liquid Web HIPAA Hosting**
- **Atlantic.Net HIPAA Cloud**
- **Rackspace Healthcare Cloud**

**Estimated Cost:** $300-800/month

### Option 5: **Self-Hosted (Advanced)**

**Requirements:**
- Dedicated server with encryption
- Firewall configuration
- Regular security updates
- 24/7 monitoring
- Physical security

**Not Recommended** unless you have IT expertise.

---

## 🔒 Security Configuration

### 1. **Environment Variables (CRITICAL)**

Create `.env.production` file:

```bash
# Server Configuration
NODE_ENV=production
PORT=3000
FRONTEND_URL=https://yourdomain.com

# Database (Use connection string with SSL)
DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=require

# Encryption (REQUIRED for production)
ENABLE_PHI_ENCRYPTION=true
ENCRYPTION_KEY_MANAGEMENT=aws-kms  # or gcp-kms, azure-keyvault
AWS_KMS_KEY_ID=arn:aws:kms:region:account:key/key-id
AWS_REGION=us-east-1

# Session Security
SESSION_SECRET=<generate-strong-random-secret>
SESSION_TIMEOUT=900000  # 15 minutes

# HTTPS Enforcement
FORCE_HTTPS=true
HSTS_MAX_AGE=31536000

# Security
BCRYPT_ROUNDS=12
JWT_SECRET=<generate-strong-random-secret>
JWT_EXPIRES_IN=12h

# Logging (No PHI in logs)
LOG_LEVEL=info
ENABLE_AUDIT_LOGGING=true

# Backup
BACKUP_ENCRYPTION_KEY=<generate-strong-random-key>
BACKUP_RETENTION_DAYS=30
```

### 2. **Firewall Configuration**

**Required Ports:**
- **443** (HTTPS) - Open to public
- **80** (HTTP) - Redirect to 443
- **22** (SSH) - Restrict to your IP only
- **5432** (PostgreSQL) - Block from public, allow only from app server

**Example (AWS Security Group):**
```
Inbound Rules:
- Port 443: 0.0.0.0/0 (HTTPS)
- Port 80: 0.0.0.0/0 (HTTP redirect)
- Port 22: YOUR_IP/32 (SSH)

Outbound Rules:
- All traffic: 0.0.0.0/0
```

### 3. **DDoS Protection**

**Options:**
- **Cloudflare** (Free tier available)
- **AWS Shield** (Standard free, Advanced $3,000/month)
- **Azure DDoS Protection** (Standard $2,944/month)

**Cloudflare Setup:**
1. Sign up for Cloudflare
2. Add your domain
3. Update DNS nameservers
4. Enable SSL/TLS (Full mode)
5. Enable DDoS protection
6. Configure WAF rules

### 4. **Web Application Firewall (WAF)**

**Options:**
- **Cloudflare WAF** (Free tier)
- **AWS WAF** ($5/month + usage)
- **Azure Application Gateway WAF**

**Rules to Configure:**
- SQL injection prevention
- XSS protection
- Rate limiting
- IP blocking for suspicious activity

---

## 💾 Database Security

### 1. **Database Connection Security**

**PostgreSQL SSL Configuration:**
```javascript
// server/db.js or connection string
const connectionString = process.env.DATABASE_URL || 
  `postgresql://${user}:${password}@${host}:${port}/${database}?sslmode=require`;
```

### 2. **Database User Permissions**

**Create Limited User:**
```sql
-- Create application user (not superuser)
CREATE USER emr_app WITH PASSWORD 'strong-password';
GRANT CONNECT ON DATABASE emr_db TO emr_app;
GRANT USAGE ON SCHEMA public TO emr_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO emr_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO emr_app;
```

### 3. **Database Encryption at Rest**

**AWS RDS:**
```bash
# Enable encryption when creating RDS instance
aws rds create-db-instance \
  --db-instance-identifier emr-db \
  --storage-encrypted \
  --kms-key-id <your-kms-key-id>
```

**Azure:**
- Enable Transparent Data Encryption (TDE) in Azure Portal

**Google Cloud:**
- Encryption at rest enabled by default

---

## 🔐 Network Security

### 1. **VPN for Administrative Access**

**Why:** Restrict database and server access to authorized personnel only.

**Options:**
- **AWS VPN** (Site-to-Site or Client VPN)
- **OpenVPN** (Self-hosted)
- **Tailscale** (Easy setup)

### 2. **Private Network (VPC)**

**AWS VPC Setup:**
- Create VPC with private subnets
- Database in private subnet (no public IP)
- Application in public subnet with load balancer
- NAT Gateway for outbound connections

### 3. **Intrusion Detection**

**Options:**
- **AWS GuardDuty** ($10/month + usage)
- **Azure Security Center**
- **Fail2ban** (Free, self-hosted)

---

## 📄 Business Associate Agreements (BAAs)

### **What is a BAA?**

A BAA is a legal document required by HIPAA when you share PHI with third-party vendors.

### **Who Needs a BAA?**

✅ **Required:**
- Cloud hosting providers (AWS, Azure, GCP)
- Database hosting (RDS, Cloud SQL)
- Email service providers (if sending PHI)
- Backup storage providers
- CDN providers (if caching PHI)
- Monitoring services (if logging PHI)
- Payment processors (if handling PHI)

❌ **Not Required:**
- Domain registrars
- SSL certificate providers
- DNS providers (unless they log PHI)

### **How to Get BAAs:**

1. **AWS:** Sign BAA in AWS Artifact
2. **Azure:** Sign BAA in Azure Portal → Compliance
3. **GCP:** Sign BAA in GCP Console → Compliance
4. **Cloudflare:** Available for Business/Enterprise plans
5. **Other Providers:** Contact their compliance team

### **BAA Checklist:**

- [ ] Signed BAA with hosting provider
- [ ] Signed BAA with database provider
- [ ] Signed BAA with backup storage provider
- [ ] Signed BAA with email provider (if applicable)
- [ ] Signed BAA with monitoring service (if applicable)
- [ ] Keep BAAs on file (required for audits)

---

## ⚖️ Legal & Administrative Requirements

### 1. **HIPAA Risk Assessment**

**Required:** Annual risk assessment

**What to Assess:**
- Physical security
- Technical safeguards
- Administrative safeguards
- Access controls
- Encryption status
- Backup procedures
- Incident response plan

**Documentation:**
- Risk assessment report
- Remediation plan
- Implementation timeline

### 2. **Policies & Procedures**

**Required Documents:**
- [ ] HIPAA Privacy Policy
- [ ] HIPAA Security Policy
- [ ] Breach Notification Policy
- [ ] Access Control Policy
- [ ] Password Policy
- [ ] Backup & Recovery Policy
- [ ] Incident Response Plan
- [ ] Business Associate Policy

### 3. **Employee Training**

**Required:**
- Annual HIPAA training for all staff
- Security awareness training
- Document training completion

### 4. **Incident Response Plan**

**Steps:**
1. Detect breach
2. Contain breach
3. Assess impact
4. Notify affected individuals (within 60 days)
5. Notify HHS (within 60 days if >500 affected)
6. Document incident
7. Remediate vulnerabilities

---

## 📊 Monitoring & Logging

### 1. **Application Monitoring**

**Options:**
- **AWS CloudWatch** (HIPAA compliant with BAA)
- **Azure Monitor** (HIPAA compliant)
- **Google Cloud Monitoring** (HIPAA compliant)
- **Datadog** (HIPAA compliant with BAA)
- **New Relic** (HIPAA compliant with BAA)

**What to Monitor:**
- Application errors
- Response times
- Database performance
- Failed login attempts
- Unusual access patterns
- Disk space
- Memory usage
- CPU usage

### 2. **Audit Logging**

**Status:** ✅ Already implemented

**What's Logged:**
- User logins/logouts
- PHI access (patient records, visits, documents)
- Data modifications
- Failed access attempts
- Privilege changes
- User creation/deletion

**Log Retention:**
- Minimum 6 years (HIPAA requirement)
- Store logs securely (encrypted)
- Regular log review

### 3. **Security Alerts**

**Configure Alerts For:**
- Multiple failed login attempts
- Unusual access patterns
- Database connection failures
- Encryption errors
- Backup failures
- High error rates
- Unauthorized access attempts

---

## 💾 Backup & Disaster Recovery

### 1. **Backup Strategy**

**Status:** ✅ Already implemented in `server/scripts/backup-database.js`

**Requirements:**
- Daily automated backups
- Encrypted backups
- Off-site backup storage
- Backup verification
- Test restore procedures

### 2. **Disaster Recovery Plan**

**RTO (Recovery Time Objective):** How quickly you need to recover
- **Target:** < 4 hours for critical systems

**RPO (Recovery Point Objective):** How much data loss is acceptable
- **Target:** < 1 hour (last backup)

**Plan Components:**
- Backup procedures
- Restore procedures
- Alternative hosting location
- Communication plan
- Staff responsibilities

### 3. **Backup Storage**

**Options:**
- **AWS S3** with encryption (HIPAA compliant)
- **Azure Blob Storage** with encryption
- **Google Cloud Storage** with encryption
- **Encrypted external drives** (for physical backups)

**Requirements:**
- Encrypted at rest
- Access restricted
- Regular testing
- Multiple copies (3-2-1 rule)

---

## ✅ Post-Deployment Compliance

### 1. **Regular Security Audits**

**Frequency:** Quarterly

**What to Audit:**
- Access logs
- User permissions
- Encryption status
- Backup integrity
- Security patches
- Configuration changes

### 2. **Penetration Testing**

**Frequency:** Annually

**What to Test:**
- Application vulnerabilities
- Network security
- Database security
- Authentication/authorization
- Encryption implementation

### 3. **Compliance Documentation**

**Maintain:**
- Risk assessments
- Security policies
- Incident reports
- Training records
- BAA copies
- Audit logs
- Change logs

### 4. **Ongoing Maintenance**

**Regular Tasks:**
- Security patches (monthly)
- Dependency updates (monthly)
- Log reviews (weekly)
- Backup verification (weekly)
- Access reviews (quarterly)
- Policy updates (as needed)

---

## 🚀 Deployment Steps

### Step 1: **Choose Hosting Provider**
1. Select HIPAA-compliant provider
2. Sign BAA
3. Set up account

### Step 2: **Set Up Infrastructure**
1. Create database (encrypted)
2. Set up application server
3. Configure firewall
4. Set up SSL certificate
5. Configure CDN (optional)

### Step 3: **Configure Environment**
1. Set environment variables
2. Configure encryption keys (KMS)
3. Set up monitoring
4. Configure backups

### Step 4: **Deploy Application**
1. Build production bundle
2. Deploy to server
3. Run database migrations
4. Test encryption
5. Verify HTTPS

### Step 5: **Security Hardening**
1. Configure firewall
2. Set up WAF
3. Enable DDoS protection
4. Configure monitoring alerts
5. Test backup/restore

### Step 6: **Compliance Setup**
1. Sign all BAAs
2. Document policies
3. Set up audit logging
4. Configure access controls
5. Train staff

### Step 7: **Go Live**
1. Final security check
2. Monitor closely for first week
3. Review logs daily
4. Address any issues

---

## 📞 Support & Resources

### HIPAA Resources:
- **HHS HIPAA Guide:** https://www.hhs.gov/hipaa
- **HIPAA Compliance Checklist:** https://www.hipaaguide.net
- **NIST Cybersecurity Framework:** https://www.nist.gov/cyberframework

### Security Resources:
- **OWASP Top 10:** https://owasp.org/www-project-top-ten/
- **CIS Controls:** https://www.cisecurity.org/controls/

### Legal:
- Consult with healthcare attorney
- Review state privacy laws
- Consider cyber liability insurance

---

## ⚠️ Important Notes

1. **This is not legal advice.** Consult with a healthcare attorney and compliance expert.

2. **HIPAA compliance is ongoing.** Regular audits and updates are required.

3. **Document everything.** Keep records of all security measures, policies, and procedures.

4. **Train your staff.** All employees with PHI access must be trained.

5. **Test regularly.** Test backups, disaster recovery, and security measures.

6. **Stay updated.** Security threats evolve; keep your systems patched.

---

## ✅ Final Checklist

Before going live, ensure:

- [ ] All BAAs signed
- [ ] SSL/TLS certificate installed
- [ ] Database encrypted at rest
- [ ] Backups encrypted and tested
- [ ] Firewall configured
- [ ] Monitoring configured
- [ ] Audit logging enabled
- [ ] Policies documented
- [ ] Staff trained
- [ ] Incident response plan ready
- [ ] Risk assessment completed
- [ ] Security patches applied
- [ ] Penetration testing completed (recommended)

---

**Last Updated:** January 2025  
**Next Review:** Quarterly

