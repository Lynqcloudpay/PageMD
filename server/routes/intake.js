const express = require('express');
const crypto = require('crypto');
const pool = require('../db');
const { authenticate, logAudit } = require('../middleware/auth');
const emailService = require('../services/emailService');

const router = express.Router();

/**
 * Helper: Generate readable Resume Code (8 chars)
 */
function generateResumeCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No O, 0, I, 1
    let code = '';
    for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

function hashToken(token) {
    return crypto.createHash('sha256').update(token.toUpperCase()).digest('hex');
}

/**
 * Helper: Log Audit Event
 */
async function logIntakeAudit(client, tenantId, actorType, actorId, action, objectType, objectId, req) {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];
    await client.query(`
        INSERT INTO audit_events (tenant_id, actor_type, actor_id, action, object_type, object_id, ip, user_agent)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [tenantId, actorType, actorId, action, objectType, objectId, ip, userAgent]);
}

// --- STAFF ENDPOINTS ---

/**
 * GET /sessions
 * List submissions for staff review
 */
router.get('/sessions', authenticate, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id, status, prefill_json, submitted_at, created_at, updated_at, patient_id
            FROM intake_sessions
            WHERE tenant_id = $1
            ORDER BY created_at DESC
        `, [req.clinic.id]);
        res.json(result.rows);
    } catch (error) {
        console.error('[Intake] List failed:', error);
        res.status(500).json({ error: 'Failed' });
    }
});

/**
 * GET /session/:id
 */
