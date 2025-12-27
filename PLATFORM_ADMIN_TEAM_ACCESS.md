# 🎯 Platform Admin Team Access - Complete Guide

## ✅ What Changed

You now have a **professional multi-user authentication system** like commercial EMRs use for their IT teams!

### Before vs. After

| Before | After |
|--------|-------|
| Single secret key | Username & password per team member |
| No user management | Full team management |
| No audit trail | Complete action logging |
| No roles | Role-based permissions |

---

## 🚪 How to Access

### 1. Visit the Login Page
**URL**: https://bemypcp.com/platform-admin/login

### 2. Login with Default Account

**Email**: `admin@pagemd.com`  
**Password**: `PageMD2024!Admin`

⚠️ **IMPORTANT**: Change this password immediately after first login!

---

## 👥 User Roles

Your IT team can have different access levels:

### **Super Admin** (Full Access)
- Manage all clinics
- Manage team members
- View all billing/revenue
- Access all support tickets
- System configuration

### **Support Manager**
- Manage support tickets
- View clinic details
- Update clinic status

### **Billing Admin**
- Manage subscriptions
- Process payments
- View revenue reports
- No support ticket access

### **IT Manager**
- Technical system management
- Database monitoring
- Infrastructure access
- View logs

### **Analyst** (Read-Only)
- View all reports
- Analytics access
- No modifications allowed

---

## 🔐 Managing Your Team

### Adding Team Members

1. **Login as Super Admin**
2. **Navigate to Team Management** (coming soon in UI)
3. **Or use the API**:

```bash
curl -X POST https://bemypcp.com/api/platform-auth/register \
  -H "X-Platform-Token: YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@pagemd.com",
    "password": "SecurePassword123!",
    "firstName": "John",
    "lastName": "Doe",
    "role": "support"
  }'
```

### Available Roles
- `super_admin`
- `support`
- `billing`
- `it_manager`
- `analyst`

---

## 📊 Current Features

### ✅ Working Now:
- **Login/Logout** with username & password
- **Dashboard** with real-time metrics
- **Session Management** (8-hour sessions)
- **Token-based Authentication**
- **Audit Logging** of all actions
- **API Access** to all platform data

### 🚧 Coming Soon:
- Team management UI
- User profile editing
- Password reset flow
- Two-factor authentication (MFA)
- Activity logs viewer

---

## 🔧 API Reference

### Authentication

**Login**
```bash
POST /api/platform-auth/login
{
  "email": "admin@pagemd.com",
  "password": "PageMD2024!Admin"
}

Response:
{
  "success": true,
  "token": "uuid-token-here",
  "admin": { "id": "...", "email": "...", "role": "super_admin" }
}
```

**Get Current User**
```bash
GET /api/platform-auth/me
Headers: X-Platform-Token: your-token-here
```

**Logout**
```bash
POST /api/platform-auth/logout
Headers: X-Platform-Token: your-token-here
```

### Team Management

**List All Team Members** (Super Admin only)
```bash
GET /api/platform-auth/team
Headers: X-Platform-Token: your-token-here
```

**Update Team Member** (Super Admin only)
```bash
PATCH /api/platform-auth/team/:id
Headers: X-Platform-Token: your-token-here
{
  "role": "billing",
  "is_active": true
}
```

### All Other APIs

All existing Super Admin APIs (`/api/super/*`) now require:
```
Headers: X-Platform-Token: your-session-token
```

No more secret key needed!

---

## 🔐 Security Features

### ✅ Implemented:
- **Password Hashing** (bcrypt with salt)
- **Session Tokens** (8-hour expiration)
- **Session Validation** on every request
- **Audit Logging** of all platform actions
- **IP Tracking** for logins
- **Inactive user management**

### 🎯 Best Practices:
1. **Change default password immediately**
2. **Use strong passwords** (min 8 characters)
3. **Review audit logs regularly**
4. **Deactivate users when they leave**
5. **Limit Super Admin role** to trusted personnel

---

## 📝 Database Tables

Your team data is stored securely in:

```sql
-- Team members
super_admins (id, email, password_hash, role, is_active...)

-- Active sessions
platform_admin_sessions (admin_id, token, expires_at...)

-- Role definitions
platform_roles (name, description, permissions)

-- Action history
platform_audit_logs (admin_id, action, details, timestamp...)
```

---

## 🚀 Quick Start for New Team Members

1. **Receive welcome email** (from Super Admin)
2. **Visit** https://bemypcp.com/platform-admin/login
3. **Login** with provided credentials
4. **Change password** (recommended)
5. **Access dashboard** based on your role

---

## 🆘 Troubleshooting

### "Invalid or expired session"
- Your session expired (8 hours)
- Re-login to get a new token

### "Authentication required"
- You're not logged in
- Go to login page

### "Access denied"
- You don't have permission for that action
- Contact Super Admin to update your role

### Forgot Password?
- Currently: Contact Super Admin
- Coming Soon: Self-service password reset

---

## 📞 Support

For platform admin issues:
- **Super Admin**: admin@pagemd.com
- **Documentation**: `/docs/platform-admin-guide.md`
- **API Docs**: This file

---

## 🎉 Next Steps

1. **Login now** and explore the dashboard
2. **Change the default password**
3. **Add your team members**
4. **Assign appropriate roles**
5. **Start managing your clinics!**

---

**You now have an enterprise-grade platform management system!** 🚀
