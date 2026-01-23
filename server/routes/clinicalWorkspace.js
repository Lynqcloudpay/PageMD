const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticate, logAudit, requireRole } = require('../middleware/auth');

router.use(authenticate);

// Helper to check if a visit is signed/locked
async function checkVisitUnlocked(id) {
    const res = await pool.query('SELECT status, note_signed_at FROM visits WHERE id = $1', [id]);
    if (res.rows.length === 0) throw new Error('Visit not found');
    if (res.rows[0].status === 'signed' || res.rows[0].note_signed_at) {
        throw new Error('Action rejected: Encounter is finalized and locked.');
    }
    return res.rows[0];
}

// --- 2.1 Encounter Endpoints ---

// Create/Start Encounter (Idempotent)
router.post('/encounters', requireRole('clinician', 'admin'), async (req, res) => {
    try {
        const { appointment_id, provider_id, patient_id, start_time } = req.body;

        if (!appointment_id || !patient_id) {
            return res.status(400).json({ error: 'appointment_id and patient_id are required' });
        }

        // Ensure atomic check and insert (idempotency)
        const existing = await pool.query(
            'SELECT * FROM visits WHERE appointment_id = $1',
            [appointment_id]
        );

        if (existing.rows.length > 0) {
            return res.json(existing.rows[0]);
        }

        const result = await pool.query(
            `INSERT INTO visits (
                appointment_id, provider_id, patient_id, visit_date, 
                encounter_date, status, note_type, clinic_id, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, 'draft', 'telehealth', $6, NOW(), NOW())
            RETURNING *`,
            [
                appointment_id,
                provider_id || req.user.id,
                patient_id,
                start_time,
                (start_time || new Date().toISOString()).split('T')[0],
                req.user.clinic_id
            ]
        );

        await logAudit(req.user.id, 'encounter.started', 'visit', result.rows[0].id, { appointment_id }, req.ip);
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error starting encounter:', error);
        res.status(500).json({ error: 'Failed to start encounter' });
    }
});

