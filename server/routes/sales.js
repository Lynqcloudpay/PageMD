const express = require('express');
const router = express.Router();
const pool = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

/**
 * Helper to send referral notification
 */
async function sendReferralNotificationHelper(pool, inquiry) {
    const { referral_token, referral_code, name } = inquiry;
    try {
        // Priority: Token -> Code
        if (referral_token) {
            const tokenRes = await pool.query(
                'SELECT referrer_clinic_id FROM clinic_referrals WHERE token = $1',
                [referral_token]
            );

            if (tokenRes.rows.length > 0) {
                const referrerId = tokenRes.rows[0].referrer_clinic_id;
                const clinicRes = await pool.query(
                    'SELECT c.display_name, u.email FROM clinics c JOIN users u ON u.clinic_id = c.id WHERE c.id = $1 AND u.role = \'Owner\' LIMIT 1',
                    [referrerId]
                );

                if (clinicRes.rows.length > 0) {
                    const row = clinicRes.rows[0];
                    const referrerClinicName = row.display_name || row.name || 'a colleague';
                    const referrerEmail = row.email;

                    const emailService = require('../services/emailService');
                    // Use setTimeout to not block the response
                    setTimeout(() => {
                        emailService.sendReferralNotification(referrerEmail, referrerClinicName, name, 'invite')
                            .catch(e => console.error('[SALES] Failed to send referral notification', e));
                    }, 1000);
                    console.log(`[SALES] Queued referral notification for ${referrerClinicName} (Invite)`);
                    return; // Stop here if token matched
                }
            }
        }

        if (referral_code && referral_code.startsWith('SANDBOXCLINIC-')) {
            const shortId = referral_code.replace('SANDBOXCLINIC-', '').toLowerCase();
            const sandboxRes = await pool.query(`
                SELECT i.email, i.name 
                FROM sales_inquiries i
                JOIN sales_inquiry_logs l ON l.inquiry_id = i.id
                WHERE l.metadata->>'sandbox_id' LIKE $1 || '%'
                ORDER BY l.created_at DESC
                LIMIT 1
            `, [shortId]);

            if (sandboxRes.rows.length > 0) {
                const { email: referrerEmail, name: referrerName } = sandboxRes.rows[0];
                const emailService = require('../services/emailService');
                setTimeout(() => {
                    emailService.sendReferralNotification(referrerEmail, referrerName, name, 'link')
                        .catch(e => console.error('[SALES] Failed to send sandbox referral notification', e));
                }, 1000);
                console.log(`[SALES] Queued referral notification for Sandbox User: ${referrerEmail}`);
                return;
            }
        }

        if (referral_code) {
            const clinicRes = await pool.query(
                'SELECT c.display_name, c.name, u.email FROM clinics c JOIN users u ON u.clinic_id = c.id WHERE c.referral_code = $1 AND u.role = \'Owner\' LIMIT 1',
                [referral_code]
            );

            if (clinicRes.rows.length > 0) {
                const row = clinicRes.rows[0];
                const referrerClinicName = row.display_name || row.name || 'a colleague';
                const referrerEmail = row.email;

                const emailService = require('../services/emailService');
                // Use setTimeout to not block the response
                setTimeout(() => {
                    emailService.sendReferralNotification(referrerEmail, referrerClinicName, name, 'link')
                        .catch(e => console.error('[SALES] Failed to send referral notification', e));
                }, 1000);
                console.log(`[SALES] Queued referral notification for ${referrerClinicName} (Link)`);
            }
        }
    } catch (refError) {
        console.error('[SALES] Error processing referral notification:', refError);
        // Don't block submission
    }
}

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
 * PATCH /api/sales/auth/profile
 * Update user email and meeting link
 */
