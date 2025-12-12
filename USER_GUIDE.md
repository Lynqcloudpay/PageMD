# User Management Guide

This guide explains how to:
1. **Change your password**
2. **Add new users to the system**

---

## 🔐 Changing Your Password

### As Admin (for yourself):
1. Login to the system with your admin credentials
2. Navigate to the **User Management** page:
   - Click on "User Management" in the sidebar navigation
   - Or go directly to: `http://localhost:5173/users`
3. Find your user account in the list (search by your email)
4. Click the **Edit** button (pencil icon) next to your account
5. In the edit modal, you'll see a password field
6. Enter your new password and confirm it
7. Click **Save** to update

### As Admin (for other users):
1. Go to User Management page (`/users`)
2. Find the user you want to update
3. Click **Edit** button
4. Enter new password in the password field
5. Click **Save**

**Note:** Password requirements:
- Minimum 8 characters
- Must contain at least one uppercase letter
- Must contain at least one lowercase letter
- Must contain at least one number
- Must contain at least one special character

---

## 👥 Adding New Users

### Step 1: Access User Management
1. Login as admin
2. Navigate to **User Management**:
   - Click "User Management" in the sidebar
   - Or visit: `http://localhost:5173/users`

### Step 2: Create New User
1. Click the **"Create User"** button (usually at the top right)
2. Fill in the user information:
   - **Email**: User's email address (will be their username)
   - **First Name**: User's first name
   - **Last Name**: User's last name
   - **Password**: Initial password (user should change after first login)
   - **Role**: Select appropriate role:
     - **Admin**: Full system access
     - **Physician**: Clinical access, e-prescribing, note signing
     - **Nurse**: Vitals, intake, messaging
     - **MA**: Basic clinical tasks
     - **Front Desk**: Appointments, demographics
     - **Billing**: Billing and claims
     - **NP/PA**: Advanced practice providers
     - **Tech**: Technical/support staff
   
   For clinical roles (Physician, NP, PA), you may also need:
   - **NPI**: National Provider Identifier
   - **License Number**: Professional license number
   - **License State**: State where licensed
   - **DEA Number**: (if prescribing controlled substances)
   - **Credentials**: (e.g., MD, DO, NP, PA)

3. Click **"Create"** or **"Save"** button

### Step 3: Share Credentials
- Share the email and password securely with the new user
- **Important**: Ask them to change their password after first login

---

## 📋 User Management Features

The User Management page allows you to:

1. **View All Users**
   - See list of all users in the system
   - Filter by status (Active, Suspended, Inactive)
   - Filter by role
   - Search by name or email

2. **Edit Users**
   - Update user information
   - Change password
   - Update role and privileges

3. **Suspend/Activate Users**
   - Temporarily disable user access (Suspend)
   - Re-enable suspended users (Activate)

4. **Delete Users**
   - Remove users from the system (admin only)

5. **Manage Roles & Privileges**
   - Assign roles to users
   - Grant/revoke specific privileges

---

## 🔑 Available Roles

| Role | Description | Key Permissions |
|------|-------------|-----------------|
| **Admin** | System Administrator | Full access, user management, audit logs |
| **Physician** | Medical Doctor | Clinical access, e-prescribing, note signing |
| **Nurse** | Registered Nurse | Vitals entry, intake, messaging |
| **MA** | Medical Assistant | Basic clinical tasks |
| **Front Desk** | Front Office Staff | Appointments, demographics, document uploads |
| **Billing** | Billing Staff | Billing, claims management |
| **NP/PA** | Nurse Practitioner/Physician Assistant | Advanced practice provider access |
| **Tech** | Technical/IT Support | Support and maintenance access |

---

## ⚠️ Security Best Practices

1. **Change Default Passwords**: Always change default passwords immediately
2. **Strong Passwords**: Use complex passwords with:
   - Mixed case letters
   - Numbers
   - Special characters
   - Minimum 8 characters
3. **Least Privilege**: Assign only the minimum permissions needed
4. **Regular Audits**: Review user accounts periodically
5. **Suspend Unused Accounts**: Suspend accounts for users who leave
6. **Secure Sharing**: Never email passwords; share them securely

---

## 🆘 Troubleshooting

### Can't access User Management?
- Make sure you're logged in as an Admin user
- Check that your account has the "user_management" privilege

### Password change not working?
- Verify password meets requirements (8+ chars, uppercase, lowercase, number, special char)
- Make sure you're entering the new password correctly
- Try logging out and back in

### Can't create users?
- Verify you're logged in as Admin
- Check that all required fields are filled
- Ensure email address is unique (not already in use)

---

## 📞 Need Help?

If you encounter issues:
1. Check the browser console for error messages
2. Verify your admin account is active
3. Check that the backend server is running
4. Review audit logs in User Management

---

**Last Updated:** Production Setup
**Version:** 1.0






















