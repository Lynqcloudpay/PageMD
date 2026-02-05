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
        console.log('[SALES] Fetching inquiries. Query:', req.query);
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
        console.log(`[SALES] Query successful. Found ${result.rows.length} rows.`);

        res.json({
            inquiries: result.rows,
            total: result.rowCount
        });

    } catch (error) {
        console.error('[SALES] Error fetching inquiries:', error);
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
        const adminId = req.user.id; // From verifyToken

        // Get current status for comparison
        const currentRes = await pool.query('SELECT status FROM sales_inquiries WHERE id = $1', [id]);
        if (currentRes.rows.length === 0) return res.status(404).json({ error: 'Inquiry not found' });
        const oldStatus = currentRes.rows[0].status;

        const result = await pool.query(`
            UPDATE sales_inquiries
            SET status = COALESCE($1, status),
                notes = COALESCE($2, notes),
                updated_at = NOW()
            WHERE id = $3
            RETURNING *
        `, [status, notes, id]);

        const updatedInquiry = result.rows[0];

        // Log status change if it changed
        if (status && status !== oldStatus) {
            await pool.query(`
                INSERT INTO sales_inquiry_logs (inquiry_id, admin_id, type, content, metadata)
                VALUES ($1, $2, 'status_change', $3, $4)
            `, [id, adminId, `Status changed from ${oldStatus} to ${status}`, JSON.stringify({ old: oldStatus, new: status })]);
        }

        // Log manual note update (legacy support)
        if (notes) {
            await pool.query(`
                INSERT INTO sales_inquiry_logs (inquiry_id, admin_id, type, content)
                VALUES ($1, $2, 'note', $3)
            `, [id, adminId, 'Updated legacy notes']);
        }

        res.json(updatedInquiry);

    } catch (error) {
        console.error('Error updating inquiry:', error);
        res.status(500).json({ error: 'Failed to update inquiry' });
    }
});

/**
 * GET /api/sales/inquiries/:id/logs
 * Get activity logs for an inquiry
 */
router.get('/inquiries/:id/logs', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(`
            SELECT l.*, u.username as admin_name 
            FROM sales_inquiry_logs l
            LEFT JOIN sales_team_users u ON l.admin_id = u.id
            WHERE l.inquiry_id = $1
            ORDER BY l.created_at ASC
        `, [id]);
        res.json({ logs: result.rows });
    } catch (error) {
        console.error('Error fetching logs:', error);
        res.status(500).json({ error: 'Failed to fetch logs' });
    }
});

/**
 * POST /api/sales/inquiries/:id/logs
 * Add a manual log entry (note, call, email)
 */
router.post('/inquiries/:id/logs', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { content, type = 'note' } = req.body;
        const adminId = req.user.id;

        const result = await pool.query(`
            INSERT INTO sales_inquiry_logs (inquiry_id, admin_id, type, content)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `, [id, adminId, type, content]);

        res.json({ log: result.rows[0] });
    } catch (error) {
        console.error('Error creating log:', error);
        res.status(500).json({ error: 'Failed to create log' });
    }
});

/**
 * POST /api/sales/inquiries/:id/schedule-demo
 * Schedule a demo and send invites
 */
router.post('/inquiries/:id/schedule-demo', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { date, notes } = req.body; // ISO date string
        const adminId = req.user.id;

        if (!date) return res.status(400).json({ error: 'Date is required' });

        // 1. Update inquiry
        await pool.query(`
            UPDATE sales_inquiries 
            SET demo_scheduled_at = $1, status = 'demo_scheduled', updated_at = NOW()
            WHERE id = $2
        `, [date, id]);

        // 2. Log it
        await pool.query(`
            INSERT INTO sales_inquiry_logs (inquiry_id, admin_id, type, content, metadata)
            VALUES ($1, $2, 'demo_scheduled', $3, $4)
        `, [id, adminId, `Demo scheduled for ${new Date(date).toLocaleString()}`, JSON.stringify({ date, notes })]);

        // 3. Send Email (Mock for now, or use emailService if valid)
        // TODO: Integrate actual email sending here
        console.log(`[SALES] Demo scheduled for ${id} at ${date}`);

        res.json({ success: true, message: 'Demo scheduled successfully' });
    } catch (error) {
        console.error('Error scheduling demo:', error);
        res.status(500).json({ error: 'Failed to schedule demo' });
    }
});

/**
 * POST /api/sales/inquiries/:id/activate-referral
 * Activate a referral credit for a converted inquiry
 */
