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
 * Enhanced with reCAPTCHA v3, disposable email detection, and magic link verification
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
            referral_code,
            recaptchaToken
        } = req.body;

        if (!name || !email) {
            return res.status(400).json({ error: 'Name and email are required' });
        }

        // 1. Verify reCAPTCHA v3 (if configured)
        let recaptchaScore = null;
        const recaptchaSecret = process.env.RECAPTCHA_SECRET_KEY;

        if (recaptchaSecret && recaptchaToken) {
            try {
                const recaptchaRes = await fetch('https://www.google.com/recaptcha/api/siteverify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: `secret=${recaptchaSecret}&response=${recaptchaToken}`
                });
                const recaptchaData = await recaptchaRes.json();
                recaptchaScore = recaptchaData.score;

                console.log(`[SALES] reCAPTCHA score for ${email}: ${recaptchaScore}`);

                // Reject likely bots (score < 0.3)
                if (recaptchaData.success && recaptchaScore < 0.3) {
                    console.warn(`[SALES] Bot detected for ${email} (score: ${recaptchaScore})`);
                    return res.status(403).json({
                        error: 'Security verification failed. Please try again.',
                        code: 'BOT_DETECTED'
                    });
                }
            } catch (recaptchaError) {
                console.error('[SALES] reCAPTCHA verification failed:', recaptchaError.message);
                // Continue anyway - don't block if reCAPTCHA service is down
            }
        }

        // 2. Check for disposable email
        const { isDisposableEmail } = require('../utils/disposableEmails');
        const isDisposable = isDisposableEmail(email);

        if (isDisposable) {
            console.warn(`[SALES] Disposable email rejected: ${email}`);
            return res.status(400).json({
                error: 'Please use a valid work email address.',
                code: 'DISPOSABLE_EMAIL'
            });
        }

        // 3. Generate verification code (6 digits)
        const isSandboxRequest = source === 'Sandbox_Demo';
        let verificationToken = null;
        let verificationCode = null;
        let verificationExpires = null;
        const initialStatus = isSandboxRequest ? 'pending_verification' : 'new';

        if (isSandboxRequest) {
            verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
            verificationToken = jwt.sign(
                { email, type: 'demo_verification_code' },
                process.env.JWT_SECRET || 'pagemd-secret',
                { expiresIn: '45m' }
            );
            verificationExpires = new Date(Date.now() + 45 * 60 * 1000);
        }

        // 4. Check for existing lead (Duplicate Detection - Case Insensitive)
        const existingRes = await pool.query(
            'SELECT id, status FROM sales_inquiries WHERE LOWER(email) = LOWER($1) OR (phone = $2 AND phone IS NOT NULL AND phone != \'\') ORDER BY created_at ASC LIMIT 1',
            [email, phone]
        );
        const existingInquiry = existingRes.rows[0];
        let isDuplicate = false;
        let inquiryId;

        if (existingInquiry) {
            isDuplicate = true;
            inquiryId = existingInquiry.id;
            console.log(`[SALES] Duplicate lead found for ${email}. Merging attempt into Inquiry #${inquiryId}`);

            // Update existing lead (Reset status to allow re-verification if it's a sandbox request)
            await pool.query(`
                UPDATE sales_inquiries 
                SET verification_token = $1, 
                    verification_code = $2, 
                    verification_expires_at = $3,
                    status = CASE WHEN $4 = true THEN 'pending_verification' ELSE status END,
                    updated_at = NOW()
                WHERE id = $5
            `, [verificationToken, verificationCode, verificationExpires, isSandboxRequest, inquiryId]);

            // Log the duplicate demo attempt
            await pool.query(`
                INSERT INTO sales_inquiry_logs (inquiry_id, type, content, metadata)
                VALUES ($1, 'demo_attempt', $2, $3)
            `, [
                inquiryId,
                isSandboxRequest ? 'New sandbox demo attempt detected' : 'Duplicate contact submission',
                JSON.stringify({ source, interest, providers })
            ]);

        } else {
            // 5. Insert new lead
            const insertResult = await pool.query(`
                INSERT INTO sales_inquiries (
                    name, email, phone, practice_name, provider_count,
                    message, interest_type, source, status, referral_code,
                    verification_token, verification_code, verification_expires_at, 
                    recaptcha_score, is_disposable_email,
                    created_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())
                RETURNING id, created_at
            `, [
                name, email, phone, practice, providers, message, interest, source,
                initialStatus, referral_code, verificationToken, verificationCode, verificationExpires,
                recaptchaScore, isDisposable
            ]);
            inquiryId = insertResult.rows[0].id;
        }

        // Fetch the UUID for cookie persistence
        const uuidRes = await pool.query('SELECT uuid FROM sales_inquiries WHERE id = $1', [inquiryId]);
        const leadUuid = uuidRes.rows[0]?.uuid;

        // 6. Send verification code email for sandbox requests
        if (isSandboxRequest && verificationCode) {
            const emailService = require('../services/emailService');
            await emailService.sendDemoVerificationCode(email, name, verificationCode);
            console.log(`[SALES] Verification code sent to: ${email}`);
        }

        res.status(existingInquiry ? 200 : 201).json({
            success: true,
            isDuplicate,
            requiresVerification: isSandboxRequest,
            email: email, // Returned for frontend context display
            message: isSandboxRequest
                ? (isDuplicate ? 'Welcome back! We\'ve sent a fresh access code to your inbox.' : 'Check your email for the verification code!')
                : 'Thank you for your interest!',
            inquiryId,
            leadUuid
        });

    } catch (error) {
        console.error('Error submitting sales inquiry:', error);
        res.status(500).json({ error: 'Failed to submit inquiry' });
    }
});

