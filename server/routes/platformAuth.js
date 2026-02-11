const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const pool = require('../db');

const router = express.Router();

/**
 * POST /api/platform-auth/login
 * Platform admin login with username/password
 */
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }

        // Find admin user
        console.log(`[PlatformAuth] Login attempt for: ${email}`);
        const result = await pool.controlPool.query(
            'SELECT * FROM super_admins WHERE email = $1 AND is_active = true',
            [email]
        );

        console.log(`[PlatformAuth] User found: ${result.rows.length > 0}`);

        if (result.rows.length === 0) {
            console.log('[PlatformAuth] User not found or inactive');
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const admin = result.rows[0];

        // Verify password
        console.log(`[PlatformAuth] Verifying password against hash: ${admin.password_hash.substring(0, 10)}...`);
        const isValid = await bcrypt.compare(password, admin.password_hash);
        console.log(`[PlatformAuth] Password valid: ${isValid}`);

        if (!isValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Create session token
        const token = uuidv4();
        const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000); // 8 hours

        await pool.controlPool.query(
            `INSERT INTO platform_admin_sessions (admin_id, token, expires_at, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5)`,
            [admin.id, token, expiresAt, req.ip, req.get('user-agent')]
        );

        // Update last login
        await pool.controlPool.query(
            'UPDATE super_admins SET last_login_at = NOW(), last_login_ip = $1 WHERE id = $2',
            [req.ip, admin.id]
        );

        // Log the login
        await pool.controlPool.query(
            `INSERT INTO platform_audit_logs (super_admin_id, action, details, ip_address)
       VALUES ($1, $2, $3, $4)`,
            [admin.id, 'platform_login', JSON.stringify({ email }), req.ip]
        );

        // Return user info without password
        const { password_hash, mfa_secret, ...adminData } = admin;

        res.json({
            success: true,
            token,
            admin: adminData
        });
    } catch (error) {
        console.error('Platform admin login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

/**
 * POST /api/platform-auth/logout
 * Logout and invalidate session
 */
router.post('/logout', async (req, res) => {
    try {
        const token = req.headers['x-platform-token'];

        if (token) {
            await pool.controlPool.query(
                'DELETE FROM platform_admin_sessions WHERE token = $1',
                [token]
            );
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ error: 'Logout failed' });
    }
});

/**
 * POST /api/platform-auth/forgot-password
 * Send password reset email for platform admin
 */
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: 'Email required' });

        const result = await pool.controlPool.query('SELECT * FROM super_admins WHERE LOWER(email) = LOWER($1)', [email]);
        const user = result.rows[0];

        if (!user) {
            // Return success even if not found to prevent enumeration
            return res.json({ success: true, message: 'If account exists, reset instructions sent.' });
        }

        // Generate token
        const crypto = require('crypto');
        const token = crypto.randomBytes(32).toString('hex');
        const expires = new Date(Date.now() + 3600000); // 1 hour

        await pool.controlPool.query(
            'UPDATE super_admins SET reset_password_token = $1, reset_password_expires = $2 WHERE id = $3',
            [token, expires, user.id]
        );

        // Send Email
        const emailService = require('../services/emailService');
        const resetLink = `${process.env.FRONTEND_URL || 'https://pagemdemr.com'}/reset-password?token=${token}&type=platform_reset`;

        // Use generic user invitation temporarily or create specific template
        await emailService.sendUserInvitation(user.email, user.first_name, resetLink);

        res.json({ success: true, message: 'Reset instructions sent.' });
    } catch (error) {
        console.error('Platform Forgot password error:', error);
        res.status(500).json({ error: 'Request failed' });
    }
});

/**
 * GET /api/platform-auth/verify-reset/:token
 * Verify password reset token for platform admin
 */
router.get('/verify-reset/:token', async (req, res) => {
    try {
        const { token } = req.params;
        const result = await pool.controlPool.query(
            'SELECT email, first_name, last_name, reset_password_expires FROM super_admins WHERE reset_password_token = $1',
            [token]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Invalid or already used reset link' });
        }

        const user = result.rows[0];
        if (new Date() > new Date(user.reset_password_expires)) {
            return res.status(400).json({ error: 'Reset link has expired' });
        }

        res.json({
            valid: true,
            user: {
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name
            }
        });
    } catch (error) {
        console.error('Verify platform reset error:', error);
        res.status(500).json({ error: 'Failed to verify reset token' });
    }
});