router.patch('/auth/profile', verifyToken, async (req, res) => {
    try {
        const { email, meetingLink } = req.body;
        const userId = req.user.id;

        await pool.query(`
            UPDATE sales_team_users 
            SET email = $1, meeting_link = $2, updated_at = NOW() 
            WHERE id = $3
        `, [email, meetingLink, userId]);

        res.json({ success: true, message: 'Profile updated successfully' });
    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({ error: 'Failed to update profile' });
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
            referral_token,
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
        const isEmailReferral = !!referral_token; // Leads from specific email invites

        // Resolve Referrer Name for demographics
        let referrerName = null;
        try {
            if (referral_token) {
                const res = await pool.query(`
                    SELECT c.display_name, c.name FROM clinics c 
                    JOIN clinic_referrals cr ON cr.referrer_clinic_id = c.id 
                    WHERE cr.token = $1 LIMIT 1
                `, [referral_token]);
                if (res.rows.length > 0) {
                    referrerName = res.rows[0].display_name || res.rows[0].name;
                }
            } else if (referral_code) {
                if (referral_code.startsWith('SANDBOXCLINIC-')) {
                    const shortId = referral_code.replace('SANDBOXCLINIC-', '').toLowerCase();
                    const res = await pool.query(`
                        SELECT i.name FROM sales_inquiries i
                        JOIN sales_inquiry_logs l ON l.inquiry_id = i.id
                        WHERE l.metadata->>'sandbox_id' LIKE $1 || '%'
                        ORDER BY l.created_at DESC LIMIT 1
                    `, [shortId]);
                    if (res.rows.length > 0) {
                        referrerName = res.rows[0].name + ' (Sandbox)';
                    }
                } else {
                    const res = await pool.query(`
                        SELECT display_name, name FROM clinics WHERE referral_code = $1 LIMIT 1
                    `, [referral_code]);
                    if (res.rows.length > 0) {
                        referrerName = res.rows[0].display_name || res.rows[0].name;
                    }
                }
            }
        } catch (err) {
            console.error('[SALES] Failed to resolve referrer name', err);
        }

        let verificationToken = null;
        let verificationCode = null;
        let verificationExpires = null;

        // Auto-verify if lead came from a specific email invite token
        const initialStatus = (isSandboxRequest && !isEmailReferral) ? 'pending_verification' : (isEmailReferral ? 'verified' : 'new');
        const requiresVerification = isSandboxRequest && !isEmailReferral;

        if (requiresVerification) {
            verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
            verificationToken = jwt.sign(
                { email, type: 'demo_verification_code' },
                process.env.JWT_SECRET || 'pagemd-secret',
                { expiresIn: '45m' }
            );
            verificationExpires = new Date(Date.now() + 45 * 60 * 1000);
        }

        // 4. Check for existing lead (Priority: Token -> Email -> Phone)
        let existingRes;

        if (referral_token) {
            // First try finding by unique referral token
            existingRes = await pool.query(
                'SELECT id, status FROM sales_inquiries WHERE referral_token = $1',
                [referral_token]
            );
        }

        if (!existingRes || existingRes.rows.length === 0) {
            existingRes = await pool.query(
                'SELECT id, status FROM sales_inquiries WHERE LOWER(email) = LOWER($1) OR (phone = $2 AND phone IS NOT NULL AND phone != \'\') ORDER BY created_at ASC LIMIT 1',
                [email, phone]
            );
        }
        const existingInquiry = existingRes.rows[0];
        let isDuplicate = false;
        let inquiryId;

        if (existingInquiry) {
            isDuplicate = true;
            inquiryId = existingInquiry.id;
            console.log(`[SALES] Duplicate lead found for ${email}. Merging attempt into Inquiry #${inquiryId}`);

            // Update existing lead (Reset status to allow re-verification if it's a sandbox request)
            // Update existing lead with new demographics (Upsert logic)
            // We overwrite basic fields to ensure latest contact info is saved
            await pool.query(`
                UPDATE sales_inquiries 
                SET 
                    name = $1,
                    phone = COALESCE($2, phone),
                    practice_name = COALESCE($3, practice_name),
                    provider_count = COALESCE($4, provider_count),
                    message = COALESCE($5, message),
                    interest_type = COALESCE($6, interest_type),
                    verification_token = $7, 
                    verification_code = $8, 
                    verification_expires_at = $9,
                    status = CASE 
                        WHEN $10 = true AND $11 = false THEN 'pending_verification' 
                        WHEN $11 = true THEN 'verified'
                        ELSE status 
                    END,
                    referrer_name = COALESCE($12, referrer_name),
                    updated_at = NOW()
                WHERE id = $13
            `, [
                name, phone, practice, providers, message, interest,
                verificationToken, verificationCode, verificationExpires,
                isSandboxRequest, isEmailReferral, referrerName, inquiryId
            ]);

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
            // 5. Round-Robin Lead Assignment
            let suggestedSellerId = null;
            try {
                const sellerRes = await pool.query(`
                    SELECT id FROM sales_team_users 
                    WHERE is_active = true AND role = 'seller'
                    ORDER BY last_assigned_at ASC NULLS FIRST, id ASC
                    LIMIT 1
                `);
                if (sellerRes.rows.length > 0) {
                    suggestedSellerId = sellerRes.rows[0].id;
                    await pool.query('UPDATE sales_team_users SET last_assigned_at = NOW() WHERE id = $1', [suggestedSellerId]);
                }
            } catch (rrError) {
                console.error('[SALES] Round-robin assignment failed:', rrError);
            }

            // 6. Insert new lead
            const insertResult = await pool.query(`
                INSERT INTO sales_inquiries (
                    name, email, phone, practice_name, provider_count,
                    message, interest_type, source, status, referral_code, referral_token,
                    verification_token, verification_code, verification_expires_at, 
                    recaptcha_score, is_disposable_email, suggested_seller_id,
                    referrer_name,
                    created_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW())
                RETURNING id, created_at
            `, [
                name, email, phone, practice, providers, message, interest, source,
                initialStatus, referral_code, referral_token, verificationToken, verificationCode, verificationExpires,
                recaptchaScore, isDisposable, suggestedSellerId, referrerName
            ]);
            inquiryId = insertResult.rows[0].id;
        }

        // Fetch the UUID for cookie persistence
        const uuidRes = await pool.query('SELECT uuid FROM sales_inquiries WHERE id = $1', [inquiryId]);
        const leadUuid = uuidRes.rows[0]?.uuid;

        // 6. Referral Notification Logic (Notify immediately if verified)
        if (!requiresVerification) {
            await sendReferralNotificationHelper(pool, { name, referral_token, referral_code });
        }

        // 6. Send verification code email for sandbox requests
        if (isSandboxRequest && verificationCode) {
            const emailService = require('../services/emailService');
            await emailService.sendDemoVerificationCode(email, name, verificationCode);
            console.log(`[SALES] Verification code sent to: ${email}`);
        }

        res.status(existingInquiry ? 200 : 201).json({
            success: true,
            isDuplicate,
            requiresVerification,
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

        // 3. Update inquiry status to verified AND re-open if it was finalized
        const wasFinalized = inquiry.is_finalized;
        await pool.query(
            `UPDATE sales_inquiries 
             SET status = 'verified', 
                 email_verified = true, 
                 updated_at = NOW(), 
                 last_activity_at = NOW(),
                 is_finalized = false,
                 finalized_at = NULL
             WHERE id = $1`,
            [inquiry.id]
        );

        // If this was a re-activation of a finalized lead, log it
        if (wasFinalized) {
            await pool.query(`
                INSERT INTO sales_inquiry_logs (inquiry_id, type, content, metadata)
                VALUES ($1, 'reactivation', $2, $3)
            `, [
                inquiry.id,
                '🔄 Lead re-activated! Customer returned and requested a new demo.',
                JSON.stringify({ previous_status: inquiry.status, reactivated_at: new Date().toISOString() })
            ]);
            console.log(`[SALES] Finalized lead #${inquiry.id} re-opened for ${inquiry.email}`);
        }

        console.log(`[SALES] Inquiry #${inquiry.id} verified via code for ${inquiry.email}`);

        // 3b. Activate Referral Credit (if applicable)
        if (inquiry.referral_token) {
            await pool.query(`
                UPDATE public.clinic_referrals 
                SET status = 'active', 
                    signed_up_at = NOW(), 
                    updated_at = NOW()
                WHERE token = $1 AND status = 'pending'
            `, [inquiry.referral_token]);
            console.log(`[SALES] Activated referral for ${inquiry.email} (Token: ${inquiry.referral_token})`);
        } else if (inquiry.referral_code) {
            // Also notify for static link referrals upon verification
            await sendReferralNotificationHelper(pool, {
                name: inquiry.name,
                referral_code: inquiry.referral_code
            });
        }


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

            // 5. Log the sandbox launch with metadata for referral resolution
            await pool.query(
                `INSERT INTO sales_inquiry_logs (inquiry_id, type, content, metadata) 
                 VALUES ($1, 'system', 'User launched Sandbox Demo environment', $2)`,
                [inquiry.id, JSON.stringify({ sandbox_id: sandboxId })]
            );

            // 6. Issue JWT
            const sandboxToken = jwt.sign({
                userId: providerId,
                email: 'demo@pagemd.com',
                isSandbox: true,
                sandboxId: sandboxId,
                leadUuid: inquiry.uuid,
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
                message: 'Demo environment ready!',
                leadUuid: inquiry.uuid,
                leadName: inquiry.name
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

        // 4b. Activate Referral Credit (if applicable)
        if (inquiry.referral_token) {
            await pool.query(`
                UPDATE public.clinic_referrals 
                SET status = 'active', 
                    signed_up_at = NOW(), 
                    updated_at = NOW()
                WHERE token = $1 AND status = 'pending'
            `, [inquiry.referral_token]);
            console.log(`[SALES] Activated referral for ${inquiry.email} (Token: ${inquiry.referral_token})`);
        }


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

            // 5. Log the sandbox launch with metadata for referral resolution
            await pool.query(
                `INSERT INTO sales_inquiry_logs (inquiry_id, type, content, metadata) 
                 VALUES ($1, 'system', 'User launched Sandbox Demo environment', $2)`,
                [inquiry.id, JSON.stringify({ sandbox_id: sandboxId })]
            );

            // 6. Issue JWT
            const sandboxToken = jwt.sign({
                userId: providerId,
                email: 'demo@pagemd.com',
                isSandbox: true,
                sandboxId: sandboxId,
                leadUuid: inquiry.uuid,
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
                message: 'Demo environment ready!',
                leadUuid: inquiry.uuid,
                leadName: inquiry.name
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
                SELECT DISTINCT ON (LOWER(i.email)) i.*, u.username as owner_username
                FROM sales_inquiries i
                LEFT JOIN sales_team_users u ON i.claimed_by = u.id
                WHERE 1=1
        `;
        const params = [];

        if (status) {
            params.push(status);
            query += ` AND i.status = $${params.length}`;
        }

        query += `
                ORDER BY LOWER(i.email), i.created_at DESC
            ) AS unique_leads
            LEFT JOIN LATERAL (
                SELECT COUNT(*) as unread_count
                FROM sales_inquiry_logs
                WHERE inquiry_id IN (
                    SELECT id FROM sales_inquiries WHERE LOWER(email) = LOWER(unique_leads.email)
                )
                AND created_at > COALESCE(unique_leads.last_viewed_at, '-infinity'::timestamp)
                AND type != 'status_change'
            ) AS activity ON true
            ORDER BY last_activity_at DESC 
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
 * POST /api/sales/inquiries/:id/dismiss
 * Dismiss a lead to salvage with required reason and notes
 */
router.post('/inquiries/:id/dismiss', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { reason, notes } = req.body;
        const adminId = req.user.id;

        // Validate required fields
        const validReasons = ['spam', 'not_interested', 'bad_timing', 'budget', 'competitor', 'wrong_contact', 'other'];
        if (!reason || !validReasons.includes(reason)) {
            return res.status(400).json({ error: 'Valid dismissal reason is required' });
        }
        if (!notes || notes.trim().length < 1) {
            return res.status(400).json({ error: 'Dismissal notes are required' });
        }

        // Get current inquiry status for logging
        const currentRes = await pool.query('SELECT name, email, status, email_verified FROM sales_inquiries WHERE id = $1', [id]);
        if (currentRes.rows.length === 0) {
            return res.status(404).json({ error: 'Inquiry not found' });
        }
        const inquiry = currentRes.rows[0];
        const wasVerified = inquiry.email_verified || inquiry.status === 'verified';

        // Update inquiry with dismissal info
        const result = await pool.query(`
            UPDATE sales_inquiries
            SET status = 'dismissed',
                dismissal_reason = $1,
                dismissal_notes = $2,
                dismissed_at = NOW(),
                dismissed_by = $3,
                updated_at = NOW(),
                is_claimed = false,
                claimed_by = NULL
            WHERE id = $4
            RETURNING *
        `, [reason, notes.trim(), adminId, id]);

        // AUTO-ACTION: Cancel all associated demos
        await pool.query(`
            UPDATE sales_demos 
            SET status = 'cancelled', 
                updated_at = NOW()
            WHERE inquiry_id = $1 AND status NOT IN ('completed', 'cancelled', 'declined')
        `, [id]);

        // Log the dismissal
        const reasonLabels = {
            spam: 'Spam/Fake',
            not_interested: 'Not Interested',
            bad_timing: 'Bad Timing',
            budget: 'Budget',
            competitor: 'Competitor',
            wrong_contact: 'Wrong Contact',
            other: 'Other'
        };

        await pool.query(`
            INSERT INTO sales_inquiry_logs (inquiry_id, admin_id, type, content, metadata)
            VALUES ($1, $2, 'dismissal', $3, $4)
        `, [
            id,
            adminId,
            `🚫 Lead dismissed: ${reasonLabels[reason]} - "${notes.trim()}"`,
            JSON.stringify({
                reason,
                notes: notes.trim(),
                was_verified: wasVerified,
                previous_status: inquiry.status
            })
        ]);

        console.log(`[SALES] Lead #${id} dismissed by user ${adminId}. Reason: ${reason}`);
        res.json({ success: true, inquiry: result.rows[0] });

    } catch (error) {
        console.error('Error dismissing lead:', error);
        res.status(500).json({ error: 'Failed to dismiss lead' });
    }
});

/**
 * POST /api/sales/inquiries/:id/reclaim
 * Reclaim a dismissed lead back to the lead pool
 */
router.post('/inquiries/:id/reclaim', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;

        // CRITICAL DEBUG: Log the raw request body
        console.log('[SALES][RECLAIM] ========== RECLAIM REQUEST RECEIVED ==========');
        console.log('[SALES][RECLAIM] Raw req.body:', JSON.stringify(req.body, null, 2));
        console.log('[SALES][RECLAIM] req.body.target:', req.body.target, '| Type:', typeof req.body.target);
        console.log('[SALES][RECLAIM] req.body.sellerId:', req.body.sellerId, '| Type:', typeof req.body.sellerId);
        console.log('[SALES][RECLAIM] req.body.notes:', req.body.notes?.substring(0, 50));

        const { notes, target = 'pool', sellerId } = req.body;
        const adminId = req.user.id;

        console.log('[SALES][RECLAIM] After destructuring - target:', target, '| sellerId:', sellerId);

        if (!notes || notes.trim().length < 1) {
            return res.status(400).json({ error: 'Reclaim notes are required' });
        }

        // Get current inquiry
        const currentRes = await pool.query(
            'SELECT name, email, status, dismissal_reason, email_verified, claimed_by, dismissed_by FROM sales_inquiries WHERE id = $1',
            [id]
        );
        if (currentRes.rows.length === 0) {
            return res.status(404).json({ error: 'Inquiry not found' });
        }
        const inquiry = currentRes.rows[0];

        // Determine new status based on verification
        const newStatus = inquiry.email_verified ? 'verified' : 'new';

        // Determine assignment logic
        let finalSellerId = null;
        let isClaimed = false;

        if (target === 'assign') {
            if (!sellerId) {
                return res.status(400).json({ error: 'Seller ID is required for assignment' });
            }
            finalSellerId = sellerId;
            isClaimed = true;
        } else if (target === 'original') {
            // Priority 1: Current claimed_by (if not null)
            if (inquiry.claimed_by) {
                finalSellerId = inquiry.claimed_by;
                isClaimed = true;
            } else {
                // Priority 2: Last seller from demos
                const lastDemoRes = await pool.query(`
                    SELECT seller_id FROM sales_demos 
                    WHERE inquiry_id = $1 
                    ORDER BY scheduled_at DESC LIMIT 1
                `, [id]);

                if (lastDemoRes.rows.length > 0) {
                    finalSellerId = lastDemoRes.rows[0].seller_id;
                    isClaimed = true;
                } else if (inquiry.dismissed_by) {
                    // Priority 3: Person who dismissed it
                    finalSellerId = inquiry.dismissed_by;
                    isClaimed = true;
                }
            }

            if (!isClaimed) {
                return res.status(400).json({
                    error: 'Previous owner could not be determined. Please assign to a specific seller manually.',
                    debug: { claimed_by: inquiry.claimed_by, dismissed_by: inquiry.dismissed_by }
                });
            }
        } else {
            // Pool target (implicit, but explicit for clarity)
            finalSellerId = null;
            isClaimed = false;
        }

        console.log('[SALES] Reclaim Lead:', {
            id,
            target,
            requestSellerId: sellerId,
            resolvedSellerId: finalSellerId,
            isClaimed
        });

        // Clear dismissal and move back
        const result = await pool.query(`
            UPDATE sales_inquiries
            SET status = $1,
                claimed_by = $2,
                is_claimed = $3,
                dismissal_reason = NULL,
                dismissal_notes = NULL,
                dismissed_at = NULL,
                dismissed_by = NULL,
                updated_at = NOW(),
                last_activity_at = NOW()
            WHERE id = $4
            RETURNING *
        `, [newStatus, finalSellerId, isClaimed, id]);

        // Log the reclaim
        await pool.query(`
            INSERT INTO sales_inquiry_logs (inquiry_id, admin_id, type, content, metadata)
            VALUES ($1, $2, 'reclaim', $3, $4)
        `, [
            id,
            adminId,
            `♻️ Lead reclaimed from salvage${notes ? `: "${notes}"` : ''}`,
            JSON.stringify({
                previous_dismissal_reason: inquiry.dismissal_reason,
                new_status: newStatus,
                notes
            })
        ]);

        console.log(`[SALES] Lead #${id} reclaimed by user ${adminId}`);
        res.json({ success: true, inquiry: result.rows[0] });

    } catch (error) {
        console.error('Error reclaiming lead:', error);
        res.status(500).json({ error: 'Failed to reclaim lead' });
    }
});

/**
 * POST /api/sales/inquiries/:id/schedule-demo
 * Schedule a demo and send invites (PROTECTED)
 */
router.post('/inquiries/:id/schedule-demo', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { date, notes } = req.body; // ISO date string
        const adminId = req.user.id;

        if (!date) return res.status(400).json({ error: 'Date is required' });

        // 1. Fetch inquiry and seller info
        const inquiryRes = await pool.query('SELECT name, email, practice_name, message FROM sales_inquiries WHERE id = $1', [id]);
        if (inquiryRes.rows.length === 0) return res.status(404).json({ error: 'Inquiry not found' });
        const lead = inquiryRes.rows[0];

        const sellerRes = await pool.query('SELECT username, email, zoom_link, meeting_link FROM sales_team_users WHERE id = $1', [adminId]);
        const seller = sellerRes.rows[0];

        // 2. Determine Meeting Link (Jitsi prioritised)
        // If seller has a personal meeting_link (Jitsi/etc) use it, otherwise use legacy zoom_link, 
        // otherwise generate a dynamic Jitsi link.
        let finalMeetingLink = seller.meeting_link || seller.zoom_link;

        // Enhance with Lead Info for Jitsi links
        const cleanMsg = (lead.message || '').replace(/\r?\n|\r/g, " ").trim();
        const subject = `Lead: ${lead.name} ${lead.practice_name ? `(${lead.practice_name})` : ''} | Msg: ${cleanMsg}`.trim();
        const truncatedSubject = subject.length > 200 ? subject.substring(0, 197) + '...' : subject;
        const jitsiConfig = `#config.subject=${encodeURIComponent(truncatedSubject)}&config.defaultLocalDisplayName=${encodeURIComponent(seller.username)}`;

        if (!finalMeetingLink) {
            // Generate frictionless dynamic Jitsi room
            const roomName = `PageMD-Demo-${id}-${Math.random().toString(36).substring(7)}`;
            finalMeetingLink = `https://meet.jit.si/${roomName}${jitsiConfig}`;
        } else if (finalMeetingLink.includes('meet.jit.si')) {
            // Append config to existing Jitsi link
            finalMeetingLink += (finalMeetingLink.includes('#') ? '&' : '#') + jitsiConfig.substring(1);
        }

        // 2. Create entry in sales_demos
        const demoResult = await pool.query(`
            INSERT INTO sales_demos (inquiry_id, seller_id, scheduled_at, notes, meeting_link, status)
            VALUES ($1, $2, $3, $4, $5, 'pending')
            RETURNING id
        `, [id, adminId, date, notes, finalMeetingLink]);
        const demoId = demoResult.rows[0].id;

        // 3. Update inquiry status
        await pool.query(`
            UPDATE sales_inquiries 
            SET demo_scheduled_at = $1, status = 'demo_scheduled', updated_at = NOW()
            WHERE id = $2
        `, [date, id]);

        // 4. Log it
        await pool.query(`
            INSERT INTO sales_inquiry_logs (inquiry_id, admin_id, type, content, metadata)
            VALUES ($1, $2, 'demo_scheduled', $3, $4)
        `, [id, adminId, `Demo scheduled for ${new Date(date).toLocaleString()}`, JSON.stringify({ date, notes, demoId })]);

        // 5. Send Invitation Email
        const baseUrl = process.env.FRONTEND_URL || 'https://pagemdemr.com';
        const confirmUrl = `${baseUrl}/demo-confirm?id=${demoId}&action=accept`;
        const denyUrl = `${baseUrl}/demo-confirm?id=${demoId}&action=deny`;

        const emailService = require('../services/emailService');
        await emailService.sendDemoInvitation(
            lead.email,
            lead.name,
            seller.username,
            new Date(date).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' }),
            finalMeetingLink,
            confirmUrl,
            denyUrl
        );

        console.log(`[SALES] Demo scheduled and email sent for Inquiry #${id}`);

        res.json({ success: true, message: 'Demo scheduled and invitation sent successfully' });
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
 * POST /api/sales/demo-confirm
 * Public endpoint for clients to accept or deny a demo
 */
router.post('/demo-confirm', async (req, res) => {
    try {
        const { id, action, notes } = req.body;

        if (!id || !action) {
            return res.status(400).json({ error: 'Missing demo ID or action' });
        }

        // 1. Check current status
        const currentRes = await pool.query('SELECT status, inquiry_id, scheduled_at FROM sales_demos WHERE id = $1', [id]);

        if (currentRes.rows.length === 0) {
            return res.status(404).json({ error: 'Demo appointment not found' });
        }

        const { status: currentStatus, inquiry_id, scheduled_at } = currentRes.rows[0];

        // Prevent re-activation of cancelled/declined demos
        if (['declined', 'cancelled'].includes(currentStatus)) {
            return res.status(400).json({
                error: 'This appointment was cancelled. To reschedule, please submit a new inquiry or contact support.',
                code: 'APPOINTMENT_CANCELLED',
                currentStatus
            });
        }

        // Use 'declined' for consistency with internal API
        const status = action === 'accept' ? 'confirmed' : 'declined';

        // 2. Update sales_demos table
        await pool.query(`
            UPDATE sales_demos 
            SET status = $1, response_notes = $2, responded_at = NOW()
            WHERE id = $3
        `, [status, notes, id]);

        // 3. Log the response
        await pool.query(`
            INSERT INTO sales_inquiry_logs (inquiry_id, type, content)
            VALUES ($1, 'demo_response', $2)
        `, [inquiry_id, `Client ${status} the demo scheduled for ${new Date(scheduled_at).toLocaleString()}`]);

        res.json({ success: true, message: `Demo ${status} successfully` });
    } catch (error) {
        console.error('Error confirming demo:', error);
        res.status(500).json({ error: 'Failed to process confirmation' });
    }
});

/**
 * GET /api/sales/demo-details/:id
 * Public endpoint to get demo info for the confirmation page
 */
router.get('/demo-details/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(`
            SELECT d.*, i.name as lead_name, u.username as seller_name, u.email as seller_email
            FROM sales_demos d
            JOIN sales_inquiries i ON d.inquiry_id = i.id
            JOIN sales_team_users u ON d.seller_id = u.id
            WHERE d.id = $1
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Demo not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching demo details:', error);
        res.status(500).json({ error: 'Failed to fetch demo details' });
    }
});

/**
 * POST /api/sales/onboard
 * Onboard a new clinic from a sales inquiry (with optional referral activation)
 * This combines clinic creation + referral activation in one atomic flow.
 */
router.post('/onboard', verifyToken, async (req, res) => {
    const { inquiryId, clinic, adminUser, referralToken } = req.body;

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

        // 5. Handle referral activation if inquiry has referral code OR token
        let referralActivated = false;

        // Use token first (dynamic), then fallback to code (static)
        const refToken = referralToken || inquiry?.referral_token;
        const refCode = inquiry?.referral_code;

        if (refToken && (!inquiry || !inquiry.referral_activated)) {
            const tokenRes = await pool.query(
                "SELECT * FROM public.clinic_referrals WHERE token = $1 AND status = 'pending' AND (token_expires_at IS NULL OR token_expires_at > NOW())",
                [refToken]
            );

            if (tokenRes.rows.length > 0) {
                const referral = tokenRes.rows[0];
                console.log(`[SALES] Activating referral via TOKEN for referrer ${referral.referrer_clinic_id}`);

                await pool.query(`
                    UPDATE public.clinic_referrals 
                    SET status = 'active', referred_clinic_id = $1, updated_at = NOW()
                    WHERE id = $2
                `, [clinicId, referral.id]);

                if (inquiryId) {
                    await pool.query(`
                        UPDATE sales_inquiries SET referral_activated = true, referral_activated_at = NOW() WHERE id = $1
                    `, [inquiryId]);
                }
                referralActivated = true;
            }
        } else if (inquiry && refCode && !inquiry.referral_activated) {
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
                        created_at,
                        signed_up_at
                    ) VALUES ($1, $2, $3, $4, 'active', NOW(), NOW())
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

            // AUTO-ACTION: Complete all associated demos
            await pool.query(`
                UPDATE sales_demos 
                SET status = 'completed', 
                    outcome_category = 'converted',
                    outcome_notes = 'Auto-completed via clinic onboarding',
                    completed_at = NOW(),
                    updated_at = NOW()
                WHERE inquiry_id = $1 AND status != 'completed'
            `, [inquiryId]);
        }

        // 7. Log conversion for commission tracking
        const convertingUserId = req.user?.id;
        if (inquiryId && convertingUserId) {
            await pool.query(`
                INSERT INTO sales_inquiry_logs (inquiry_id, admin_id, type, content, metadata)
                VALUES ($1, $2, 'conversion', $3, $4)
            `, [
                inquiryId,
                convertingUserId,
                `🎉 Clinic "${clinic.displayName || clinic.name}" successfully onboarded!`,
                JSON.stringify({
                    clinic_id: clinicId,
                    clinic_name: clinic.displayName || clinic.name,
                    clinic_slug: clinic.slug,
                    converted_by_user_id: convertingUserId,
                    converted_at: new Date().toISOString(),
                    referral_activated: referralActivated,
                    admin_email: adminUser?.email || null,
                    commission_eligible: true // For future commission calculations
                })
            ]);

            // 8. Mark lead as finalized (stops appearing in active searches)
            await pool.query(`
                UPDATE sales_inquiries 
                SET is_finalized = true, finalized_at = NOW()
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
        const { uuid, message } = req.body;
        if (!uuid) return res.status(400).json({ error: 'UUID required' });

        const result = await pool.query(
            'SELECT id, name, email, status, is_finalized FROM sales_inquiries WHERE uuid = $1',
            [uuid]
        );
        const inquiry = result.rows[0];

        if (!inquiry) return res.status(404).json({ error: 'Lead not found' });

        // SKIP logging for finalized/converted leads - they are done!
        if (inquiry.is_finalized || inquiry.status === 'converted') {
            console.log(`[SALES] Skipping return visit log for finalized lead #${inquiry.id} (${inquiry.email})`);
            return res.json({
                success: true,
                message: 'Lead is finalized, no activity logged',
                leadId: inquiry.id,
                skipped: true
            });
        }

        // Update last activity
        await pool.query(
            'UPDATE sales_inquiries SET last_activity_at = NOW(), updated_at = NOW() WHERE id = $1',
            [inquiry.id]
        );

        // Log the return visit
        const logContent = message
            ? `Lead returned to sandbox via persistent cookie - Message: "${message}"`
            : 'Lead returned to sandbox via persistent cookie';

        // DE-DUPLICATION: Check if ANY inquiry record with this email has a recent return_visit log
        // This handles cases where people have multiple historical records/UUIDs.
        const recentLogRes = await pool.query(`
            SELECT id FROM sales_inquiry_logs 
            WHERE inquiry_id IN (
                SELECT id FROM sales_inquiries WHERE LOWER(email) = LOWER($1)
            )
            AND type = 'return_visit' 
            AND created_at > NOW() - INTERVAL '5 minutes'
            ORDER BY created_at DESC LIMIT 1
        `, [inquiry.email]);

        if (recentLogRes.rows.length > 0) {
            const logId = recentLogRes.rows[0].id;
            if (message) {
                // If we have a message now, upgrade the existing recent log entry
                await pool.query(
                    'UPDATE sales_inquiry_logs SET content = $1 WHERE id = $2',
                    [logContent, logId]
                );
            }
            // Log found, we either updated it or skip if no new message info
            return res.json({ success: true, leadName: inquiry.name });
        }

        await pool.query(`
            INSERT INTO sales_inquiry_logs (inquiry_id, type, content)
            VALUES ($1, 'return_visit', $2)
        `, [inquiry.id, logContent]);

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
    console.log('[SALES] Received concierge inquiry:', req.body);
    try {
        const { uuid, message } = req.body;
        if (!message) return res.status(400).json({ error: 'Message required' });

        let inquiryId = null;
        if (uuid) {
            const result = await pool.query(
                'SELECT id FROM sales_inquiries WHERE uuid = $1',
                [uuid]
            );
            inquiryId = result.rows[0]?.id;
        }

        if (inquiryId) {
            // Log with known inquiry
            await pool.query(`
                INSERT INTO sales_inquiry_logs (inquiry_id, type, content)
                VALUES ($1, 'user_inquiry', $2)
            `, [inquiryId, message]);

            await pool.query(
                'UPDATE sales_inquiries SET last_activity_at = NOW(), updated_at = NOW() WHERE id = $1',
                [inquiryId]
            );
        } else {
            // Log as orphaned note if UUID is missing or invalid
            await pool.query(`
                INSERT INTO sales_inquiry_logs (inquiry_id, type, content)
                VALUES ($1, 'user_inquiry', $2)
            `, [0, `[ORPHANED] ${message}`]); // id 0 or similar for generic?
            // Actually, inquiry_id should be not null probably.
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error posting concierge inquiry:', error);
        res.status(500).json({ error: 'Failed to post inquiry' });
    }
});

/**
 * POST /api/sales/inquiries/:id/view
 * Mark a lead as viewed by an admin
 */
router.post('/inquiries/:id/view', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;

        // Update last_viewed_at for all inquiries with this email
        await pool.query(`
            UPDATE sales_inquiries 
            SET last_viewed_at = NOW() 
            WHERE LOWER(email) = (
                SELECT LOWER(email) FROM sales_inquiries WHERE id = $1
            )
        `, [id]);

        res.json({ success: true });
    } catch (error) {
        console.error('Error marking as viewed:', error);
        res.status(500).json({ error: 'Failed to mark as viewed' });
    }
});

/**
 * POST /api/sales/inquiries/:id/claim
 * Explicitly claim a lead (PROTECTED)
 */
router.post('/inquiries/:id/claim', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const adminId = req.user.id;

        // Check if already claimed
        const checkRes = await pool.query('SELECT is_claimed, claimed_by FROM sales_inquiries WHERE id = $1', [id]);
        if (checkRes.rows.length === 0) return res.status(404).json({ error: 'Inquiry not found' });

        if (checkRes.rows[0].is_claimed) {
            return res.status(400).json({ error: 'Lead is already claimed by another seller.' });
        }

        await pool.query(`
            UPDATE sales_inquiries
            SET claimed_by = $1, is_claimed = true, updated_at = NOW()
            WHERE id = $2
        `, [adminId, id]);

        await pool.query(`
            INSERT INTO sales_inquiry_logs (inquiry_id, admin_id, type, content)
            VALUES ($1, $2, 'note', 'Lead explicitly claimed')
        `, [id, adminId]);

        res.json({ success: true, message: 'Lead claimed successfully' });
    } catch (error) {
        console.error('Error claiming lead:', error);
        res.status(500).json({ error: 'Failed to claim lead' });
    }
});

