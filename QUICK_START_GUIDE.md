# Quick Start Guide: Changing Password & Adding Users

## 🔐 How to Change Your Password

### Step 1: Login
- Go to the login page
- Enter your admin credentials:
  - **Email:** `admin@clinic.com`
  - **Password:** `Admin@2025!Secure`

### Step 2: Navigate to User Management
1. Look for **"User Management"** in the left sidebar menu
2. Click on it, or go directly to: `http://localhost:5173/users`

### Step 3: Find Your Account
1. You'll see a list of all users
2. Find your account (admin@clinic.com)
3. Click the **Edit** button (pencil icon) next to your name

### Step 4: Change Password
1. In the Edit User modal, scroll down to the **"Password"** section
2. Click **"Change Password"** button
3. Enter your new password in the field that appears
4. Click **"Save Changes"** at the bottom

**Password Requirements:**
- Minimum 8 characters
- At least one uppercase letter (A-Z)
- At least one lowercase letter (a-z)
- At least one number (0-9)
- At least one special character (!@#$%^&*)

---

## 👥 How to Add New Users

### Step 1: Navigate to User Management
1. Login as admin
2. Go to **User Management** page (sidebar menu or `/users`)

### Step 2: Click "Add User"
1. Look for the **"Add User"** button at the top right
2. Click it to open the Create User modal

### Step 3: Fill in User Information

#### Required Fields:
- **First Name:** User's first name
- **Last Name:** User's last name
- **Email:** User's email address (this will be their username)
- **Password:** Initial password (user should change this later)
- **Role:** Select from dropdown:
  - Admin
  - Physician
  - Nurse
  - MA (Medical Assistant)
  - Front Desk
  - Billing
  - NP (Nurse Practitioner)
  - PA (Physician Assistant)
  - Tech

#### Optional Fields (for clinical roles):
If you select a clinical role (Physician, NP, PA, Nurse), you may also fill in:
- **NPI:** National Provider Identifier (10 digits)
- **License Number:** Professional license number
- **License State:** Two-letter state code (e.g., CA, NY)
- **DEA Number:** For prescribing controlled substances
- **Credentials:** MD, DO, NP, PA-C, RN, etc.
- **Taxonomy Code:** Provider taxonomy code

### Step 4: Create the User
1. Review all information
2. Click **"Create User"** button
3. The user will be added to the system

### Step 5: Share Credentials
- Share the email and password securely with the new user
- **Important:** Ask them to change their password after first login

---

## 📍 Visual Guide

### Finding User Management:
```
Sidebar Menu:
├── Schedule
├── My Schedule
├── Patients
├── In Basket
├── Messages
├── Pending Notes
├── Telehealth
├── Analytics
└── User Management ← Click here
```

### User Management Page Layout:
```
┌─────────────────────────────────────┐
│ User Management              [Add User] │
├─────────────────────────────────────┤
│ [Search]  [Status Filter]  [Role]   │
├─────────────────────────────────────┤
│ User List:                          │
│ • Your Name (admin@clinic.com)      │
│   [Edit] [Lock] [Delete]            │
└─────────────────────────────────────┘
```

### Edit User Modal:
```
┌─────────────────────────────┐
│ Edit User                   │
├─────────────────────────────┤
│ First Name: [Your Name]     │
│ Last Name:  [Your Name]     │
│ Email:      [your@email]    │
│ Role:       [Admin ▼]       │
│ Status:     [Active ▼]      │
│                             │
│ Password: [Change Password] │
│           [New Password...] │
│                             │
│     [Cancel]  [Save]        │
└─────────────────────────────┘
```

---

## ⚠️ Important Notes

1. **Security:**
   - Always use strong passwords
   - Change default passwords immediately
   - Never share passwords via email

2. **Roles:**
   - Choose the appropriate role for each user
   - Users with clinical roles need NPI and license info for e-prescribing

3. **Passwords:**
   - Users should change their password after first login
   - Passwords can be reset anytime via User Management

4. **Permissions:**
   - Only Admin users can access User Management
   - Admin can change any user's password
   - Users cannot change their own password yet (feature coming soon)

---

## 🆘 Troubleshooting

**Can't see User Management in sidebar?**
- Make sure you're logged in as Admin
- Check your role in the database

**Can't change password?**
- Verify password meets all requirements
- Make sure you clicked "Change Password" first
- Check browser console for error messages

**Can't create users?**
- Verify all required fields are filled
- Check that email is unique (not already used)
- Ensure role is selected

---

**Need more help?** See `USER_GUIDE.md` for detailed documentation.






















