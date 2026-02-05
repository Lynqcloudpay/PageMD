const express = require('express');
const router = express.Router();
const pool = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Secret for Sales JWT (should be in env, falling back for simplicity if not set)
const JWT_SECRET = process.env.SALES_JWT_SECRET || 'pagemd-sales-secret-key-2026';

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1]; // Bearer <token>

    if (!token) {
        return res.status(403).json({ error: 'No token provided' });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).json({ error: 'Unauthorized: Invalid token' });
        }
        req.user = decoded;
        next();
    });
};

/**
 * POST /api/sales/auth/login
 * Login for sales team members
 */
router.post('/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }

        const result = await pool.query('SELECT * FROM sales_team_users WHERE username = $1', [username]);
        const user = result.rows[0];

        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Update last login
        await pool.query('UPDATE sales_team_users SET last_login = NOW() WHERE id = $1', [user.id]);

        // Generate token
        const token = jwt.sign(
            { id: user.id, username: user.username },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

/**
 * POST /api/sales/auth/change-password
 * Change password for logged in user
 */
router.post('/auth/change-password', verifyToken, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.user.id;

        if (!newPassword || newPassword.length < 8) {
            return res.status(400).json({ error: 'New password must be at least 8 characters' });
        }

        // Verify current password
        const result = await pool.query('SELECT * FROM sales_team_users WHERE id = $1', [userId]);
        const user = result.rows[0];

        const validPassword = await bcrypt.compare(currentPassword, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Incorrect current password' });
        }

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(newPassword, salt);

        await pool.query('UPDATE sales_team_users SET password_hash = $1 WHERE id = $2', [hash, userId]);

        res.json({ success: true, message: 'Password updated successfully' });

    } catch (error) {
        console.error('Password change error:', error);
        res.status(500).json({ error: 'Failed to update password' });
    }
});

/**
 * POST /api/sales/auth/create-user
 * Create a new sales team user (Protected)
 */
router.post('/auth/create-user', verifyToken, async (req, res) => {
    try {
        const { username, password, email } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }

        // Check availability
        const check = await pool.query('SELECT * FROM sales_team_users WHERE username = $1', [username]);
        if (check.rows.length > 0) {
            return res.status(400).json({ error: 'Username already taken' });
        }

        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);

        await pool.query(
            'INSERT INTO sales_team_users (username, password_hash, email) VALUES ($1, $2, $3)',
            [username, hash, email]
        );

        res.json({ success: true, message: 'User created successfully' });

    } catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({ error: 'Failed to create user' });
    }
});

/**
 * GET /api/sales/users
 * List all users (Protected)
 */
router.get('/users', verifyToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT id, username, email, created_at, last_login FROM sales_team_users ORDER BY username');
        res.json({ users: result.rows });
    } catch (error) {
        console.error('Fetch users error:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});


/**
 * POST /api/sales/inquiry
 * Submit a sales inquiry (PUBLIC)
 */
router.post('/inquiry', async (req, res) => {
    console.log('[SALES] Inquiry received:', req.body.email);
    try {
        const {
            name,
            email,
            phone,
            practice,
            providers,
            message,
            interest,
            source,
            referral_code
        } = req.body;

        if (!name || !email) {
            return res.status(400).json({ error: 'Name and email are required' });
        }

        const result = await pool.query(`
            INSERT INTO sales_inquiries (
                name, email, phone, practice_name, provider_count,
                message, interest_type, source, status, referral_code, created_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'new', $9, NOW())
            RETURNING id, created_at
        `, [name, email, phone, practice, providers, message, interest, source, referral_code]);

        const inquiry = result.rows[0];

        // console.log(`New sales inquiry #${inquiry.id}: ${name}`);

        res.status(201).json({
            success: true,
            message: 'Thank you for your interest!',
            inquiryId: inquiry.id
        });

    } catch (error) {
        console.error('Error submitting sales inquiry:', error);
        res.status(500).json({ error: 'Failed to submit inquiry' });
    }
});

/**
 * GET /api/sales/inquiries
 * Get all sales inquiries (PROTECTED)
 */
router.get('/inquiries', verifyToken, async (req, res) => {
    try {
        const { status, limit = 50, offset = 0 } = req.query;

        let query = `
            SELECT * FROM sales_inquiries
            WHERE 1=1
        `;
        const params = [];

        if (status) {
            params.push(status);
            query += ` AND status = $${params.length}`;
        }

        query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        const result = await pool.query(query, params);

        res.json({
            inquiries: result.rows,
            total: result.rowCount
        });

    } catch (error) {
        console.error('Error fetching sales inquiries:', error);
        res.status(500).json({ error: 'Failed to fetch inquiries' });
    }
});

/**
 * PATCH /api/sales/inquiries/:id
 * Update inquiry status (PROTECTED)
 */
router.patch('/inquiries/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { status, notes } = req.body;

        const result = await pool.query(`
            UPDATE sales_inquiries
            SET status = COALESCE($1, status),
                notes = COALESCE($2, notes),
                updated_at = NOW()
            WHERE id = $3
            RETURNING *
        `, [status, notes, id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Inquiry not found' });
        }

        res.json(result.rows[0]);

    } catch (error) {
        console.error('Error updating inquiry:', error);
        res.status(500).json({ error: 'Failed to update inquiry' });
    }
});

module.exports = router;