// Get Encounter by Appointment
router.get('/encounters', async (req, res) => {
    try {
        const { appointment_id } = req.query;
        if (!appointment_id) return res.status(400).json({ error: 'appointment_id required' });

        const result = await pool.query(
            'SELECT * FROM visits WHERE appointment_id = $1',
            [appointment_id]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching encounters:', error);
        res.status(500).json({ error: 'Failed to fetch encounters' });
    }
});

// Update Encounter (Heartbeat/General)
router.patch('/encounters/:id', requireRole('clinician', 'admin'), async (req, res) => {
    try {
        const { id } = req.params;
        const { updated_at } = req.body;

        const visit = await pool.query('SELECT status FROM visits WHERE id = $1', [id]);
        if (visit.rows.length === 0) return res.status(404).json({ error: 'Encounter not found' });

        if (visit.rows[0].status === 'signed') {
            return res.status(403).json({ error: 'Cannot update finalized encounter' });
        }

        const result = await pool.query(
            'UPDATE visits SET updated_at = $1 WHERE id = $2 RETURNING *',
            [updated_at || new Date(), id]
        );
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating encounter:', error);
        res.status(500).json({ error: 'Failed to update encounter' });
    }
});

// Finalize Encounter
router.patch('/encounters/:id/finalize', requireRole('clinician', 'admin'), async (req, res) => {
    try {
        const { id } = req.params;

        const visit = await pool.query('SELECT status FROM visits WHERE id = $1', [id]);
        if (visit.rows.length === 0) return res.status(404).json({ error: 'Encounter not found' });

        // Idempotency: If already signed, just return success
        if (visit.rows[0].status === 'signed') {
            return res.json({ status: 'finalized', encounter: visit.rows[0], already_finalized: true });
        }

        const result = await pool.query(
            `UPDATE visits 
             SET status = 'signed', note_signed_at = NOW(), note_signed_by = $1, updated_at = NOW()
             WHERE id = $2 RETURNING *`,
            [req.user.id, id]
        );

        await logAudit(req.user.id, 'encounter.finalized', 'visit', id, {}, req.ip);
        res.json({ status: 'finalized', encounter: result.rows[0] });
    } catch (error) {
        console.error('Error finalizing encounter:', error);
        res.status(500).json({ error: 'Failed to finalize encounter' });
    }
});

// --- 2.2 Notes Endpoints ---

// Save Draft Note
router.post('/clinical_notes', requireRole('clinician', 'admin'), async (req, res) => {
    try {
        const { encounter_id, note, dx } = req.body;
        if (!encounter_id) return res.status(400).json({ error: 'encounter_id required' });

        await checkVisitUnlocked(encounter_id);

        const result = await pool.query(
            `UPDATE visits 
             SET structured_note = $1, dx = $2, updated_at = NOW()
             WHERE id = $3 RETURNING *`,
            [note, dx, encounter_id]
        );

        await logAudit(req.user.id, 'note.saved', 'visit', encounter_id, { sections: Object.keys(note || {}) }, req.ip);
        res.json({ success: true, visit_id: result.rows[0].id });
    } catch (error) {
        const status = error.message.includes('locked') ? 403 : 500;
        res.status(status).json({ error: error.message });
    }
});

// Get Clinical Note
router.get('/clinical_notes', async (req, res) => {
    try {
        const { encounter_id } = req.query;
        if (!encounter_id) return res.status(400).json({ error: 'encounter_id required' });

        const result = await pool.query(
            'SELECT id, structured_note as note, dx FROM visits WHERE id = $1',
            [encounter_id]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching clinical note:', error);
        res.status(500).json({ error: 'Failed to fetch clinical note' });
    }
});

// Sign/Finalize Note (Alias for encounter finalize)
router.patch('/clinical_notes/:id/sign', requireRole('clinician', 'admin'), async (req, res) => {
    try {
        const { id } = req.params;
        const { note_draft } = req.body; // Optional: update note content at same time

        const visit = await pool.query('SELECT status, patient_id FROM visits WHERE id = $1', [id]);
        if (visit.rows.length === 0) return res.status(404).json({ error: 'Encounter not found' });

        // Idempotency
        if (visit.rows[0].status === 'signed') {
            return res.json({ success: true, already_signed: true });
        }

        // ============================================================
        // CAPTURE CLINICAL SNAPSHOT (Parity with visits.js /:id/sign)
        // ============================================================
        const patientId = visit.rows[0].patient_id;
        const patientEncryptionService = require('../services/patientEncryptionService');

        const [
            patientRes,
            allergiesRes,
            medicationsRes,
            problemsRes,
            familyHistoryRes,
            socialHistoryRes,
            visitDocumentsRes
        ] = await Promise.all([
            pool.query('SELECT * FROM patients WHERE id = $1', [patientId]),
            pool.query('SELECT * FROM allergies WHERE patient_id = $1 AND active = true', [patientId]),
            pool.query('SELECT * FROM medications WHERE patient_id = $1 AND active = true', [patientId]),
            pool.query('SELECT * FROM problems WHERE patient_id = $1 AND status = $2', [patientId, 'active']),
            pool.query('SELECT * FROM family_history WHERE patient_id = $1', [patientId]),
            pool.query('SELECT * FROM social_history WHERE patient_id = $1 LIMIT 1', [patientId]),
            pool.query('SELECT id, filename, doc_type, tags FROM documents WHERE visit_id = $1', [id])
        ]);

        let patientData = patientRes.rows[0] || {};
        try { patientData = await patientEncryptionService.decryptPatientPHI(patientData); } catch (e) { }

        const snapshot = {
            captured_at: new Date().toISOString(),
            captured_by: req.user.id,
            demographics: {
                first_name: patientData.first_name,
                last_name: patientData.last_name,
                dob: patientData.dob,
                sex: patientData.sex,
                mrn: patientData.mrn,
                insurance_provider: patientData.insurance_provider
            },
            allergies: allergiesRes.rows.map(a => ({ allergen: a.allergen, reaction: a.reaction, severity: a.severity })),
            medications: medicationsRes.rows.map(m => ({ medication_name: m.medication_name, dosage: m.dosage, frequency: m.frequency })),
            problems: problemsRes.rows.map(p => ({ problem_name: p.problem_name, icd_code: p.icd_code })),
            family_history: familyHistoryRes.rows.map(f => ({ condition: f.condition, relationship: f.relationship })),
            social_history: socialHistoryRes.rows[0] || null,
            documents: visitDocumentsRes.rows
        };

        const result = await pool.query(
            `UPDATE visits 
             SET status = 'signed', 
                 note_signed_at = NOW(), 
                 note_signed_by = $1, 
                 clinical_snapshot = $2,
                 ${note_draft ? 'note_draft = $3,' : ''}
                 updated_at = NOW()
             WHERE id = ${note_draft ? '$4' : '$3'} RETURNING *`,
            note_draft ? [req.user.id, JSON.stringify(snapshot), note_draft, id] : [req.user.id, JSON.stringify(snapshot), id]
        ).catch(async (dbError) => {
            // Handle UUID format issues or other DB errors with retry/fallback logic similar to visits.js
            if (dbError.code === '22P02') {
                return pool.query(
                    `UPDATE visits 
                     SET status = 'signed', 
                         note_signed_at = NOW(), 
                         note_signed_by = $1, 
                         clinical_snapshot = $2,
                         ${note_draft ? 'note_draft = $3,' : ''}
                         updated_at = NOW()
                     WHERE id::text = ${note_draft ? '$4' : '$3'} RETURNING *`,
                    note_draft ? [req.user.id, JSON.stringify(snapshot), note_draft, id] : [req.user.id, JSON.stringify(snapshot), id]
                );
            }
            throw dbError;
        });

        await logAudit(req.user.id, 'note.signed', 'visit', id, { snapshot: true }, req.ip);
        res.json({
            success: true,
            signed_at: result.rows[0]?.note_signed_at,
            visit_id: result.rows[0]?.id
        });
    } catch (error) {
        console.error('Error signing record:', error);
        res.status(500).json({
            error: 'Failed to sign note',
            details: error.message,
            code: error.code
        });
    }
});

// --- 2.3 Orders Endpoints ---
// Sign All Orders for Encounter
router.patch('/encounters/:id/sign-orders', requireRole('clinician', 'admin'), async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            `UPDATE orders 
             SET status = 'sent', completed_at = NOW(), updated_at = NOW() 
             WHERE visit_id = $1 AND status = 'pending'
             RETURNING id`,
            [id]
        );

        await logAudit(req.user.id, 'orders.signed_all', 'visit', id, { count: result.rowCount }, req.ip);
        res.json({ signed_count: result.rowCount, signed_ids: result.rows.map(r => r.id) });
    } catch (error) {
        console.error('Error signing all orders:', error);
        res.status(500).json({ error: 'Failed to sign encounter orders' });
    }
});

