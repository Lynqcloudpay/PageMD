const express = require('express');
const crypto = require('crypto');
const pool = require('../db');
const { authenticate, logAudit } = require('../middleware/auth');
const emailService = require('../services/emailService');

const router = express.Router();

/**
 * Helper: Token logic
 * Tokens are random 32-byte hex strings.
 * We only store the SHA-256 hash.
 */
function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Helper: Log Audit Event (Digital Intake Specific)
 */
async function logIntakeAudit(client, tenantId, actorType, actorId, action, objectType, objectId, req) {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];
    await client.query(`
        INSERT INTO audit_events (tenant_id, actor_type, actor_id, action, object_type, object_id, ip, user_agent)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [tenantId, actorType, actorId, action, objectType, objectId, ip, userAgent]);
}

// --- STAFF ENDPOINTS (Requires Authentication) ---

/**
 * POST /invite
 * Create a new intake invitation
 */
router.post('/invite', authenticate, async (req, res) => {
    const client = await pool.connect();
    try {
        const { channel, toPhone, toEmail, prefill } = req.body;
        const tenantId = req.clinic.id;

        const token = generateToken();
        const tokenHash = hashToken(token);
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 72); // 72 hour expiration

        await client.query('BEGIN');

        const result = await client.query(`
            INSERT INTO intake_invites (
                tenant_id, created_by_user_id, channel, to_phone, to_email,
                prefill_first_name, prefill_last_name, prefill_dob, prefill_phone,
                token_hash, expires_at, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'Sent')
            RETURNING id, created_at
        `, [
            tenantId, req.user.id, channel,
            toPhone || null, toEmail || null,
            prefill?.firstName || null, prefill?.lastName || null,
            prefill?.dob || null, prefill?.phone || null,
            tokenHash, expiresAt
        ]);

        const inviteId = result.rows[0].id;
        const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
        const inviteLink = `${FRONTEND_URL}/r/${token}`;

        // Log Audit
        await logIntakeAudit(client, tenantId, 'staff', req.user.id, 'invite_create', 'intake_invites', inviteId, req);

        // Send Email/SMS
        if (channel === 'email' && toEmail) {
            // Reusing sendPortalInvite logic but customized for intake if we had it
            // For now, let's just log or send a generic invite via emailService
            await emailService._send(toEmail, 'Patient Registration', `
                <h2>Complete Your Registration</h2>
                <p>Hello ${prefill?.firstName || 'Patient'},</p>
                <p>Please complete your registration forms before your visit using this secure link:</p>
                <div style="margin: 20px 0;">
                    <a href="${inviteLink}" style="padding: 10px 20px; background: #2563eb; color: white; border-radius: 5px; text-decoration: none;">Start Registration</a>
                </div>
                <p>This link expires in 72 hours.</p>
            `);
        } else if (channel === 'sms' && toPhone) {
            console.log(`[SMS MOCK] To ${toPhone}: Complete your registration at ${inviteLink}`);
        }

        await client.query('COMMIT');

        res.json({
            id: inviteId,
            token: token, // Return raw token ONLY ONCE during creation
            inviteLink: inviteLink,
            expiresAt
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[Intake] Invite failed:', error);
        res.status(500).json({ error: 'Failed to create invite' });
    } finally {
        client.release();
    }
});

/**
 * GET /invites
 * List invites for the tenant
 */
router.get('/invites', authenticate, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT i.*, u.first_name as staff_first_name, u.last_name as staff_last_name
            FROM intake_invites i
            LEFT JOIN public.users u ON i.created_by_user_id = u.id
            WHERE i.tenant_id = $1
            ORDER BY i.created_at DESC
        `, [req.clinic.id]);
        res.json(result.rows);
    } catch (error) {
        console.error('[Intake] List failed:', error);
        res.status(500).json({ error: 'Failed' });
    }
});

// --- PUBLIC ENDPOINTS (No Authentication req, but token required) ---

/**
 * GET /public/details/:token
 * Get minimal prefill info for the registration form
 */