/**
 * GET /api/sales/master-schedule
 * Get all demos for manager view (PROTECTED)
 */
router.get('/master-schedule', verifyToken, async (req, res) => {
    try {
        // Determine access level
        const userRes = await pool.query('SELECT role FROM sales_team_users WHERE id = $1', [req.user.id]);
        const userRole = userRes.rows[0]?.role;
        const isAdminOrManager = userRole === 'sales_manager' || req.user.username === 'admin';

        let query = `
            SELECT d.*, 
                   i.name as lead_name, 
                   i.email as lead_email,
                   i.phone as lead_phone,
                   i.practice_name,
                   i.provider_count,
                   i.interest_type,
                   i.source,
                   i.status as lead_status,
                   u.username as seller_name, 
                   u.calendar_color
            FROM sales_demos d
            JOIN sales_inquiries i ON d.inquiry_id = i.id
            JOIN sales_team_users u ON d.seller_id = u.id
            WHERE 1=1
        `;

        const params = [];

        // If not admin/manager, restrict to own demos
        if (!isAdminOrManager) {
            params.push(req.user.id);
            query += ` AND d.seller_id = $${params.length}`;
        }

        query += ` ORDER BY d.scheduled_at ASC`;

        const result = await pool.query(query, params);
        res.json({ demos: result.rows });
    } catch (error) {
        console.error('Error fetching master schedule:', error);
        res.status(500).json({ error: 'Failed to fetch master schedule' });
    }
});

