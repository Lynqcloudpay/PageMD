const express = require('express');
const jwt = require('jsonwebtoken');
const pool = require('../../db');
const passwordService = require('../../services/passwordService');
const emailService = require('../../services/emailService');
const { body, validationResult } = require('express-validator');
const { authLimiter } = require('../../middleware/security');

const router = express.Router();

// Apply rate limiting to all portal auth endpoints
router.use(authLimiter);

/**
 * Patient Login
 * POST /api/portal/auth/login
 */
router.post('/login', [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, password } = req.body;

        // Note: req.clinic and search_path are already set by resolveTenant
        const result = await pool.query(`
            SELECT a.*, p.first_name, p.last_name
            FROM patient_portal_accounts a
            JOIN patients p ON a.patient_id = p.id
            WHERE a.email = $1
        `, [email]);

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const account = result.rows[0];

        if (account.status === 'locked') {
            return res.status(401).json({ error: 'Account is locked. Please contact your clinic.' });
        }

        const valid = await passwordService.verifyPassword(account.password_hash, password);
        if (!valid) {
            // TODO: Track failed attempts and lock account
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Update last login
        await pool.query('UPDATE patient_portal_accounts SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1', [account.id]);

        // Audit log
        await pool.query(`
            INSERT INTO patient_portal_audit_log (account_id, patient_id, action, ip_address, user_agent)
            VALUES ($1, $2, $3, $4, $5)
        `, [account.id, account.patient_id, 'login', req.ip, req.get('user-agent')]);

        // Generate JWT (distinct from staff auth)
        // We include portal: true to differentiate from staff sessions
        const token = jwt.sign(
            {
                portalAccountId: account.id,
                patientId: account.patient_id,
                clinicSlug: req.clinic.slug,
                isPortal: true
            },
            process.env.JWT_SECRET,
            { expiresIn: '12h' }
        );

        res.json({
            token,
            patient: {
                id: account.patient_id,
                firstName: account.first_name,
                lastName: account.last_name,
                email: account.email
            },
            clinic: {
                name: req.clinic.display_name,
                slug: req.clinic.slug
            }
        });

    } catch (error) {
        console.error('[Portal Auth] Login error:', error);
        res.status(500).json({ error: 'Internal server error during login' });
    }
});

/**
 * Apple Sign In
 * POST /api/portal/auth/apple
 * Handles Sign in with Apple OAuth flow
 */
router.post('/apple', async (req, res) => {
    try {
        const { id_token, user } = req.body;

        if (!id_token) {
            return res.status(400).json({ error: 'Missing Apple ID token' });
        }

        // Decode the Apple ID token (JWT) to get the user info
        // In production, you should verify the token signature with Apple's public keys
        const tokenParts = id_token.split('.');
        if (tokenParts.length !== 3) {
            return res.status(400).json({ error: 'Invalid Apple ID token format' });
        }

        const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());

        // Apple provides a unique user identifier
        const appleUserId = payload.sub;
        const appleEmail = payload.email || user?.email;

        if (!appleEmail) {
            return res.status(400).json({ error: 'Email not available from Apple. Please use email/password login.' });
        }

        console.log('[Portal Auth] Apple Sign In attempt:', { appleUserId, appleEmail });

        // First, check if we have an Apple ID link for this user
        let account = null;

        // Check for existing apple_user_id link
        const appleLink = await pool.query(`
            SELECT a.*, p.first_name, p.last_name
            FROM patient_portal_accounts a
            JOIN patients p ON a.patient_id = p.id
            WHERE a.apple_user_id = $1
        `, [appleUserId]);

        if (appleLink.rows.length > 0) {
            account = appleLink.rows[0];
        } else {
            // No Apple link exists, try to find account by email
            const emailResult = await pool.query(`
                SELECT a.*, p.first_name, p.last_name
                FROM patient_portal_accounts a
                JOIN patients p ON a.patient_id = p.id
                WHERE LOWER(a.email) = LOWER($1)
            `, [appleEmail]);

            if (emailResult.rows.length === 0) {
                return res.status(401).json({
                    error: 'No patient account found with this Apple ID email. Please contact your healthcare provider to set up portal access.'
                });
            }

            account = emailResult.rows[0];

            // Link this Apple ID to the account for future logins
            await pool.query(
                'UPDATE patient_portal_accounts SET apple_user_id = $1 WHERE id = $2',
                [appleUserId, account.id]
            );
            console.log('[Portal Auth] Linked Apple ID to portal account:', account.id);
        }

        if (account.status === 'locked') {
            return res.status(401).json({ error: 'Account is locked. Please contact your clinic.' });
        }

        // Update last login
        await pool.query('UPDATE patient_portal_accounts SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1', [account.id]);

        // Audit log
        await pool.query(`
            INSERT INTO patient_portal_audit_log (account_id, patient_id, action, ip_address, user_agent)
            VALUES ($1, $2, $3, $4, $5)
        `, [account.id, account.patient_id, 'apple_login', req.ip, req.get('user-agent')]);

        // Generate JWT
        const token = jwt.sign(
            {
                portalAccountId: account.id,
                patientId: account.patient_id,
                clinicSlug: req.clinic.slug,
                isPortal: true
            },
            process.env.JWT_SECRET,
            { expiresIn: '12h' }
        );

        res.json({
            token,
            patient: {
                id: account.patient_id,
                firstName: account.first_name,
                lastName: account.last_name,
                email: account.email
            },
            clinic: {
                name: req.clinic.display_name,
                slug: req.clinic.slug
            }
        });

    } catch (error) {
        console.error('[Portal Auth] Apple Sign In error:', error);
        res.status(500).json({ error: 'Apple Sign In failed. Please try again or use email/password.' });
    }
});

