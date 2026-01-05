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

function normalizePhone(phone) {
    if (!phone) return '';
    return phone.replace(/\D/g, '');
}

function normalizeName(name) {
    if (!name) return '';
    return name.trim().toLowerCase();
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
 * GET /stats
 */
router.get('/stats', authenticate, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT COUNT(*) as count
            FROM intake_sessions
            WHERE tenant_id = $1 AND status = 'SUBMITTED'
        `, [req.clinic.id]);
        res.json({ pendingCount: parseInt(result.rows[0].count) });
    } catch (error) {
        console.error('[Intake] Stats failed:', error);
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
 * POST /session/:id/regenerate-code - Generate a new resume code for a patient
 */
router.post('/session/:id/regenerate-code', authenticate, async (req, res) => {
    try {
        const { id } = req.params;

        const checkRes = await pool.query(`
            SELECT id, status FROM intake_sessions
            WHERE id = $1 AND tenant_id = $2
        `, [id, req.clinic.id]);

        if (checkRes.rows.length === 0) {
            return res.status(404).json({ error: 'Session not found' });
        }

        const session = checkRes.rows[0];
        if (session.status === 'APPROVED' || session.status === 'SUBMITTED') {
            return res.status(400).json({ error: 'Cannot regenerate code for completed sessions' });
        }

        const newResumeCode = generateResumeCode();
        const newHash = hashToken(newResumeCode);
        const newExpiry = new Date();
        newExpiry.setDate(newExpiry.getDate() + 7);

        await pool.query(`
            UPDATE intake_sessions
            SET resume_code_hash = $1, expires_at = $2, updated_at = CURRENT_TIMESTAMP
            WHERE id = $3
        `, [newHash, newExpiry, id]);

        await logIntakeAudit(pool, req.clinic.id, 'staff', req.user.id, 'regenerate_code', 'intake_sessions', id, req);

        res.json({
            success: true,
            resumeCode: newResumeCode,
            expiresAt: newExpiry
        });
    } catch (error) {
        console.error('[Intake] Regenerate code failed:', error);
        res.status(500).json({ error: 'Failed to regenerate code' });
    }
});

/**
 * POST /clear-rate-limits - Clear all lookup rate limits (Staff only)
 */
router.post('/clear-rate-limits', authenticate, async (req, res) => {
    try {
        lookupRateLimit.clear();
        await logIntakeAudit(pool, req.clinic.id, 'staff', req.user.id, 'clear_rate_limits', 'system', null, req);
        res.json({ success: true, message: 'Intake lookup rate limits cleared' });
    } catch (e) {
        res.status(500).json({ error: 'Failed to clear rate limits' });
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

        // Use the clinic object already populated by tenant middleware
        res.json({
            name: req.clinic.name || 'Medical Practice',
            slug: req.clinic.slug,
            logoUrl: req.clinic.logo_url || null,
            address: req.clinic.address || null,
            phone: req.clinic.phone || null
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

        if (subRes.rows.length === 0) return res.status(404).json({ error: 'Session not found' });
        const session = subRes.rows[0];

        if (session.status === 'APPROVED') {
            return res.status(400).json({ error: 'Already approved and locked.' });
        }
        const data = session.data_json;

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

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        const phoneNorm = normalizePhone(phone);
        const phoneLast4 = phoneNorm.slice(-4);
        const lastNameNorm = normalizeName(lastName);

        // Resume code is deprecated/removed in new flow, but column exists. Store empty/placeholder.
        const result = await pool.query(`
            INSERT INTO intake_sessions (
                tenant_id, resume_code_hash, expires_at, prefill_json, status,
                patient_first_name, patient_last_name, patient_last_name_normalized,
                patient_dob, patient_phone_normalized, patient_phone_last4
            ) VALUES ($1, $2, $3, $4, 'IN_PROGRESS', $5, $6, $7, $8, $9, $10)
            RETURNING id
        `, [
            req.clinic.id,
            '', // resume_code_hash
            expiresAt,
            { firstName, lastName, dob, phone },
            firstName,
            lastName,
            lastNameNorm,
            dob,
            phoneNorm,
            phoneLast4
        ]);

        const sessionId = result.rows[0].id;
        await logIntakeAudit(pool, req.clinic.id, 'patient', null, 'start', 'intake_sessions', sessionId, req);

        res.json({
            sessionId,
            expiresAt
        });
    } catch (error) {
        console.error('[Intake] Start failed:', error);
        res.status(500).json({ error: 'System error' });
    }
});

// Rate limiting for "Continue" lookups (simple in-memory instance-bound)
const lookupRateLimit = new Map();
function checkRateLimit(key) {
    const now = Date.now();
    const windowMs = 10 * 60 * 1000; // 10 minutes
    const max = 5;

    const data = lookupRateLimit.get(key) || { count: 0, resetAt: now + windowMs };
    if (now > data.resetAt) {
        data.count = 1;
        data.resetAt = now + windowMs;
    } else {
        data.count++;
    }
    lookupRateLimit.set(key, data);
    return data.count <= max;
}

/**
 * POST /public/continue
 * Search for existing sessions by details
 */
router.post('/public/continue', async (req, res) => {
    try {
        const { lastName, dob, phone } = req.body;
        if (!lastName || !dob || !phone) {
            return res.status(400).json({ error: 'Missing lookup details' });
        }

        const ip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        if (!checkRateLimit(ip)) {
            return res.status(429).json({ error: 'Too many attempts. Please try again in 10 minutes.' });
        }

        const lastNameNorm = normalizeName(lastName);
        const phoneNorm = normalizePhone(phone);

        if (!checkRateLimit(`${lastNameNorm}:${dob}`)) {
            return res.status(429).json({ error: 'Too many attempts for this name/DOB combo.' });
        }

        const result = await pool.query(`
            SELECT id, patient_first_name, patient_last_name, patient_dob, patient_phone_normalized, status
            FROM intake_sessions
            WHERE tenant_id = $1
              AND patient_last_name_normalized = $2
              AND patient_dob = $3
              AND (patient_phone_normalized = $4 OR patient_phone_last4 = $5)
              AND status IN ('IN_PROGRESS', 'NEEDS_EDITS', 'SUBMITTED')
              AND expires_at > CURRENT_TIMESTAMP
            ORDER BY created_at DESC
        `, [req.clinic.id, lastNameNorm, dob, phoneNorm, phoneNorm.slice(-4)]);

        // Audit log the attempt
        await logIntakeAudit(pool, req.clinic.id, 'patient', null, 'continue_lookup', 'intake_sessions', null, req);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'No active or submitted registration found matching these details.' });
        }

        if (result.rows.length === 1) {
            const session = result.rows[0];
            // Fetch full prefill/data for the single match
            const fullRes = await pool.query('SELECT prefill_json, data_json, status, review_notes FROM intake_sessions WHERE id = $1', [session.id]);
            const full = fullRes.rows[0];

            return res.json({
                sessionId: session.id,
                prefill: full.prefill_json,
                data: full.data_json,
                status: full.status,
                reviewNotes: full.review_notes
            });
        }

        // Multiple matches: return masked candidates
        const candidates = result.rows.map(r => ({
            id: r.id,
            firstNameInitial: r.patient_first_name ? r.patient_first_name[0] : '?',
            lastName: r.patient_last_name,
            dob: r.patient_dob,
            maskedPhone: '***-***-' + (r.patient_phone_normalized || '').slice(-4)
        }));

        res.json({ candidates });
    } catch (error) {
        console.error('[Intake] Continue failed:', error);
        res.status(500).json({ error: 'System error' });
    }
});

/**
 * POST /public/session/:id
 * Fetch session details but requires patient verification details (Last Name, DOB, Phone)
 */
router.post('/public/session/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { lastName, dob, phone } = req.body;

        if (!lastName || !dob || !phone) {
            return res.status(400).json({ error: 'Missing verification details' });
        }

        const lastNameNorm = normalizeName(lastName);
        const phoneNorm = normalizePhone(phone);

        const result = await pool.query(`
            SELECT prefill_json, data_json, status, review_notes,
                   patient_last_name_normalized, patient_dob, patient_phone_normalized, patient_phone_last4
            FROM intake_sessions
            WHERE id = $1 AND tenant_id = $2
              AND expires_at > CURRENT_TIMESTAMP
        `, [id, req.clinic.id]);

        if (result.rows.length === 0) return res.status(404).json({ error: 'Session not found or expired' });
        const s = result.rows[0];

        // Verify details match
        const dbDob = s.patient_dob instanceof Date ? s.patient_dob.toISOString().split('T')[0] : String(s.patient_dob).split('T')[0];

        if (s.patient_last_name_normalized !== lastNameNorm ||
            dbDob !== dob ||
            (s.patient_phone_normalized !== phoneNorm && s.patient_phone_last4 !== phoneNorm)) {
            return res.status(401).json({ error: 'Verification failed' });
        }

        res.json({
            id,
            prefill_json: s.prefill_json,
            data_json: s.data_json,
            status: s.status,
            review_notes: s.review_notes
        });
    } catch (error) {
        console.error('[Intake] Public get session failed:', error);
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

        const result = await pool.query(`
            UPDATE intake_sessions
            SET data_json = $1, 
                signature_json = $2, 
                status = 'SUBMITTED',
                submitted_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $3 AND tenant_id = $4 AND status IN ('IN_PROGRESS', 'NEEDS_EDITS', 'SUBMITTED')
        `, [data, signature, req.params.id, req.clinic.id]);

        if (result.rowCount === 0) return res.status(400).json({ error: 'Session locked or not found' });

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