/**
 * POST /api/platform-auth/reset-password
 * Reset password with token for platform admin
 */
router.post('/reset-password', async (req, res) => {
    try {
        const { token, password } = req.body;
        if (!token || !password) return res.status(400).json({ error: 'Token and password required' });

        if (password.length < 12) {
            return res.status(400).json({ error: 'Password must be at least 12 characters' });
        }

        const result = await pool.controlPool.query(
            'SELECT * FROM super_admins WHERE reset_password_token = $1 AND reset_password_expires > NOW()',
            [token]
        );
        const user = result.rows[0];

        if (!user) {
            return res.status(400).json({ error: 'Invalid or expired token' });
        }

        const hash = await bcrypt.hash(password, 10);

        await pool.controlPool.query(
            'UPDATE super_admins SET password_hash = $1, reset_password_token = NULL, reset_password_expires = NULL WHERE id = $2',
            [hash, user.id]
        );

        res.json({ success: true, message: 'Password reset successfully' });
    } catch (error) {
        console.error('Platform Reset password error:', error);
        res.status(500).json({ error: 'Reset failed' });
    }
});

/**
 * GET /api/platform-auth/me
 * Get current admin user info
 */
router.get('/me', async (req, res) => {
    try {
        const token = req.headers['x-platform-token'];

        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }

        // Check session
        const session = await pool.controlPool.query(
            `SELECT sa.* FROM platform_admin_sessions pas
       JOIN super_admins sa ON pas.admin_id = sa.id
       WHERE pas.token = $1 AND pas.expires_at > NOW() AND sa.is_active = true`,
            [token]
        );

        if (session.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }

        const admin = session.rows[0];
        const { password_hash, mfa_secret, ...adminData } = admin;

        res.json({ admin: adminData });
    } catch (error) {
        console.error('Get admin error:', error);
        res.status(500).json({ error: 'Failed to get admin info' });
    }
});

/**
 * POST /api/platform-auth/register
 * Register new platform admin (requires existing Super Admin)
 * Now uses invitation-based flow.
 */