/**
 * PATCH /api/sales/demos/:id/confirm
 * Confirm or deny a demo (PUBLIC)
 */
router.patch('/demos/:id/confirm', async (req, res) => {
    try {
        const { id } = req.params;
        const { action } = req.body; // 'accept' or 'deny'

        if (!['accept', 'deny'].includes(action)) {
            return res.status(400).json({ error: 'Invalid action' });
        }

        // Check current status
        const currentRes = await pool.query('SELECT status FROM sales_demos WHERE id = $1', [id]);
        if (currentRes.rows.length === 0) {
            return res.status(404).json({ error: 'Demo not found' });
        }

        const currentStatus = currentRes.rows[0].status;

        // Block re-confirmation/modification of Cancelled/Declined demos
        if (['declined', 'cancelled'].includes(currentStatus)) {
            return res.status(400).json({
                error: 'This appointment was cancelled. To reschedule, please contact support.',
                code: 'APPOINTMENT_CANCELLED'
            });
        }

        // If already confirmed and trying to confirm again, just return success
        if (currentStatus === 'confirmed' && action === 'accept') {
            return res.json({ success: true, status: 'confirmed', message: 'Already confirmed' });
        }

        const newStatus = action === 'accept' ? 'confirmed' : 'declined';

        // 1. Update demo status
        const demoRes = await pool.query(`
            UPDATE sales_demos 
            SET status = $1, updated_at = NOW()
            WHERE id = $2
            RETURNING inquiry_id, seller_id, scheduled_at
        `, [newStatus, id]);

        if (demoRes.rows.length === 0) {
            return res.status(404).json({ error: 'Demo not found' });
        }

        const demo = demoRes.rows[0];

        // 2. Log activity
        await pool.query(`
            INSERT INTO sales_inquiry_logs (inquiry_id, type, content, metadata)
            VALUES ($1, 'demo_status_change', $2, $3)
        `, [
            demo.inquiry_id,
            `Demo ${newStatus} by prospect`,
            JSON.stringify({ demoId: id, action, from: 'email_link' })
        ]);

        // 3. (Optional) If declined, maybe notify seller via email or system notification?
        // keeping it simple for now.

        res.json({ success: true, status: newStatus });

    } catch (error) {
        console.error('Error confirming demo:', error);
        res.status(500).json({ error: 'Failed to update demo status' });
    }
});