router.get('/public/details/:token', async (req, res) => {
    try {
        const token = req.params.token;
        const tokenHash = hashToken(token);

        // Since this is public, we need to find the schema.
        // resolveTenant will handle finding the correct schema and setting pool context
        // IF we update it to support this route. 
        // For now, we assume search_path is set by resolveTenant or we do global search.

        const result = await pool.query(`
            SELECT id, channel, prefill_first_name, prefill_last_name, prefill_dob, prefill_phone, status, expires_at
            FROM intake_invites
            WHERE token_hash = $1 AND expires_at > CURRENT_TIMESTAMP
        `, [tokenHash]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Invalid or expired registration link' });
        }

        const invite = result.rows[0];
        if (invite.status === 'Approved') {
            return res.status(400).json({ error: 'This registration has already been completed and approved.' });
        }

        // Return details
        res.json({
            id: invite.id,
            firstName: invite.prefill_first_name,
            lastName: invite.prefill_last_name,
            dob: invite.prefill_dob,
            phone: invite.prefill_phone,
            status: invite.status
        });
    } catch (error) {
        console.error('[Intake] Public details failed:', error);
        res.status(500).json({ error: 'System error' });
    }
});

/**
 * POST /public/save/:token
 * Autosave progress
 */
router.post('/public/save/:token', async (req, res) => {
    const client = await pool.connect();
    try {
        const token = req.params.token;
        const tokenHash = hashToken(token);
        const { data } = req.body;

        await client.query('BEGIN');

        // 1. Find invite
        const inviteRes = await client.query('SELECT id, tenant_id FROM intake_invites WHERE token_hash = $1', [tokenHash]);
        if (inviteRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Link invalid' });
        }
        const invite = inviteRes.rows[0];

        // 2. Upsert submission
        await client.query(`
            INSERT INTO intake_submissions (tenant_id, invite_id, data_json, updated_at)
            VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
            ON CONFLICT (invite_id) DO UPDATE SET 
                data_json = EXCLUDED.data_json,
                updated_at = CURRENT_TIMESTAMP
        `, [invite.tenant_id, invite.id, data]);

        // 3. Update invite status to InProgress if it was Sent
        await client.query(`
            UPDATE intake_invites SET status = 'InProgress', updated_at = CURRENT_TIMESTAMP
            WHERE id = $1 AND status = 'Sent'
        `, [invite.id]);

        await client.query('COMMIT');
        res.json({ success: true });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[Intake] Save failed:', error);
        res.status(500).json({ error: 'Save failed' });
    } finally {
        client.release();
    }
});

/**
 * POST /public/submit/:token
 * Final submission
 */
router.post('/public/submit/:token', async (req, res) => {
    const client = await pool.connect();
    try {
        const token = req.params.token;
        const tokenHash = hashToken(token);
        const { data, signatures } = req.body;

        await client.query('BEGIN');

        // 1. Find invite
        const inviteRes = await client.query('SELECT id, tenant_id, prefill_first_name, prefill_last_name FROM intake_invites WHERE token_hash = $1', [tokenHash]);
        if (inviteRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Link invalid' });
        }
        const invite = inviteRes.rows[0];

        // 2. Finalize submission
        const subRes = await client.query(`
            INSERT INTO intake_submissions (tenant_id, invite_id, data_json, signature_json, submitted_at)
            VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
            ON CONFLICT (invite_id) DO UPDATE SET 
                data_json = EXCLUDED.data_json,
                signature_json = EXCLUDED.signature_json,
                submitted_at = CURRENT_TIMESTAMP
            RETURNING id
        `, [invite.tenant_id, invite.id, data, signatures]);

        const submissionId = subRes.rows[0].id;

        // 3. Update invite status
        await client.query(`
            UPDATE intake_invites SET status = 'Submitted', updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
        `, [invite.id]);

        // 4. Create Inbox Item
        const patientName = `${data.firstName || invite.prefill_first_name || ''} ${data.lastName || invite.prefill_last_name || ''}`.trim() || 'New Patient';
        await client.query(`
            INSERT INTO inbox_items (
                tenant_id, type, subject, body, reference_id, reference_table, status, priority
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
            invite.tenant_id,
            'new_patient_registration',
            `New Patient: ${patientName}`,
            `Registration submitted for review. Form includes demographics, insurance, and medical history.`,
            submissionId,
            'intake_submissions',
            'new',
            'normal'
        ]);

        await logIntakeAudit(client, invite.tenant_id, 'patient', invite.id, 'submit', 'intake_submissions', submissionId, req);

        await client.query('COMMIT');
        res.json({ success: true });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[Intake] Submit failed:', error);
        res.status(500).json({ error: 'Submission failed' });
    } finally {
        client.release();
    }
});

module.exports = router;
