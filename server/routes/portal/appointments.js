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

        const { preferredDate, preferredTimeRange, appointmentType, reason, providerId } = req.body;
        const patientId = req.portalAccount.patient_id;
        const portalAccountId = req.portalAccount.id;

        const result = await pool.query(`
            INSERT INTO portal_appointment_requests (
                patient_id, portal_account_id, preferred_date, preferred_time_range, appointment_type, reason, provider_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `, [patientId, portalAccountId, preferredDate, preferredTimeRange, appointmentType, reason, providerId]);

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

/**
 * Get available slots for a provider on a specific date
 * GET /api/portal/appointments/availability?date=...&providerId=...
 */
router.get('/availability', async (req, res) => {
    try {
        const { date, providerId } = req.query;
        if (!date || !providerId) {
            return res.status(400).json({ error: 'Date and providerId are required' });
        }

        // 1. Get existing appointments for this provider and date
        const appointments = await pool.query(
            "SELECT appointment_time FROM appointments WHERE provider_id = $1 AND appointment_date = $2 AND status NOT IN ('cancelled', 'no-show')",
            [providerId, date]
        );

        // 2. Define business hours and slot duration (e.g. 9:00 - 17:00, 30 min slots)
        const slots = [];
        const startHour = 9; // 9 AM
        const endHour = 17;   // 5 PM
        const interval = 30; // minutes

        for (let hour = startHour; hour < endHour; hour++) {
            for (let min = 0; min < 60; min += interval) {
                const time = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}:00`;
                // Check if any existing appointment overlaps this slot
                // For simplicity, we just check exact matches for now
                const isBusy = appointments.rows.some(a => {
                    const apptTime = a.appointment_time.substring(0, 5); // HH:mm
                    const slotTime = time.substring(0, 5);
                    return apptTime === slotTime;
                });

                slots.push({
                    time: time.substring(0, 5),
                    available: !isBusy
                });
            }
        }

        res.json(slots);
    } catch (error) {
        console.error('[Portal Appointments] Error fetching availability:', error);
        res.status(500).json({ error: 'Failed to fetch availability' });
    }
});

module.exports = router;