/**
 * Portal Logout
 * POST /api/portal/auth/logout
 */
router.post('/logout', async (req, res) => {
    // No-op for now as we use stateless JWT, but we can log the action
    res.json({ success: true });
});

/**
 * Forgot Password
 * POST /api/portal/auth/forgot
 */
router.post('/forgot', [
    body('email').isEmail().normalizeEmail()
], async (req, res) => {
    try {
        const { email } = req.body;
        const crypto = require('crypto');

        // Check if account exists
        const result = await pool.query('SELECT id FROM patient_portal_accounts WHERE email = $1', [email]);

        if (result.rows.length > 0) {
            const token = crypto.randomBytes(32).toString('hex');
            const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
            const expires = new Date(Date.now() + 3600000); // 1 hour

            await pool.query(
                'UPDATE patient_portal_accounts SET reset_token_hash = $1, reset_token_expires = $2 WHERE email = $3',
                [tokenHash, expires, email]
            );

            const resetLink = `${process.env.PORTAL_URL || 'http://localhost:5173/portal'}/reset-password?token=${token}&email=${email}`;

            try {
                await emailService.sendPasswordReset(email, resetLink);
            } catch (emailErr) {
                console.warn('[Portal Auth] Failed to send reset email:', emailErr.message);
            }

            // For dev visibility
            console.log(`[AUTH] Reset Link: ${resetLink}`);
        }

        // Always return same message for security
        res.json({ message: 'If an account exists with this email, you will receive a reset link shortly.' });
    } catch (error) {
        console.error('[Portal Auth] Forgot password error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Reset Password
 * POST /api/portal/auth/reset
 */
router.post('/reset', [
    body('token').notEmpty(),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 })
], async (req, res) => {
    try {
        const { token, email, password } = req.body;
        const crypto = require('crypto');
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

        const result = await pool.query(`
            SELECT id FROM patient_portal_accounts 
            WHERE email = $1 AND reset_token_hash = $2 AND reset_token_expires > CURRENT_TIMESTAMP
        `, [email, tokenHash]);

        if (result.rows.length === 0) {
            return res.status(400).json({ error: 'Invalid or expired reset token' });
        }

        const accountId = result.rows[0].id;
        const passwordHash = await passwordService.hashPassword(password);

        await pool.query(`
            UPDATE patient_portal_accounts 
            SET password_hash = $1, reset_token_hash = NULL, reset_token_expires = NULL 
            WHERE id = $2
        `, [passwordHash, accountId]);

        res.json({ success: true, message: 'Password has been reset successfully.' });
    } catch (error) {
        console.error('[Portal Auth] Reset password error:', error);
        res.status(500).json({ error: 'Failed to reset password' });
    }
});

/**
 * Verify Invitation Token
 * GET /api/portal/auth/invite/:token
 */
router.get('/invite/:token', async (req, res) => {
    try {
        const { token } = req.params;
        const tokenHash = require('crypto').createHash('sha256').update(token).digest('hex');

        const result = await pool.query(`
            SELECT i.*, p.first_name, p.last_name
            FROM patient_portal_invites i
            JOIN patients p ON i.patient_id = p.id
            WHERE i.token_hash = $1 AND i.used_at IS NULL AND i.expires_at > CURRENT_TIMESTAMP
        `, [tokenHash]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Invalid or expired invitation token' });
        }

        const invite = result.rows[0];
        res.json({
            email: invite.email,
            patientName: `${invite.first_name} ${invite.last_name}`
        });
    } catch (error) {
        console.error('[Portal Auth] Invite verification error:', error);
        res.status(500).json({ error: 'Failed to verify invitation' });
    }
});

/**
 * Register / Redeem Invitation
 * POST /api/portal/auth/register
 */
router.post('/register', [
    body('token').notEmpty(),
    body('password').isLength({ min: 8 })
], async (req, res) => {
    const client = await pool.connect();
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { token, password } = req.body;
        const tokenHash = require('crypto').createHash('sha256').update(token).digest('hex');

        await client.query('BEGIN');

        // 1. Verify token
        const inviteResult = await client.query(`
            SELECT * FROM patient_portal_invites 
            WHERE token_hash = $1 AND used_at IS NULL AND expires_at > CURRENT_TIMESTAMP
            FOR UPDATE
        `, [tokenHash]);

        if (inviteResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Invalid or expired invitation token' });
        }

        const invite = inviteResult.rows[0];

        // 2. Create account
        const passwordHash = await passwordService.hashPassword(password);
        const accountResult = await client.query(`
            INSERT INTO patient_portal_accounts (patient_id, email, password_hash, status)
            VALUES ($1, $2, $3, 'active')
            RETURNING id
        `, [invite.patient_id, invite.email, passwordHash]);

        const accountId = accountResult.rows[0].id;

        // 3. Mark invite as used
        await client.query('UPDATE patient_portal_invites SET used_at = CURRENT_TIMESTAMP WHERE id = $1', [invite.id]);

        // 4. Create default permissions
        await client.query('INSERT INTO patient_portal_permissions (account_id) VALUES ($1)', [accountId]);

        await client.query('COMMIT');

        res.json({ success: true, message: 'Account created successfully. You can now log in.' });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[Portal Auth] Registration error:', error);
        res.status(500).json({ error: 'Failed to register account' });
    } finally {
        client.release();
    }
});

module.exports = router;
