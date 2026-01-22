const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticate, logAudit } = require('../middleware/auth');

router.use(authenticate);

// --- 2.1 Encounter Endpoints ---

// Create/Start Encounter
router.post('/encounters', async (req, res) => {
    try {
        const { appointment_id, provider_id, patient_id, start_time } = req.body;

        // Find if an encounter already exists for this appointment
        const existing = await pool.query(
            'SELECT * FROM visits WHERE appointment_id = $1',
            [appointment_id]
        );

        if (existing.rows.length > 0) {
            return res.json(existing.rows[0]);
        }

        // Create new visit (Encounter)
        const result = await pool.query(
            `INSERT INTO visits (
                appointment_id, provider_id, patient_id, visit_date, 
                encounter_date, status, note_type, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, 'draft', 'telehealth', NOW(), NOW())
            RETURNING *`,
            [appointment_id, provider_id, patient_id, start_time, start_time.split('T')[0]]
        );

        await logAudit(req.user.id, 'start_encounter', 'visit', result.rows[0].id, req.body, req.ip);
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
router.patch('/encounters/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { updated_at } = req.body;
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
router.patch('/encounters/:id/finalize', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            `UPDATE visits 
             SET status = 'signed', note_signed_at = NOW(), note_signed_by = $1, updated_at = NOW()
             WHERE id = $2 RETURNING *`,
            [req.user.id, id]
        );

        if (result.rows.length === 0) return res.status(404).json({ error: 'Encounter not found' });

        await logAudit(req.user.id, 'finalize_encounter', 'visit', id, {}, req.ip);
        res.json({ status: 'finalized', encounter: result.rows[0] });
    } catch (error) {
        console.error('Error finalizing encounter:', error);
        res.status(500).json({ error: 'Failed to finalize encounter' });
    }
});

// --- 2.2 Notes Endpoints ---

// Save Draft Note
router.post('/clinical_notes', async (req, res) => {
    try {
        const { encounter_id, note, dx } = req.body;

        const result = await pool.query(
            `UPDATE visits 
             SET structured_note = $1, dx = $2, updated_at = NOW()
             WHERE id = $3 RETURNING *`,
            [note, dx, encounter_id]
        );

        if (result.rows.length === 0) return res.status(404).json({ error: 'Encounter not found' });

        res.json({ success: true, visit_id: result.rows[0].id });
    } catch (error) {
        console.error('Error saving clinical note:', error);
        res.status(500).json({ error: 'Failed to save clinical note' });
    }
});

// Get Clinical Note
router.get('/clinical_notes', async (req, res) => {
    try {
        const { encounter_id } = req.query;
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
router.patch('/clinical_notes/:id/sign', async (req, res) => {
    try {
        const { id } = req.params;
        // In this system, signing the note is signing the visit
        const result = await pool.query(
            `UPDATE visits 
             SET status = 'signed', note_signed_at = NOW(), note_signed_by = $1, updated_at = NOW()
             WHERE id = $2 RETURNING *`,
            [req.user.id, id]
        );
        res.json({ signed_at: result.rows[0]?.note_signed_at });
    } catch (error) {
        console.error('Error signing note:', error);
        res.status(500).json({ error: 'Failed to sign note' });
    }
});

// --- 2.3 Orders Endpoints ---

// Create Order
router.post('/clinical_orders', async (req, res) => {
    try {
        const { encounter_id, type, text } = req.body;

        // Fetch patient_id from visit
        const visit = await pool.query('SELECT patient_id FROM visits WHERE id = $1', [encounter_id]);
        if (visit.rows.length === 0) return res.status(404).json({ error: 'Encounter not found' });

        const patient_id = visit.rows[0].patient_id;

        const result = await pool.query(
            `INSERT INTO orders (
                patient_id, visit_id, order_type, status, ordered_by, order_payload, created_at, updated_at
            ) VALUES ($1, $2, $3, 'pending', $4, $5, NOW(), NOW())
            RETURNING *`,
            [patient_id, encounter_id, type, req.user.id, { text }]
        );

        res.status(201).json({
            ...result.rows[0],
            text: result.rows[0].order_payload?.text || ''
        });
    } catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({ error: 'Failed to create order' });
    }
});

// Sign Order
router.patch('/clinical_orders/:id/sign', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            `UPDATE orders 
             SET status = 'sent', completed_at = NOW(), updated_at = NOW()
             WHERE id = $1 RETURNING *`,
            [id]
        );
        res.json({ signed_at: result.rows[0]?.completed_at });
    } catch (error) {
        console.error('Error signing order:', error);
        res.status(500).json({ error: 'Failed to sign order' });
    }
});

// --- 2.4 AVS Endpoints ---

// Save AVS
router.post('/after_visit_summaries', async (req, res) => {
    try {
        const { encounter_id, instructions, follow_up, return_precautions } = req.body;

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

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error saving AVS:', error);
        res.status(500).json({ error: 'Failed to save AVS' });
    }
});

// Send AVS to Patient Portal
router.post('/after_visit_summaries/:id/send', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            `UPDATE after_visit_summaries 
             SET sent_at = NOW(), updated_at = NOW()
             WHERE id = $1 RETURNING *`,
            [id]
        );
        res.json({ sent_at: result.rows[0]?.sent_at });
    } catch (error) {
        console.error('Error sending AVS:', error);
        res.status(500).json({ error: 'Failed to send AVS' });
    }
});

module.exports = router;