// Create Order
router.post('/clinical_orders', requireRole('clinician', 'admin'), async (req, res) => {
    try {
        const { encounter_id, type, text } = req.body;
        if (!encounter_id || !text) return res.status(400).json({ error: 'Missing encounter_id or text' });

        const visitRes = await pool.query('SELECT patient_id, status FROM visits WHERE id = $1', [encounter_id]);
        if (visitRes.rows.length === 0) return res.status(404).json({ error: 'Encounter not found' });
        if (visitRes.rows[0].status === 'signed') return res.status(403).json({ error: 'Cannot add orders to finalized visit' });

        const patient_id = visitRes.rows[0].patient_id;

        const result = await pool.query(
            `INSERT INTO orders (
                patient_id, visit_id, order_type, status, ordered_by, order_payload, created_at, updated_at
            ) VALUES ($1, $2, $3, 'pending', $4, $5, NOW(), NOW())
            RETURNING *`,
            [patient_id, encounter_id, type, req.user.id, { text }]
        );

        await logAudit(req.user.id, 'order.created', 'order', result.rows[0].id, { type }, req.ip);
        res.status(201).json({ ...result.rows[0], text: result.rows[0].order_payload?.text || '' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create order' });
    }
});

// Sign Order
router.patch('/clinical_orders/:id/sign', requireRole('clinician', 'admin'), async (req, res) => {
    try {
        const { id } = req.params;
        const current = await pool.query('SELECT status FROM orders WHERE id = $1', [id]);
        if (current.rows.length === 0) return res.status(404).json({ error: 'Order not found' });
        if (current.rows[0].status !== 'pending') return res.status(400).json({ error: 'Order already processed' });

        const result = await pool.query(
            `UPDATE orders SET status = 'sent', completed_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING *`,
            [id]
        );
        await logAudit(req.user.id, 'order.signed', 'order', id, {}, req.ip);
        res.json({ signed_at: result.rows[0]?.completed_at });
    } catch (error) {
        res.status(500).json({ error: 'Failed to sign order' });
    }
});

// --- 2.4 AVS Endpoints ---

// Save AVS
router.post('/after_visit_summaries', requireRole('clinician', 'admin'), async (req, res) => {
    try {
        const { encounter_id, instructions, follow_up, return_precautions } = req.body;
        if (!encounter_id) return res.status(400).json({ error: 'encounter_id required' });

        const visit = await pool.query('SELECT status FROM visits WHERE id = $1', [encounter_id]);
        if (visit.rows.length === 0) return res.status(404).json({ error: 'Encounter not found' });
        if (visit.rows[0].status === 'signed') return res.status(403).json({ error: 'Cannot modify AVS of finalized visit' });

        const result = await pool.query(
            `INSERT INTO after_visit_summaries (
                encounter_id, instructions, follow_up, return_precautions, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, NOW(), NOW())
            ON CONFLICT (encounter_id) DO UPDATE SET 
                instructions = EXCLUDED.instructions,
                follow_up = EXCLUDED.follow_up,
                return_precautions = EXCLUDED.return_precautions,
                updated_at = NOW()
            RETURNING *`,
            [encounter_id, instructions, follow_up, return_precautions]
        );
        await logAudit(req.user.id, 'avs.saved', 'avs', result.rows[0].id, { encounter_id }, req.ip);
        res.status(201).json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: 'Failed to save AVS' });
    }
});

// Send AVS to Patient Portal
router.post('/after_visit_summaries/:id/send', requireRole('clinician', 'admin'), async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            `UPDATE after_visit_summaries SET sent_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING *`,
            [id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'AVS not found' });
        await logAudit(req.user.id, 'avs.transmitted', 'avs', id, { method: 'portal' }, req.ip);
        res.json({ sent_at: result.rows[0]?.sent_at });
    } catch (error) {
        res.status(500).json({ error: 'Failed to send AVS' });
    }
});

module.exports = router;
