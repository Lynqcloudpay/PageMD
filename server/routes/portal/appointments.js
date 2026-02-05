const express = require('express');
const pool = require('../../db');
const { authenticatePortal, requirePortalPermission } = require('../../middleware/portalAuth');
const { body, validationResult } = require('express-validator');
const { syncInboxItems } = require('../inbasket');

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

        const { preferredDate, preferredTimeRange, appointmentType, reason, providerId, visitMethod } = req.body;
        const patientId = req.portalAccount.patient_id;
        const portalAccountId = req.portalAccount.id;

        const result = await pool.query(`
            INSERT INTO portal_appointment_requests (
                patient_id, portal_account_id, preferred_date, preferred_time_range, appointment_type, reason, provider_id, visit_method
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `, [patientId, portalAccountId, preferredDate, preferredTimeRange, appointmentType, reason, providerId, visitMethod || 'office']);

        // Trigger inbasket sync so staff sees it immediately
        try {
            await syncInboxItems(req.clinic?.id, req.clinic?.schema_name);
        } catch (syncError) {
            console.error('[Portal Appointments] Sync error (non-blocking):', syncError);
        }

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

        // Check current status to decide next status
        const checkStatus = await pool.query(
            "SELECT status FROM portal_appointment_requests WHERE id = $1 AND portal_account_id = $2",
            [id, portalAccountId]
        );

        if (checkStatus.rows.length === 0) {
            return res.status(404).json({ error: 'Request not found' });
        }

        const currentStatus = checkStatus.rows[0].status;
        // If they had suggestions and declined them all, mark as 'declined'
        // so staff can follow up. Otherwise just mark as 'cancelled'.
        const nextStatus = currentStatus === 'pending_patient' ? 'declined' : 'cancelled';

        const result = await pool.query(
            "UPDATE portal_appointment_requests SET status = $1, processed_at = CURRENT_TIMESTAMP WHERE id = $2 AND portal_account_id = $3 RETURNING *",
            [nextStatus, id, portalAccountId]
        );

        // Trigger inbasket sync so staff sees it immediately
        try {
            await syncInboxItems(req.clinic?.id, req.clinic?.schema_name);
        } catch (syncError) {
            console.error('[Portal Appointments] Sync error (non-blocking):', syncError);
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

/**
 * Accept a suggested slot and auto-schedule
 * POST /api/portal/appointments/requests/:id/accept-slot
 */
router.post('/requests/:id/accept-slot', requirePortalPermission('can_request_appointments'), async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const { date, time } = req.body;
        const portalAccountId = req.portalAccount.id;
        const patientId = req.portalAccount.patient_id;

        if (!date || !time) {
            return res.status(400).json({ error: 'Date and time are required' });
        }

        await client.query('BEGIN');

        // Get the request and verify ownership
        const requestRes = await client.query(
            'SELECT * FROM portal_appointment_requests WHERE id = $1 AND portal_account_id = $2',
            [id, portalAccountId]
        );

        if (requestRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Request not found' });
        }

        const request = requestRes.rows[0];

        // Get provider (from request or patient's PCP)
        let providerId = request.provider_id;
        if (!providerId) {
            const patientRes = await client.query('SELECT primary_care_provider FROM patients WHERE id = $1', [patientId]);
            providerId = patientRes.rows[0]?.primary_care_provider;
        }

        if (!providerId) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'No provider assigned' });
        }

        // Create the appointment
        await client.query(`
            INSERT INTO appointments (patient_id, provider_id, appointment_date, appointment_time, duration, appointment_type, status, notes, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, 'scheduled', $7, $2)
        `, [patientId, providerId, date, time, 30, request.appointment_type || 'Follow-up', 'Accepted from portal suggestions']);

        // Update request status
        await client.query(`
            UPDATE portal_appointment_requests 
            SET status = 'approved', processed_at = CURRENT_TIMESTAMP, suggested_slots = NULL 
            WHERE id = $1
        `, [id]);

        // Mark related inbox items as completed
        await client.query(`
            UPDATE inbox_items 
            SET status = 'completed', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
            WHERE reference_id = $1 AND reference_table = 'portal_appointment_requests'
        `, [id]);

        await client.query('COMMIT');
        res.json({ success: true, message: 'Appointment scheduled!' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[Portal Appointments] Error accepting slot:', error);
        res.status(500).json({ error: 'Failed to accept slot' });
    } finally {
        client.release();
    }
});

/**
 * Clear/delete a cancelled or denied request
 * DELETE /api/portal/appointments/requests/:id/clear
 */
router.delete('/requests/:id/clear', requirePortalPermission('can_request_appointments'), async (req, res) => {
    try {
        const { id } = req.params;
        const portalAccountId = req.portalAccount.id;

        const result = await pool.query(
            "DELETE FROM portal_appointment_requests WHERE id = $1 AND portal_account_id = $2 AND status IN ('cancelled', 'denied') RETURNING *",
            [id, portalAccountId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Request not found or cannot be deleted' });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('[Portal Appointments] Error clearing request:', error);
        res.status(500).json({ error: 'Failed to clear request' });
    }
});

/**
 * Cancel a scheduled appointment
 * POST /api/portal/appointments/:id/cancel
 */
router.post('/:id/cancel', async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        const patientId = req.portalAccount.patient_id;

        // Verify appointment belongs to patient
        const checkAppt = await pool.query(
            "SELECT * FROM appointments WHERE id = $1 AND patient_id = $2 AND patient_status != 'cancelled' AND patient_status != 'no_show'",
            [id, patientId]
        );

        if (checkAppt.rows.length === 0) {
            return res.status(404).json({ error: 'Appointment not found or already cancelled' });
        }

        const now = new Date().toISOString();

        // Get patient name for the audit trail
        const patientInfo = await pool.query(
            'SELECT first_name, last_name FROM patients WHERE id = $1',
            [patientId]
        );
        const patientName = patientInfo.rows.length > 0
            ? `${patientInfo.rows[0].first_name} ${patientInfo.rows[0].last_name}`
            : 'Patient';

        // Build clear cancellation message indicating portal origin
        const patientReason = reason ? reason : 'No reason provided';
        const fullCancellationReason = `[CANCELLED BY PATIENT VIA PORTAL] ${patientReason}`;

        // Update status and history within a transaction
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const statusHistory = checkAppt.rows[0].status_history || [];
            const newHistory = [...statusHistory, {
                status: 'cancelled',
                timestamp: now,
                changed_by: `${patientName} (Patient Portal)`,
                source: 'patient_portal',
                cancellation_reason: patientReason
            }];

            await client.query(
                "UPDATE appointments SET status = 'cancelled', patient_status = 'cancelled', cancellation_reason = $1, status_history = $2, checkout_time = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4",
                [fullCancellationReason, JSON.stringify(newHistory), now, id]
            );

            // AUTO-CREATE FOLLOW-UP RECORD
            // This ensures it appears in the EMR's "Cancellations" / Follow-up tracker tab
            const existingFollowup = await client.query(
                'SELECT id FROM cancellation_followups WHERE appointment_id = $1',
                [id]
            );

            if (existingFollowup.rows.length === 0) {
                await client.query(
                    `INSERT INTO cancellation_followups (appointment_id, patient_id, status)
                     VALUES ($1, $2, 'pending')`,
                    [id, patientId]
                );
            }

            await client.query('COMMIT');
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }

        res.json({ success: true, message: 'Appointment cancelled successfully' });
    } catch (error) {
        console.error('[Portal Appointments] Error cancelling appointment:', error);
        res.status(500).json({ error: 'Failed to cancel appointment' });
    }
});

module.exports = router;
