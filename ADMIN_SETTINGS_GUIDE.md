# Admin Settings & Configuration Guide

## Overview

A comprehensive admin configuration system has been created that allows administrators to have full control over the system settings, practice information, user management, security policies, and more.

## Access

1. **Login** as an admin user
2. Navigate to **"Administration"** in the sidebar menu (top of admin section)
3. Or go directly to: `http://localhost:5173/admin-settings`

## Available Configuration Sections

### 1. **Practice Settings**
Manage your practice information:
- **Practice Information:**
  - Practice Name
  - Practice Type
  - Tax ID
  - NPI (National Provider Identifier)
  - Complete Address (line 1, line 2, city, state, ZIP)
  - Phone, Fax, Email
  - Website URL
  - Logo URL

- **Regional Settings:**
  - Timezone (Eastern, Central, Mountain, Pacific, Arizona)
  - Date Format (MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD)
  - Time Format (12-hour or 24-hour)

### 2. **User Management** (Linked)
- Click "Users" tab to access User Management
- Create, edit, suspend, and delete users
- Assign roles and privileges
- Manage user passwords

### 3. **Security Settings**
Configure system security policies:
- **Password Policy:**
  - Minimum password length
  - Require uppercase letters
  - Require lowercase letters
  - Require numbers
  - Require special characters

- **Session Security:**
  - Session timeout (minutes)
  - Inactivity timeout (minutes)

- **Login Security:**
  - Maximum login attempts
  - Lockout duration (minutes)

- **Two-Factor Authentication:**
  - Require 2FA for all users
  - Require 2FA for admin users

- **Audit & Logging:**
  - Audit log retention period (days)
  - Minimum: 365 days (HIPAA compliant)

### 4. **Clinical Settings**
Manage clinical workflow settings:
- **Visit Requirements:**
  - Require diagnosis on visit
  - Require vitals on visit
  - Default visit duration (minutes)

- **Clinical Alerts:**
  - Enable clinical alerts
  - Enable drug interaction checking
  - Enable allergy alerts

- **Data Retention:**
  - Lab results retention (days)
  - Imaging results retention (days)
  - Document retention (days)
  - HIPAA minimum: 6 years (2190 days)

### 5. **Email Settings**
Configure email/SMTP for notifications:
- **SMTP Configuration:**
  - SMTP Host
  - SMTP Port (default: 587)
  - SMTP Username
  - SMTP Password (secure storage)
  - Use secure connection (TLS/SSL)

- **Email Settings:**
  - From Name
  - From Email
  - Reply-To Email
  - Test Email Address
  - Enable/disable email notifications

### 6. **Feature Flags**
Enable or disable system features:
- **Clinical Features:**
  - E-Prescribing
  - Telehealth Integration
  - Laboratory Orders
  - Imaging Orders

- **Billing Features:**
  - Billing & Claims Management

- **Patient Features:**
  - Patient Portal

- **Reporting:**
  - Analytics & Reporting

- **Communication:**
  - Internal Messaging

Toggle features on/off with a single click.

### 7. **Billing Configuration**
*(Coming Soon)*
- Fee schedule management
- Clearinghouse configuration
- Claim submission settings
- Insurance payer management

## Database Schema

The following tables have been created:

1. **practice_settings** - Practice information and regional settings
2. **system_config** - General system configuration (key-value pairs)
3. **email_settings** - SMTP and email configuration
4. **security_settings** - Security policies and password requirements
5. **billing_config** - Billing and claims configuration
6. **clinical_settings** - Clinical workflow and data retention settings
7. **feature_flags** - Feature enable/disable flags

## API Endpoints

All settings endpoints require admin privileges:

- `GET /api/settings/all` - Get all settings at once
- `GET /api/settings/practice` - Get practice settings
- `PUT /api/settings/practice` - Update practice settings
- `GET /api/settings/security` - Get security settings
- `PUT /api/settings/security` - Update security settings
- `GET /api/settings/clinical` - Get clinical settings
- `PUT /api/settings/clinical` - Update clinical settings
- `GET /api/settings/email` - Get email settings
- `PUT /api/settings/email` - Update email settings
- `GET /api/settings/features` - Get all feature flags
- `PUT /api/settings/features/:key` - Update a feature flag

## Setup Instructions

1. **Run the migration:**
   ```bash
   cd server
   node scripts/migrate-admin-settings.js
   ```

2. **Access Admin Settings:**
   - Login as admin
   - Click "Administration" in sidebar
   - Or navigate to `/admin-settings`

3. **Configure Your Practice:**
   - Start with Practice Settings tab
   - Fill in your practice information
   - Set timezone and date formats
   - Click "Save Settings"

4. **Configure Security:**
   - Review password policies
   - Set session timeouts
   - Configure login security
   - Enable 2FA if needed

5. **Enable Features:**
   - Go to Features tab
   - Toggle features on/off as needed
   - Some features may require additional configuration

## Security Notes

- All settings changes are **audit logged**
- Settings updates require **admin privileges**
- Password fields are **encrypted/hidden** in email settings
- IP whitelisting available in security settings
- Session timeouts enforced for security

## Features

- ✅ **Single Page Interface** - All settings in one place
- ✅ **Tabbed Navigation** - Easy access to different sections
- ✅ **Real-time Validation** - Input validation as you type
- ✅ **Save Status Feedback** - Success/error messages
- ✅ **Audit Logging** - All changes are logged
- ✅ **Default Values** - Sensible defaults for all settings
- ✅ **HIPAA Compliant** - Follows data retention requirements

## Next Steps

1. **Run the migration** if you haven't already
2. **Access Admin Settings** from the sidebar
3. **Configure your practice** information
4. **Set up security** policies
5. **Enable features** you need
6. **Configure email** for notifications

## Troubleshooting

**Can't access Admin Settings?**
- Make sure you're logged in as Admin
- Check your role in the database

**Settings won't save?**
- Check browser console for errors
- Verify backend server is running
- Ensure database migration ran successfully

**Feature flags not showing?**
- Run the migration script to create default features
- Check database for `feature_flags` table

---

**Created:** Production Setup  
**Version:** 1.0  
**Status:** ✅ Ready for Use






















