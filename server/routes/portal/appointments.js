const express = require('express');
const pool = require('../../db');
const { authenticatePortal, requirePortalPermission } = require('../../middleware/portalAuth');
const { body, validationResult } = require('express-validator');

const router = express.Router();

router.use(authenticatePortal);

/**
 * Get patient's appointments (Scheduled/Completed)
 * GET /api/portal/appointments
 */
router.get('/', async (req, res) => {
    try {
        const patientId = req.portalAccount.patient_id;

        const result = await pool.query(`
            SELECT a.*, 
                u.first_name as provider_first_name, u.last_name as provider_last_name
            FROM appointments a
            JOIN users u ON a.provider_id = u.id
            WHERE a.patient_id = $1
            ORDER BY a.appointment_date DESC, a.appointment_time DESC
        `, [patientId]);

        res.json(result.rows);
    } catch (error) {
        console.error('[Portal Appointments] Error fetching appointments:', error);
        res.status(500).json({ error: 'Failed to fetch appointments' });
    }
});

/**
 * Get appointment requests
 * GET /api/portal/appointments/requests
 */
router.get('/requests', async (req, res) => {
    try {
        const portalAccountId = req.portalAccount.id;

        const result = await pool.query(`
            SELECT * FROM portal_appointment_requests
            WHERE portal_account_id = $1
            ORDER BY created_at DESC
        `, [portalAccountId]);

        res.json(result.rows);
    } catch (error) {
        console.error('[Portal Appointments] Error fetching requests:', error);
        res.status(500).json({ error: 'Failed to fetch appointment requests' });
    }
});

/**
 * Submit a new appointment request
 * POST /api/portal/appointments/requests
 */
router.post('/requests', requirePortalPermission('can_request_appointments'), [
    body('preferredDate').isISO8601(),
    body('preferredTimeRange').notEmpty(),
    body('appointmentType').notEmpty(),
    body('reason').optional().trim()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { preferredDate, preferredTimeRange, appointmentType, reason } = req.body;
        const patientId = req.portalAccount.patient_id;
        const portalAccountId = req.portalAccount.id;

        const result = await pool.query(`
            INSERT INTO portal_appointment_requests (
                patient_id, portal_account_id, preferred_date, preferred_time_range, appointment_type, reason
            ) VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `, [patientId, portalAccountId, preferredDate, preferredTimeRange, appointmentType, reason]);

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('[Portal Appointments] Error creating request:', error);
        res.status(500).json({ error: 'Failed to submit appointment request' });
    }
});

/**
 * Cancel a pending request
 * DELETE /api/portal/appointments/requests/:id
 */
router.delete('/requests/:id', requirePortalPermission('can_request_appointments'), async (req, res) => {
    try {
        const { id } = req.params;
        const portalAccountId = req.portalAccount.id;

        const result = await pool.query(
            'UPDATE portal_appointment_requests SET status = $1 WHERE id = $2 AND portal_account_id = $3 AND status = $4 RETURNING *',
            ['cancelled', id, portalAccountId, 'pending']
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Request not found or cannot be cancelled' });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('[Portal Appointments] Error cancelling request:', error);
        res.status(500).json({ error: 'Failed to cancel appointment request' });
    }
});

module.exports = router;
