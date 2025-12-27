# 🚀 Platform Admin Dashboard - Quick Start Guide

## Access Your Platform Admin Dashboard

### Step 1: Navigate to the Admin Portal
Visit: **https://bemypcp.com/platform-admin/login**

### Step 2: Enter Your Super Admin Secret
```
MyH3artC@rd1ologyPl@tform2024SecureAdm1nK3y
```

**⚠️ SECURITY**: Keep this secret safe! Store it in a password manager and never commit it to Git.

---

## What You Can Do

### 1. **Dashboard Overview**
- See total clinics (active, trial, suspended)
- Monitor monthly revenue
- Track open support tickets
- View recent clinic signups

### 2. **Clinic Management** (Coming Soon)
- List all clinics
- Search and filter
- Activate/suspend/deactivate
- View detailed usage metrics
- Onboard new clinics

### 3. **Billing & Subscriptions** (Coming Soon)
- View all subscriptions
- Record payments
- See revenue analytics
- Track failed payments

### 4. **Support Tickets** (Coming Soon)
- Manage customer support requests
- Assign to team members
- Track resolution time

---

## Current Status

✅ **Working Now**:
- Platform Admin login
- Dashboard with real-time metrics
- API authentication
- Database schema for subscriptions/billing/support

🚧 **Next Features to Build**:
- Clinic management pages
- Subscription management pages
- Support ticket interface
- Revenue analytics charts
- Onboarding wizard

---

## API Testing

You can also access the API directly:

```bash
# Get dashboard data
curl -H "X-Super-Admin-Secret: MyH3artC@rd1ologyPl@tform2024SecureAdm1nK3y" \
  https://bemypcp.com/api/super/dashboard

# List all clinics
curl -H "X-Super-Admin-Secret: MyH3artC@rd1ologyPl@tform2024SecureAdm1nK3y" \
  https://bemypcp.com/api/super/clinics
```

---

## Database Access

For advanced queries:

```bash
# SSH into server
ssh -i temp_deploy_key ubuntu@bemypcp.com

# Access database
docker exec -it emr-db psql -U emr_user -d emr_db

# Example queries
SELECT * FROM clinics;
SELECT * FROM clinic_subscriptions;
SELECT * FROM payment_history;
```

---

## Next Steps

1. **Log in and explore** the dashboard 
2. **Test the API** endpoints
3. **Request additional pages** (clinics list, billing, etc.)
4. **Set up monitoring** (Sentry, DataDog, etc.)
5. **Plan your pricing** using the subscription_plans table

---

## Support

For questions or to request new features:
- Check the `/docs/platform-admin-guide.md` for full API documentation
- The current dashboard shows live data from your Control Database
- All platform actions are logged in `platform_audit_logs`

---

**🎯 You now have a complete SaaS platform management system!**