/**
 * POST /api/sales/verify-code
 * Verify 6-digit code and provision sandbox demo
 */
router.post('/verify-code', async (req, res) => {
    const { email, code } = req.body;

    if (!email || !code) {
        return res.status(400).json({ error: 'Email and verification code are required' });
    }

    try {
        // 1. Find and update inquiry
        const inquiryRes = await pool.query(
            `SELECT * FROM sales_inquiries 
             WHERE email = $1 AND verification_code = $2 AND status = 'pending_verification'`,
            [email, code]
        );

        if (inquiryRes.rows.length === 0) {
            return res.status(404).json({
                error: 'Invalid or expired verification code.',
                code: 'INVALID_CODE'
            });
        }

        const inquiry = inquiryRes.rows[0];

        // 2. Check expiry
        if (inquiry.verification_expires_at && new Date(inquiry.verification_expires_at) < new Date()) {
            return res.status(400).json({
                error: 'Verification code has expired. Please request a new demo.',
                code: 'EXPIRED_CODE'
            });
        }

        // 3. Update inquiry status to verified
        await pool.query(
            `UPDATE sales_inquiries 
             SET status = 'verified', email_verified = true, updated_at = NOW(), last_activity_at = NOW()
             WHERE id = $1`,
            [inquiry.id]
        );

        console.log(`[SALES] Inquiry #${inquiry.id} verified via code for ${inquiry.email}`);

        // 4. Provision sandbox
        const crypto = require('crypto');
        const tenantSchemaSQL = require('../config/tenantSchema');
        const { seedSandbox } = require('../scripts/seed-sandbox-core');

        const sandboxId = crypto.randomBytes(8).toString('hex');
        const schemaName = `sandbox_${sandboxId}`;

        const client = await pool.controlPool.connect();
        try {
            console.log(`[SALES] Provisioning sandbox: ${schemaName}`);
            await client.query('BEGIN');

            // Create Schema and Tables
            await client.query(`CREATE SCHEMA ${schemaName}`);
            await client.query(`SET search_path TO ${schemaName}, public`);
            await client.query(tenantSchemaSQL);

            // Create Default Sandbox Provider
            const providerRes = await client.query(`
                INSERT INTO users (email, password_hash, first_name, last_name, role, is_admin, status)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING id
            `, ['demo@pagemd.com', 'sandbox_auto_login_placeholder', 'Doctor', 'Sandbox', 'Clinician', true, 'active']);
            const providerId = providerRes.rows[0].id;
            const sandboxClinicId = '60456326-868d-4e21-942a-fd35190ed4fc';

            // Seed Basic Settings
            await client.query(`
                INSERT INTO practice_settings (practice_name, practice_type, timezone)
                VALUES ('Sandbox Medical Center', 'General Practice', 'America/New_York')
            `);

            await client.query(`
                INSERT INTO clinical_settings (require_dx_on_visit, enable_clinical_alerts)
                VALUES (true, true)
            `);

            // Seed Clinical Data
            await seedSandbox(client, schemaName, providerId, sandboxClinicId);

            await client.query('COMMIT');

            // Issue JWT
            const sandboxToken = jwt.sign({
                userId: providerId,
                email: 'demo@pagemd.com',
                isSandbox: true,
                sandboxId: sandboxId,
                clinicId: sandboxClinicId,
                clinicSlug: 'demo',
                role: 'Clinician'
            }, process.env.JWT_SECRET || 'pagemd-secret', { expiresIn: '1h' });

            console.log(`[SALES] Sandbox ${schemaName} provisioned for ${inquiry.email}`);

            res.json({
                success: true,
                token: sandboxToken,
                sandboxId,
                redirect: '/dashboard',
                message: 'Demo environment ready!'
            });

        } catch (provisionError) {
            await client.query('ROLLBACK');
            throw provisionError;
        } finally {
            client.release();
        }

    } catch (error) {
        console.error('[SALES] Code verification error:', error);
        res.status(500).json({ error: 'Failed to verify code and provision demo' });
    }
});