router.get('/session/:id', authenticate, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT * FROM intake_sessions
            WHERE id = $1 AND tenant_id = $2
        `, [req.params.id, req.clinic.id]);

        if (result.rows.length === 0) return res.status(404).json({ error: 'Session not found' });
        res.json(result.rows[0]);
    } catch (error) {
        console.error('[Intake] Get failed:', error);
        res.status(500).json({ error: 'Failed' });
    }
});

/**
 * DELETE /session/:id - Delete an intake session
 */
router.delete('/session/:id', authenticate, async (req, res) => {
    try {
        const result = await pool.query(`
            DELETE FROM intake_sessions
            WHERE id = $1 AND tenant_id = $2
            RETURNING id
        `, [req.params.id, req.clinic.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Session not found' });
        }

        await logIntakeAudit(pool, req.clinic.id, 'staff', req.user.id, 'delete_session', 'intake_sessions', req.params.id, req);
        res.json({ success: true });
    } catch (error) {
        console.error('[Intake] Delete failed:', error);
        res.status(500).json({ error: 'Failed to delete session' });
    }
});

/**
 * GET /public/clinic-info - Get clinic info for public intake form
 */
router.get('/public/clinic-info', async (req, res) => {
    try {
        if (!req.clinic?.id) {
            return res.status(400).json({ error: 'Clinic not specified' });
        }

        const result = await pool.query(`
            SELECT name, slug, logo_url, address, phone
            FROM tenants
            WHERE id = $1 AND is_active = true
        `, [req.clinic.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Clinic not found' });
        }

        const clinic = result.rows[0];
        res.json({
            name: clinic.name,
            slug: clinic.slug,
            logoUrl: clinic.logo_url,
            address: clinic.address,
            phone: clinic.phone
        });
    } catch (error) {
        console.error('[Intake] Clinic info failed:', error);
        res.status(500).json({ error: 'Failed to get clinic info' });
    }
});

/**
 * POST /session/:id/approve
 */
router.post('/session/:id/approve', authenticate, async (req, res) => {
    const patientEncryptionService = require('../services/patientEncryptionService');
    try {
        const { id } = req.params;
        const { linkToPatientId } = req.body;

        const subRes = await pool.query(`
            SELECT * FROM intake_sessions
            WHERE id = $1 AND tenant_id = $2
        `, [id, req.clinic.id]);

        if (subRes.rows.length === 0) return res.status(404).json({ error: 'Not found' });
        const session = subRes.rows[0];
        const data = session.data_json;

        if (session.status === 'APPROVED') {
            return res.status(400).json({ error: 'Already approved' });
        }

        let targetPatientId = linkToPatientId;

        if (!targetPatientId) {
            const finalMRN = data.mrn || String(Math.floor(100000 + Math.random() * 900000));
            const patientData = {
                mrn: finalMRN,
                first_name: data.firstName || session.prefill_json.firstName,
                last_name: data.lastName || session.prefill_json.lastName,
                dob: data.dob || session.prefill_json.dob,
                phone: data.phone || session.prefill_json.phone,
                email: data.email,
                address_line1: data.addressLine1,
                city: data.city,
                state: data.state,
                zip: data.zip,
                clinic_id: req.clinic.id,
                phone_normalized: (data.phone || session.prefill_json.phone || '').replace(/\D/g, '')
            };

            const encrypted = await patientEncryptionService.preparePatientForStorage(patientData);
            const fields = Object.keys(encrypted).filter(k => k !== 'encryption_metadata');
            const values = fields.map(f => encrypted[f]);
            fields.push('encryption_metadata');
            values.push(JSON.stringify(encrypted.encryption_metadata));

            const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
            const patientRes = await pool.query(
                `INSERT INTO patients (${fields.join(', ')}) VALUES (${placeholders}) RETURNING id`,
                values
            );
            targetPatientId = patientRes.rows[0].id;
        }

        await pool.query(`UPDATE intake_sessions SET status = 'APPROVED', patient_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`, [targetPatientId, id]);

        await pool.query(`
            UPDATE inbox_items SET 
                status = 'completed', 
                completed_at = CURRENT_TIMESTAMP, 
                completed_by = $1,
                patient_id = $2
            WHERE reference_id = $3 AND reference_table = 'intake_sessions'
        `, [req.user.id, targetPatientId, id]);

        await logIntakeAudit(pool, req.clinic.id, 'staff', req.user.id, 'approve', 'intake_sessions', id, req);

        res.json({ success: true, patientId: targetPatientId });
    } catch (error) {
        console.error('[Intake] Approval failed:', error);
        res.status(500).json({ error: 'System error' });
    }
});

/**
 * POST /session/:id/needs-edits
 */
router.post('/session/:id/needs-edits', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const { note } = req.body;

        if (!note) return res.status(400).json({ error: 'Note required' });

        const result = await pool.query(`
            UPDATE intake_sessions 
            SET status = 'NEEDS_EDITS', 
                review_notes = review_notes || $1::jsonb,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $2 AND tenant_id = $3
            RETURNING id
        `, [JSON.stringify([{ note, author: `${req.user.first_name} ${req.user.last_name}`, created_at: new Date() }]), id, req.clinic.id]);

        if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });

        await pool.query(`
            UPDATE inbox_items SET status = 'NeedsEdits', updated_at = CURRENT_TIMESTAMP
            WHERE reference_id = $1 AND reference_table = 'intake_sessions'
        `, [id]);

        await logIntakeAudit(pool, req.clinic.id, 'staff', req.user.id, 'needs_edits', 'intake_sessions', id, req);

        res.json({ success: true });
    } catch (error) {
        console.error('[Intake] Needs Edits failed:', error);
        res.status(500).json({ error: 'System error' });
    }
});

/**
 * GET /session/:id/duplicates
 */
router.get('/session/:id/duplicates', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const subRes = await pool.query('SELECT prefill_json FROM intake_sessions WHERE id = $1 AND tenant_id = $2', [id, req.clinic.id]);
        if (subRes.rows.length === 0) return res.status(404).json({ error: 'Not found' });

        const prefill = subRes.rows[0].prefill_json;
        const { firstName, lastName, dob, phone } = prefill;
        const phoneNorm = (phone || '').replace(/\D/g, '');

        // Use the patientEncryptionService to decrypt and search if needed, but for now 
        // we'll use the plaintext dob and phone_normalized which are already indexed.
        const dupRes = await pool.query(`
            SELECT id, first_name, last_name, dob, mrn 
            FROM patients 
            WHERE (
                (LOWER(first_name) LIKE LOWER($1) || '%' AND LOWER(last_name) LIKE LOWER($2) || '%' AND dob = $3)
                OR (phone_normalized = $4 AND phone_normalized <> '')
            )
            AND clinic_id = $5
            LIMIT 5
        `, [firstName, lastName, dob, phoneNorm, req.clinic.id]);

        const patientEncryptionService = require('../services/patientEncryptionService');
        const decrypted = await patientEncryptionService.decryptPatientsPHI(dupRes.rows);

        res.json(decrypted);
    } catch (error) {
        console.error('[Intake] Duplicate check failed:', error);
        res.status(500).json({ error: 'Failed' });
    }
});

// --- PUBLIC ENDPOINTS ---

/**
 * POST /public/start
 */
router.post('/public/start', async (req, res) => {
    try {
        const { firstName, lastName, dob, phone } = req.body;
        if (!firstName || !lastName || !dob || !phone) {
            return res.status(400).json({ error: 'Missing required start fields' });
        }

        const resumeCode = generateResumeCode();
        const resumeHash = hashToken(resumeCode);
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        const result = await pool.query(`
            INSERT INTO intake_sessions (
                tenant_id, resume_code_hash, expires_at, prefill_json, status
            ) VALUES ($1, $2, $3, $4, 'IN_PROGRESS')
            RETURNING id
        `, [req.clinic.id, resumeHash, expiresAt, { firstName, lastName, dob, phone }]);

        const sessionId = result.rows[0].id;
        await logIntakeAudit(pool, req.clinic.id, 'patient', null, 'start', 'intake_sessions', sessionId, req);

        res.json({
            sessionId,
            resumeCode, // Shwon ONLY ONCE
            expiresAt
        });
    } catch (error) {
        console.error('[Intake] Start failed:', error);
        res.status(500).json({ error: 'System error' });
    }
});

/**
 * POST /public/resume
 */
router.post('/public/resume', async (req, res) => {
    try {
        const { resumeCode, dob } = req.body;
        if (!resumeCode || !dob) return res.status(400).json({ error: 'Missing credentials' });

        const hash = hashToken(resumeCode);

        const result = await pool.query(`
            SELECT * FROM intake_sessions
            WHERE resume_code_hash = $1 AND expires_at > CURRENT_TIMESTAMP
            AND tenant_id = $2
        `, [hash, req.clinic.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Invalid or expired resume code' });
        }

        const session = result.rows[0];

        // DOB Verification (Security Step)
        if (session.prefill_json.dob !== dob) {
            // Simple rate limit could be added here
            return res.status(401).json({ error: 'Verification failed. Please check Date of Birth.' });
        }

        if (session.status === 'APPROVED') {
            return res.status(400).json({ error: 'This registration has already been approved. Please see front desk.' });
        }

        await logIntakeAudit(pool, req.clinic.id, 'patient', null, 'resume', 'intake_sessions', session.id, req);

        res.json({
            sessionId: session.id,
            status: session.status,
            prefill: session.prefill_json,
            data: session.data_json,
            reviewNotes: session.review_notes
        });
    } catch (error) {
        console.error('[Intake] Resume failed:', error);
        res.status(500).json({ error: 'System error' });
    }
});

/**
 * POST /public/save/:id
 */
router.post('/public/save/:id', async (req, res) => {
    try {
        const { data } = req.body;
        const result = await pool.query(`
            UPDATE intake_sessions
            SET data_json = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2 AND tenant_id = $3 AND status IN ('IN_PROGRESS', 'NEEDS_EDITS')
            RETURNING id
        `, [data, req.params.id, req.clinic.id]);

        if (result.rows.length === 0) return res.status(404).json({ error: 'Session not found or locked' });
        res.json({ success: true });
    } catch (error) {
        console.error('[Intake] Save failed:', error);
        res.status(500).json({ error: 'Failed' });
    }
});

/**
 * POST /public/submit/:id
 */
router.post('/public/submit/:id', async (req, res) => {
    try {
        const { data, signature } = req.body;

        const sessionRes = await pool.query(`
            SELECT prefill_json FROM intake_sessions WHERE id = $1 AND tenant_id = $2
        `, [req.params.id, req.clinic.id]);

        if (sessionRes.rows.length === 0) return res.status(404).json({ error: 'Not found' });
        const prefill = sessionRes.rows[0].prefill_json;

        await pool.query(`
            UPDATE intake_sessions
            SET data_json = $1, 
                signature_json = $2, 
                status = 'SUBMITTED',
                submitted_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $3 AND tenant_id = $4
        `, [data, signature, req.params.id, req.clinic.id]);

        // Create Inbox Item
        const patientName = `${prefill.firstName} ${prefill.lastName}`;
        await pool.query(`
            INSERT INTO inbox_items (
                tenant_id, type, subject, body, reference_id, reference_table, status, priority
            ) VALUES ($1, $2, $3, $4, $5, 'intake_sessions', 'new', 'normal')
        `, [
            req.clinic.id,
            'new_patient_registration',
            `Registration: ${patientName}`,
            `Universal QR registration submitted. DOB: ${prefill.dob}. Phone: ${prefill.phone}`,
            req.params.id
        ]);

        await logIntakeAudit(pool, req.clinic.id, 'patient', null, 'submit', 'intake_sessions', req.params.id, req);

        res.json({ success: true });
    } catch (error) {
        console.error('[Intake] Submit failed:', error);
        res.status(500).json({ error: 'Failed' });
    }
});

module.exports = router;