router.post('/register', async (req, res) => {
    try {
        // Verify requestor is a super admin
        const tokenToken = req.headers['x-platform-token'];
        if (!tokenToken) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const authCheck = await pool.controlPool.query(
            `SELECT sa.id, sa.role FROM platform_admin_sessions pas
       JOIN super_admins sa ON pas.admin_id = sa.id
       WHERE pas.token = $1 AND pas.expires_at > NOW() AND sa.role = 'super_admin'`,
            [tokenToken]
        );

        if (authCheck.rows.length === 0) {
            return res.status(403).json({ error: 'Super Admin access required' });
        }

        const createdBy = authCheck.rows[0].id;
        const { email, firstName, lastName, role = 'support' } = req.body;

        // Validate input
        if (!email || !firstName || !lastName) {
            return res.status(400).json({ error: 'All fields required' });
        }

        // Check if email already exists
        const existing = await pool.controlPool.query(
            'SELECT id FROM super_admins WHERE email = $1',
            [email]
        );

        if (existing.rows.length > 0) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        // Generate invitation token
        const inviteToken = uuidv4();
        const inviteExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours

        // Create new admin with invite token
        const result = await pool.controlPool.query(
            `INSERT INTO super_admins (email, first_name, last_name, role, created_by, invite_token, invite_expires_at, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, false)
       RETURNING id, email, first_name, last_name, role, created_at`,
            [email, firstName, lastName, role, createdBy, inviteToken, inviteExpiresAt]
        );

        // Send Email
        const emailService = require('../services/emailService');
        const setupLink = `${process.env.FRONTEND_URL || 'https://pagemdemr.com'}/setup-password?token=${inviteToken}&type=platform`;
        await emailService.sendUserInvitation(email, `${firstName} ${lastName}`, setupLink);

        // Log the registration
        await pool.controlPool.query(
            `INSERT INTO platform_audit_logs (super_admin_id, action, details)
       VALUES ($1, $2, $3)`,
            [createdBy, 'admin_user_invited', JSON.stringify({ newUserId: result.rows[0].id, email, role })]
        );

        res.status(201).json({
            success: true,
            admin: result.rows[0]
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

/**
 * GET /api/platform-auth/verify-invite/:token
 * Verify platform admin invitation token
 */
router.get('/verify-invite/:token', async (req, res) => {
    try {
        const { token } = req.params;
        const result = await pool.controlPool.query(
            'SELECT email, first_name, last_name, invite_expires_at FROM super_admins WHERE invite_token = $1',
            [token]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Invalid or already used invitation link' });
        }

        const user = result.rows[0];
        if (new Date() > new Date(user.invite_expires_at)) {
            return res.status(400).json({ error: 'Invitation link has expired' });
        }

        res.json({
            valid: true,
            user: {
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name
            }
        });
    } catch (error) {
        console.error('Verify invite error:', error);
        res.status(500).json({ error: 'Failed to verify invitation' });
    }
});

/**
 * POST /api/platform-auth/redeem-invite
 * Set password and activate platform admin account
 */
router.post('/redeem-invite', async (req, res) => {
    try {
        const { token, password } = req.body;

        if (!token || !password) {
            return res.status(400).json({ error: 'Token and password required' });
        }

        if (password.length < 12) {
            return res.status(400).json({ error: 'Password must be at least 12 characters' });
        }

        // Find user
        const result = await pool.controlPool.query(
            'SELECT id, email FROM super_admins WHERE invite_token = $1',
            [token]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Invalid or expired invitation' });
        }

        const adminId = result.rows[0].id;
        const passwordHash = await bcrypt.hash(password, 10);

        // Update user
        await pool.controlPool.query(
            `UPDATE super_admins 
       SET password_hash = $1, invite_token = NULL, invite_expires_at = NULL, is_active = true, updated_at = NOW() 
       WHERE id = $2`,
            [passwordHash, adminId]
        );

        res.json({ success: true, message: 'Account activated successfully' });
    } catch (error) {
        console.error('Redeem invite error:', error);
        res.status(500).json({ error: 'Activation failed' });
    }
});

/**
 * GET /api/platform-auth/team
 * List all platform admin users (Super Admin only)
 */
router.get('/team', async (req, res) => {
    try {
        const token = req.headers['x-platform-token'];
        if (!token) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        // Verify super admin
        const authCheck = await pool.controlPool.query(
            `SELECT sa.role FROM platform_admin_sessions pas
       JOIN super_admins sa ON pas.admin_id = sa.id
       WHERE pas.token = $1 AND pas.expires_at > NOW() AND sa.role = 'super_admin'`,
            [token]
        );

        if (authCheck.rows.length === 0) {
            return res.status(403).json({ error: 'Super Admin access required' });
        }

        // Get all admins
        const result = await pool.controlPool.query(
            `SELECT id, email, first_name, last_name, role, is_active, invite_token, last_login_at, created_at
       FROM super_admins
       ORDER BY created_at DESC`
        );

        res.json({ team: result.rows });
    } catch (error) {
        console.error('Get team error:', error);
        res.status(500).json({ error: 'Failed to get team' });
    }
});

/**
 * PATCH /api/platform-auth/team/:id
 * Update admin user (Super Admin only)
 */
router.patch('/team/:id', async (req, res) => {
    try {
        const token = req.headers['x-platform-token'];
        if (!token) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const authCheck = await pool.controlPool.query(
            `SELECT sa.id FROM platform_admin_sessions pas
       JOIN super_admins sa ON pas.admin_id = sa.id
       WHERE pas.token = $1 AND pas.expires_at > NOW() AND sa.role = 'super_admin'`,
            [token]
        );

        if (authCheck.rows.length === 0) {
            return res.status(403).json({ error: 'Super Admin access required' });
        }

        const { id } = req.params;
        const { role, is_active } = req.body;

        const updates = [];
        const params = [id];
        let paramCount = 1;

        if (role) {
            paramCount++;
            updates.push(`role = $${paramCount}`);
            params.push(role);
        }

        if (typeof is_active === 'boolean') {
            paramCount++;
            updates.push(`is_active = $${paramCount}`);
            params.push(is_active);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No updates provided' });
        }

        const query = `UPDATE super_admins SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $1 RETURNING *`;
        const result = await pool.controlPool.query(query, params);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Admin user not found' });
        }

        const { password_hash, mfa_secret, ...adminData } = result.rows[0];
        res.json({ admin: adminData });
    } catch (error) {
        console.error('Update admin error:', error);
        res.status(500).json({ error: 'Failed to update admin' });
    }
});

/**
 * POST /api/platform-auth/change-password
 * Change current admin's password
 */
router.post('/change-password', async (req, res) => {
    try {
        const token = req.headers['x-platform-token'];
        if (!token) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Current and new passwords required' });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters' });
        }

        // Get admin
        const session = await pool.controlPool.query(
            `SELECT sa.* FROM platform_admin_sessions pas
       JOIN super_admins sa ON pas.admin_id = sa.id
       WHERE pas.token = $1 AND pas.expires_at > NOW() AND sa.is_active = true`,
            [token]
        );

        if (session.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid session' });
        }

        const admin = session.rows[0];

        // Verify current password
        const isValid = await bcrypt.compare(currentPassword, admin.password_hash);
        if (!isValid) {
            return res.status(401).json({ error: 'Incorrect current password' });
        }

        // Hash new password
        const newHash = await bcrypt.hash(newPassword, 10);

        // Update password
        await pool.controlPool.query(
            'UPDATE super_admins SET password_hash = $1, updated_at = NOW() WHERE id = $2',
            [newHash, admin.id]
        );

        // Log the change
        await pool.controlPool.query(
            `INSERT INTO platform_audit_logs (super_admin_id, action, details)
       VALUES ($1, $2, $3)`,
            [admin.id, 'password_change', '{}']
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Password change error:', error);
        res.status(500).json({ error: 'Failed to change password' });
    }
});

/**
 * DELETE /api/platform-auth/team/:id
 * Delete platform admin user (Super Admin only)
 */
router.delete('/team/:id', async (req, res) => {
    try {
        const token = req.headers['x-platform-token'];
        if (!token) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        // Verify super admin
        const authCheck = await pool.controlPool.query(
            `SELECT sa.id, sa.email FROM platform_admin_sessions pas
       JOIN super_admins sa ON pas.admin_id = sa.id
       WHERE pas.token = $1 AND pas.expires_at > NOW() AND sa.role = 'super_admin'`,
            [token]
        );

        if (authCheck.rows.length === 0) {
            return res.status(403).json({ error: 'Super Admin access required' });
        }

        const callerAdminId = authCheck.rows[0].id;
        const callerEmail = authCheck.rows[0].email;
        const { id } = req.params;

        // Prevent self-deletion
        if (id === callerAdminId) {
            return res.status(400).json({ error: 'Cannot delete your own account' });
        }

        // Get admin to be deleted for logging
        const targetAdmin = await pool.controlPool.query(
            'SELECT email FROM super_admins WHERE id = $1',
            [id]
        );

        if (targetAdmin.rows.length === 0) {
            return res.status(404).json({ error: 'Admin user not found' });
        }

        const targetEmail = targetAdmin.rows[0].email;

        // Delete sessions first
        await pool.controlPool.query(
            'DELETE FROM platform_admin_sessions WHERE admin_id = $1',
            [id]
        );

        // Delete admin
        await pool.controlPool.query(
            'DELETE FROM super_admins WHERE id = $1',
            [id]
        );

        // Log the deletion
        await pool.controlPool.query(
            `INSERT INTO platform_audit_logs (super_admin_id, action, details)
       VALUES ($1, $2, $3)`,
            [callerAdminId, 'delete_team_member', JSON.stringify({ deleted_email: targetEmail, caller_email: callerEmail })]
        );

        res.json({ success: true, message: 'Team member removed successfully' });
    } catch (error) {
        console.error('Delete admin error:', error);
        res.status(500).json({ error: 'Failed to delete team member' });
    }
});

module.exports = router;