router.post('/inquiries/:id/activate-referral', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;

        // 1. Get Inquiry
        console.log(`[SALES] Activating referral for inquiry ${id}`);
        const inquiryRes = await pool.query('SELECT * FROM sales_inquiries WHERE id = $1', [id]);
        const inquiry = inquiryRes.rows[0];

        if (!inquiry) {
            console.warn(`[SALES] Inquiry ${id} not found`);
            return res.status(404).json({ error: 'Inquiry not found' });
        }
        if (!inquiry.referral_code) {
            console.warn(`[SALES] Inquiry ${id} has no referral code`);
            return res.status(400).json({ error: 'No referral code on this inquiry' });
        }
        if (inquiry.referral_activated) {
            console.warn(`[SALES] Inquiry ${id} already activated`);
            return res.status(400).json({ error: 'Referral already activated' });
        }

        // 2. Find Referrer Clinic (Global lookup)
        console.log(`[SALES] Finding referrer for code: ${inquiry.referral_code}`);
        const referrerRes = await pool.query('SELECT id, display_name FROM clinics WHERE referral_code = $1', [inquiry.referral_code]);
        if (referrerRes.rows.length === 0) {
            console.error(`[SALES] Referrer not found for code: ${inquiry.referral_code}`);
            return res.status(404).json({ error: `Referrer clinic with code '${inquiry.referral_code}' not found` });
        }
        const referrer = referrerRes.rows[0];

        // 3. Create active referral record
        console.log(`[SALES] Creating referral record for clinic ${referrer.id} (${referrer.display_name})`);
        await pool.query(`
            INSERT INTO clinic_referrals (
                referrer_clinic_id, 
                referred_clinic_name, 
                referral_email, 
                status, 
                created_at
            ) VALUES ($1, $2, $3, 'active', NOW())
        `, [referrer.id, inquiry.practice_name || inquiry.name, inquiry.email]);

        // 4. Mark inquiry as activated
        console.log(`[SALES] Marking inquiry ${id} as activated`);
        await pool.query(`
            UPDATE sales_inquiries 
            SET referral_activated = true, 
                referral_activated_at = NOW(),
                updated_at = NOW()
            WHERE id = $1
        `, [id]);

        console.log(`[SALES] Referral activation successful for inquiry ${id}`);
        res.json({
            success: true,
            message: `Referral activated! ${referrer.display_name} has received credit.`
        });

    } catch (error) {
        console.error('Error activating referral:', error);
        res.status(500).json({ error: 'Failed to activate referral' });
    }
});

/**
 * POST /api/sales/onboard
 * Onboard a new clinic from a sales inquiry (with optional referral activation)
 * This combines clinic creation + referral activation in one atomic flow.
 */
router.post('/onboard', verifyToken, async (req, res) => {
    const { inquiryId, clinic, adminUser } = req.body;

    if (!clinic || !clinic.slug) {
        return res.status(400).json({ error: 'Missing required onboarding data (slug).' });
    }

    try {
        // 1. Get inquiry if provided
        let inquiry = null;
        if (inquiryId) {
            const inquiryRes = await pool.query('SELECT * FROM sales_inquiries WHERE id = $1', [inquiryId]);
            inquiry = inquiryRes.rows[0];
            if (!inquiry) {
                return res.status(404).json({ error: 'Inquiry not found' });
            }
        }

        // 2. Import tenantManager dynamically to avoid circular deps
        const tenantManager = require('../services/tenantManager');

        // 3. Provision the clinic
        console.log(`[SALES] Provisioning clinic: ${clinic.slug}`);
        const clinicData = {
            ...clinic,
            displayName: clinic.displayName || clinic.name
        };

        const clinicId = await tenantManager.provisionClinic(clinicData, {}, adminUser);
        console.log(`[SALES] Clinic ${clinicId} provisioned successfully`);

        // 4. Create trial subscription
        const trialPlan = await pool.query(
            "SELECT id FROM subscription_plans WHERE name = 'Trial' LIMIT 1"
        );

        if (trialPlan.rows.length > 0) {
            await pool.query(`
                INSERT INTO clinic_subscriptions(clinic_id, plan_id, status, trial_end_date, current_period_start, current_period_end)
                VALUES($1, $2, 'trial', NOW() + INTERVAL '30 days', NOW(), NOW() + INTERVAL '30 days')
            `, [clinicId, trialPlan.rows[0].id]);
        }

        // 5. Handle referral activation if inquiry has referral code
        let referralActivated = false;
        if (inquiry && inquiry.referral_code && !inquiry.referral_activated) {
            const referrerRes = await pool.query(
                'SELECT id, display_name FROM clinics WHERE referral_code = $1',
                [inquiry.referral_code]
            );

            if (referrerRes.rows.length > 0) {
                const referrer = referrerRes.rows[0];
                console.log(`[SALES] Activating referral for ${referrer.display_name}`);

                // Create active referral record with referred_clinic_id
                await pool.query(`
                    INSERT INTO clinic_referrals (
                        referrer_clinic_id,
                        referred_clinic_id,
                        referred_clinic_name,
                        referral_email,
                        status,
                        created_at
                    ) VALUES ($1, $2, $3, $4, 'active', NOW())
                `, [referrer.id, clinicId, clinic.displayName || clinic.name, adminUser?.email || inquiry.email]);

                // Mark inquiry as activated
                await pool.query(`
                    UPDATE sales_inquiries
                    SET referral_activated = true,
                        referral_activated_at = NOW(),
                        status = 'converted',
                        updated_at = NOW()
                    WHERE id = $1
                `, [inquiryId]);

                referralActivated = true;
                console.log(`[SALES] Referral activated for inquiry ${inquiryId}`);
            }
        }

        // 6. Update inquiry status to converted if not already
        if (inquiry && inquiry.status !== 'converted') {
            await pool.query(`
                UPDATE sales_inquiries
                SET status = 'converted', updated_at = NOW()
                WHERE id = $1
            `, [inquiryId]);
        }

        res.status(201).json({
            success: true,
            message: `Clinic "${clinic.displayName || clinic.name}" onboarded successfully!${referralActivated ? ' Referral credit activated.' : ''}`,
            clinicId,
            referralActivated
        });

    } catch (error) {
        console.error('[SALES] Onboarding failed:', error);
        res.status(500).json({ error: error.message || 'Failed to onboard clinic.' });
    }
});

module.exports = router;