/**
 * DELETE /api/sales/demos/:id
 * Delete a demo appointment (Protected)
 */
router.delete('/demos/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        // 1. Get demo details for logging
        const demoRes = await pool.query('SELECT * FROM sales_demos WHERE id = $1', [id]);
        if (demoRes.rows.length === 0) {
            return res.status(404).json({ error: 'Demo not found' });
        }
        const demo = demoRes.rows[0];

        // 2. Delete the demo
        await pool.query('DELETE FROM sales_demos WHERE id = $1', [id]);

        // 3. Log the deletion
        await pool.query(`
            INSERT INTO sales_inquiry_logs (inquiry_id, type, content, metadata)
            VALUES ($1, 'demo_deleted', $2, $3)
        `, [
            demo.inquiry_id,
            `Demo appointment deleted by user`,
            JSON.stringify({ deleted_by: userId, scheduled_at: demo.scheduled_at })
        ]);

        res.json({ success: true, message: 'Demo deleted successfully' });

    } catch (error) {
        console.error('Error deleting demo:', error);
        res.status(500).json({ error: 'Failed to delete demo' });
    }
});

/**
 * POST /api/sales/demos/:id/complete
 * Mark a demo as successfully completed with outcome category
 */
router.post('/demos/:id/complete', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { category, notes } = req.body;
        const adminId = req.user.id;

        if (!category || !notes) {
            return res.status(400).json({ error: 'Outcome category and notes are required' });
        }

        // 1. Get demo info
        const demoRes = await pool.query(`
            SELECT d.inquiry_id, i.name as lead_name, i.status as current_status
            FROM sales_demos d
            JOIN sales_inquiries i ON d.inquiry_id = i.id
            WHERE d.id = $1
        `, [id]);

        if (demoRes.rows.length === 0) {
            return res.status(404).json({ error: 'Demo not found' });
        }
        const demo = demoRes.rows[0];

        // 2. Update demo status
        await pool.query(`
            UPDATE sales_demos 
            SET status = 'completed', 
                outcome_category = $1, 
                outcome_notes = $2, 
                completed_at = NOW(),
                updated_at = NOW()
            WHERE id = $3
        `, [category, notes.trim(), id]);

        // AUTO-ACTION: If converted, complete ALL other demos for this inquiry
        if (category === 'converted') {
            await pool.query(`
                UPDATE sales_demos 
                SET status = 'completed', 
                    outcome_category = 'converted',
                    outcome_notes = 'Auto-completed via related demo conversion',
                    completed_at = NOW(),
                    updated_at = NOW()
                WHERE inquiry_id = $1 AND id != $2 AND status != 'completed'
            `, [demo.inquiry_id, id]);
        }

        // 3. Update Inquiry status based on category
        let newInquiryStatus = 'follow_up'; // Default for undecided/budget/asking_time
        let dismissalReason = null;

        if (category === 'converted') {
            newInquiryStatus = 'converted';
        } else if (category === 'not_interested') {
            newInquiryStatus = 'dismissed';
            dismissalReason = 'not_interested';
        }

        if (dismissalReason) {
            await pool.query(`
                UPDATE sales_inquiries
                SET status = $1,
                    dismissal_reason = $2,
                    dismissal_notes = $3,
                    dismissed_at = NOW(),
                    dismissed_by = $4,
                    updated_at = NOW(),
                    is_claimed = false,
                    claimed_by = NULL
                WHERE id = $5
            `, [newInquiryStatus, dismissalReason, notes.trim(), adminId, demo.inquiry_id]);
        } else {
            await pool.query(`
                UPDATE sales_inquiries
                SET status = $1, updated_at = NOW()
                WHERE id = $2
            `, [newInquiryStatus, demo.inquiry_id]);
        }

        // 4. Log the activity
        const labels = {
            converted: 'Converted',
            undecided: 'Undecided',
            asking_time: 'Asking for Time',
            not_interested: 'Not Interested',
            budget: 'Budget Constraints',
            other: 'Other Outcome'
        };

        await pool.query(`
            INSERT INTO sales_inquiry_logs (inquiry_id, admin_id, type, content, metadata)
            VALUES ($1, $2, 'demo_complete', $3, $4)
        `, [
            demo.inquiry_id,
            adminId,
            `Demo Completed - Outcome: ${labels[category] || category}`,
            JSON.stringify({ category, notes: notes.trim(), demoId: id })
        ]);

        console.log(`[SALES] Demo #${id} marked as completed (${category}) by user ${adminId}`);
        res.json({ success: true, newInquiryStatus });

    } catch (error) {
        console.error('Error completing demo:', error);
        res.status(500).json({ error: 'Failed to complete demo' });
    }
});

