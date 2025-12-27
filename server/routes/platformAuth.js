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
        const result = await pool.controlPool.query(
            'SELECT * FROM super_admins WHERE email = $1 AND is_active = true',
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const admin = result.rows[0];

        // Verify password
        const isValid = await bcrypt.compare(password, admin.password_hash);
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
 */
router.post('/register', async (req, res) => {
    try {
        // Verify requestor is a super admin
        const token = req.headers['x-platform-token'];
        if (!token) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const authCheck = await pool.controlPool.query(
            `SELECT sa.id, sa.role FROM platform_admin_sessions pas
       JOIN super_admins sa ON pas.admin_id = sa.id
       WHERE pas.token = $1 AND pas.expires_at > NOW() AND sa.role = 'super_admin'`,
            [token]
        );

        if (authCheck.rows.length === 0) {
            return res.status(403).json({ error: 'Super Admin access required' });
        }

        const createdBy = authCheck.rows[0].id;
        const { email, password, firstName, lastName, role = 'support' } = req.body;

        // Validate input
        if (!email || !password || !firstName || !lastName) {
            return res.status(400).json({ error: 'All fields required' });
        }

        if (password.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters' });
        }

        // Check if email already exists
        const existing = await pool.controlPool.query(
            'SELECT id FROM super_admins WHERE email = $1',
            [email]
        );

        if (existing.rows.length > 0) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);

        // Create new admin
        const result = await pool.controlPool.query(
            `INSERT INTO super_admins (email, password_hash, first_name, last_name, role, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, email, first_name, last_name, role, created_at`,
            [email, passwordHash, firstName, lastName, role, createdBy]
        );

        // Log the registration
        await pool.controlPool.query(
            `INSERT INTO platform_audit_logs (super_admin_id, action, details)
       VALUES ($1, $2, $3)`,
            [createdBy, 'admin_user_created', JSON.stringify({ newUserId: result.rows[0].id, email, role })]
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
            `SELECT id, email, first_name, last_name, role, is_active, last_login_at, created_at
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

module.exports = router;