/**
 * GET /api/sales/verify/:token
 * Verify magic link token and provision sandbox demo
 */
router.get('/verify/:token', async (req, res) => {
    const { token } = req.params;

    if (!token) {
        return res.status(400).json({ error: 'Verification token required' });
    }

    try {
        // 1. Decode and verify JWT
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'pagemd-secret');

        if (decoded.type !== 'demo_verification') {
            return res.status(400).json({ error: 'Invalid token type' });
        }

        // 2. Find and update inquiry
        const inquiryRes = await pool.query(
            `SELECT * FROM sales_inquiries 
             WHERE verification_token = $1 AND status = 'pending_verification'`,
            [token]
        );

        if (inquiryRes.rows.length === 0) {
            return res.status(404).json({
                error: 'Link expired or already used',
                code: 'INVALID_TOKEN'
            });
        }

        const inquiry = inquiryRes.rows[0];

        // 3. Check expiry (backup check, JWT should handle this)
        if (inquiry.verification_expires_at && new Date(inquiry.verification_expires_at) < new Date()) {
            return res.status(400).json({
                error: 'Verification link has expired. Please request a new demo.',
                code: 'EXPIRED_TOKEN'
            });
        }

        // 4. Update inquiry status to verified
        await pool.query(
            `UPDATE sales_inquiries 
             SET status = 'verified', email_verified = true, updated_at = NOW()
             WHERE id = $1`,
            [inquiry.id]
        );

        console.log(`[SALES] Inquiry #${inquiry.id} verified for ${inquiry.email}`);

        // 5. Provision sandbox (import sandboxAuth logic)
        const crypto = require('crypto');
        const tenantSchemaSQL = require('../config/tenantSchema');
        const { seedSandbox } = require('../scripts/seed-sandbox-core');

        const sandboxId = crypto.randomBytes(8).toString('hex');
        const schemaName = `sandbox_${sandboxId}`;

        const client = await pool.controlPool.connect();
        try {
            console.log(`[SALES] Provisioning sandbox: ${schemaName}`);
            await client.query('BEGIN');

            // Create Schema and Tables
            await client.query(`CREATE SCHEMA ${schemaName}`);
            await client.query(`SET search_path TO ${schemaName}, public`);
            await client.query(tenantSchemaSQL);

            // Create Default Sandbox Provider
            const providerRes = await client.query(`
                INSERT INTO users (email, password_hash, first_name, last_name, role, is_admin, status)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING id
            `, ['demo@pagemd.com', 'sandbox_auto_login_placeholder', 'Doctor', 'Sandbox', 'Clinician', true, 'active']);
            const providerId = providerRes.rows[0].id;
            const sandboxClinicId = '60456326-868d-4e21-942a-fd35190ed4fc';

            // Seed Basic Settings
            await client.query(`
                INSERT INTO practice_settings (practice_name, practice_type, timezone)
                VALUES ('Sandbox Medical Center', 'General Practice', 'America/New_York')
            `);

            await client.query(`
                INSERT INTO clinical_settings (require_dx_on_visit, enable_clinical_alerts)
                VALUES (true, true)
            `);

            // Seed Clinical Data
            await seedSandbox(client, schemaName, providerId, sandboxClinicId);

            await client.query('COMMIT');

            // Issue JWT
            const sandboxToken = jwt.sign({
                userId: providerId,
                email: 'demo@pagemd.com',
                isSandbox: true,
                sandboxId: sandboxId,
                clinicId: sandboxClinicId,
                clinicSlug: 'demo',
                role: 'Clinician'
            }, process.env.JWT_SECRET || 'pagemd-secret', { expiresIn: '1h' });

            console.log(`[SALES] Sandbox ${schemaName} provisioned for ${inquiry.email}`);

            res.json({
                success: true,
                token: sandboxToken,
                sandboxId,
                redirect: '/dashboard',
                message: 'Demo environment ready!'
            });

        } catch (provisionError) {
            await client.query('ROLLBACK');
            throw provisionError;
        } finally {
            client.release();
        }

    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(400).json({
                error: 'Verification link has expired. Please request a new demo.',
                code: 'EXPIRED_TOKEN'
            });
        }
        if (error.name === 'JsonWebTokenError') {
            return res.status(400).json({
                error: 'Invalid verification link.',
                code: 'INVALID_TOKEN'
            });
        }
        console.error('[SALES] Verification error:', error);
        res.status(500).json({ error: 'Failed to verify and provision demo' });
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

        // Use DISTINCT ON (LOWER(email)) to group duplicates in the sidebar
        // We wrap it in a subquery to allow sorting the unique leads by latest activity
        let query = `
            SELECT * FROM (
                SELECT DISTINCT ON (LOWER(email)) * 
                FROM sales_inquiries
                WHERE 1=1
        `;
        const params = [];

        if (status) {
            params.push(status);
            query += ` AND status = $${params.length}`;
        }

        query += `
                ORDER BY LOWER(email), created_at DESC
            ) AS unique_leads
            ORDER BY created_at DESC 
            LIMIT $${params.length + 1} OFFSET $${params.length + 2}
        `;
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

        // Fetch all logs for this person's email to provide a unified history thread
        // even if they have historical duplicate inquiry records.
        const result = await pool.query(`
            SELECT l.*, u.username as admin_name 
            FROM sales_inquiry_logs l
            LEFT JOIN sales_team_users u ON l.admin_id = u.id
            WHERE l.inquiry_id IN (
                SELECT id FROM sales_inquiries 
                WHERE LOWER(email) = (
                    SELECT LOWER(email) FROM sales_inquiries WHERE id = $1
                )
            )
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

/**
 * POST /api/sales/track-visit
 * Log a return visit for a lead identified by UUID
 */
router.post('/track-visit', async (req, res) => {
    try {
        const { uuid } = req.body;
        if (!uuid) return res.status(400).json({ error: 'UUID required' });

        const result = await pool.query(
            'SELECT id, name, status FROM sales_inquiries WHERE uuid = $1',
            [uuid]
        );
        const inquiry = result.rows[0];

        if (!inquiry) return res.status(404).json({ error: 'Lead not found' });

        // Update last activity
        await pool.query(
            'UPDATE sales_inquiries SET last_activity_at = NOW(), updated_at = NOW() WHERE id = $1',
            [inquiry.id]
        );

        // Log the return visit
        await pool.query(`
            INSERT INTO sales_inquiry_logs (inquiry_id, type, content)
            VALUES ($1, 'return_visit', 'Lead returned to sandbox via persistent cookie')
        `, [inquiry.id]);

        res.json({ success: true, leadName: inquiry.name });
    } catch (error) {
        console.error('Error tracking visit:', error);
        res.status(500).json({ error: 'Failed to track visit' });
    }
});

/**
 * POST /api/sales/concierge-inquiry
 * Log a direct question from the Concierge UI
 */
router.post('/concierge-inquiry', async (req, res) => {
    try {
        const { uuid, message } = req.body;
        if (!uuid || !message) return res.status(400).json({ error: 'UUID and message required' });

        const result = await pool.query(
            'SELECT id FROM sales_inquiries WHERE uuid = $1',
            [uuid]
        );
        const inquiry = result.rows[0];

        if (!inquiry) return res.status(404).json({ error: 'Lead not found' });

        // Log the user inquiry
        await pool.query(`
            INSERT INTO sales_inquiry_logs (inquiry_id, type, content)
            VALUES ($1, 'user_inquiry', $2)
        `, [inquiry.id, message]);

        // Update last activity
        await pool.query(
            'UPDATE sales_inquiries SET last_activity_at = NOW(), updated_at = NOW() WHERE id = $1',
            [inquiry.id]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Error posting concierge inquiry:', error);
        res.status(500).json({ error: 'Failed to post inquiry' });
    }
});

module.exports = router;