/**
 * POST /api/sales/demos/:id/cancel
 * Seller cancels an appointment with a reason
 */
router.post('/demos/:id/cancel', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        const userId = req.user.id;

        if (!reason || !reason.trim()) {
            return res.status(400).json({ error: 'Cancellation reason is required' });
        }

        // 1. Get demo details
        const demoRes = await pool.query('SELECT * FROM sales_demos WHERE id = $1', [id]);
        if (demoRes.rows.length === 0) {
            return res.status(404).json({ error: 'Demo not found' });
        }
        const demo = demoRes.rows[0];

        // 2. Update status
        // Use 'declined' status for demo (standard for negative outcome)
        await pool.query(`
            UPDATE sales_demos 
            SET status = 'declined', updated_at = NOW()
            WHERE id = $1
    `, [id]);

        // Update inquiry status to 'closed' and append cancellation note
        await pool.query(`
            UPDATE sales_inquiries 
            SET status = 'closed',
    notes = COALESCE(notes, '') || ' [SALVAGE] ' || $2,
    updated_at = NOW() 
            WHERE id = $1
    `, [demo.inquiry_id, reason]);

        // 3. Log the cancellation

        // 3. Log the cancellation
        await pool.query(`
            INSERT INTO sales_inquiry_logs(inquiry_id, type, content, metadata)
VALUES($1, 'demo_cancelled_seller', $2, $3)
        `, [
            demo.inquiry_id,
            `Appointment cancelled by seller: ${reason} `,
            JSON.stringify({ cancelled_by: userId, reason })
        ]);

        res.json({ success: true, message: 'Appointment cancelled successfully' });

    } catch (error) {
        console.error('Error cancelling demo:', error);
        res.status(500).json({ error: 'Failed to cancel appointment' });
    }
});

/**
 * DELETE /api/sales/inquiries/:id
 * Permanent deletion of a lead (Admin only)
 */
router.delete('/inquiries/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const adminId = req.user.id;

        // Ensure user is admin/manager for deletion
        if (req.user.role !== 'sales_manager' && req.user.username !== 'admin') {
            return res.status(403).json({ error: 'Unauthorized to delete leads' });
        }

        // Get name for logging
        const inquiryRes = await pool.query('SELECT name FROM sales_inquiries WHERE id = $1', [id]);
        if (inquiryRes.rows.length === 0) return res.status(404).json({ error: 'Inquiry not found' });
        const leadName = inquiryRes.rows[0].name;

        // Delete logs first (cascade or manual)
        await pool.query('DELETE FROM sales_inquiry_logs WHERE inquiry_id = $1', [id]);
        // Delete demos
        await pool.query('DELETE FROM sales_demos WHERE inquiry_id = $1', [id]);
        // Delete inquiry
        await pool.query('DELETE FROM sales_inquiries WHERE id = $1', [id]);

        console.log(`[SALES] Lead #${id} (${leadName}) PERMANENTLY DELETED by user ${adminId} `);
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting lead:', error);
        res.status(500).json({ error: 'Failed to delete lead' });
    }
});

module.exports = router;

