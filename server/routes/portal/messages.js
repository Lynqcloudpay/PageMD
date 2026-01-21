const express = require('express');
const pool = require('../../db');
const { authenticatePortal, requirePortalPermission } = require('../../middleware/portalAuth');
const { body, validationResult } = require('express-validator');
const { syncInboxItems } = require('../inbasket');

const router = express.Router();

router.use(authenticatePortal);
router.use(requirePortalPermission('can_message'));

/**
 * Get all threads for the logged-in patient
 * GET /api/portal/messages/threads
 */
router.get('/threads', async (req, res) => {
    try {
        const patientId = req.portalAccount.patient_id;

        const result = await pool.query(`
            SELECT t.*, 
                (SELECT body FROM portal_messages WHERE thread_id = t.id ORDER BY created_at DESC LIMIT 1) as last_message_body,
                (SELECT COUNT(*) FROM portal_messages WHERE thread_id = t.id AND read_at IS NULL AND sender_user_id IS NOT NULL) as unread_count,
                u.first_name as staff_first_name,
                u.last_name as staff_last_name
            FROM portal_message_threads t
            LEFT JOIN users u ON t.assigned_user_id = u.id
            WHERE t.patient_id = $1
            ORDER BY t.last_message_at DESC
        `, [patientId]);

        res.json(result.rows);
    } catch (error) {
        console.error('[Portal Messages] Error fetching threads:', error);
        res.status(500).json({ error: 'Failed to fetch message threads' });
    }
});

/**
 * Get messages for a specific thread
 * GET /api/portal/messages/threads/:id
 */
router.get('/threads/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const patientId = req.portalAccount.patient_id;

        // Verify thread belongs to patient
        const threadResult = await pool.query(
            'SELECT * FROM portal_message_threads WHERE id = $1 AND patient_id = $2',
            [id, patientId]
        );

        if (threadResult.rows.length === 0) {
            return res.status(404).json({ error: 'Thread not found' });
        }

        const messagesResult = await pool.query(`
            SELECT m.*, 
                u.first_name as staff_first_name, u.last_name as staff_last_name
            FROM portal_messages m
            LEFT JOIN users u ON m.sender_user_id = u.id
            WHERE m.thread_id = $1
            ORDER BY m.created_at ASC
        `, [id]);

        // Mark staff messages as read
        await pool.query(
            'UPDATE portal_messages SET read_at = CURRENT_TIMESTAMP WHERE thread_id = $1 AND sender_user_id IS NOT NULL AND read_at IS NULL',
            [id]
        );

        res.json({
            thread: threadResult.rows[0],
            messages: messagesResult.rows
        });
    } catch (error) {
        console.error('[Portal Messages] Error fetching thread messages:', error);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

/**
 * Create a new message thread
 * POST /api/portal/messages/threads
 */
router.post('/threads', [
    body('subject').notEmpty().trim().escape(),
    body('body').notEmpty().trim(),
    body('assigned_user_id').optional().isUUID()
], async (req, res) => {
    const client = await pool.connect();
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { subject, body, assigned_user_id } = req.body;
        const patientId = req.portalAccount.patient_id;
        const portalAccountId = req.portalAccount.id;

        await client.query('BEGIN');

        // 1. Create thread
        const threadResult = await client.query(
            'INSERT INTO portal_message_threads (patient_id, subject, assigned_user_id) VALUES ($1, $2, $3) RETURNING id',
            [patientId, subject, assigned_user_id]
        );
        const threadId = threadResult.rows[0].id;

        // 2. Create message
        await client.query(
            'INSERT INTO portal_messages (thread_id, sender_portal_account_id, sender_id, sender_type, body) VALUES ($1, $2, $3, $4, $5)',
            [threadId, portalAccountId, portalAccountId, 'patient', body]
        );

        await client.query('COMMIT');

        // Trigger inbasket sync so staff sees it immediately
        try {
            await syncInboxItems(req.clinic?.id, req.clinic?.schema_name);
        } catch (syncError) {
            console.error('[Portal Messages] Sync error (non-blocking):', syncError);
        }

        res.status(201).json({ success: true, threadId });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[Portal Messages] Error creating thread:', error);
        res.status(500).json({ error: 'Failed to create message thread' });
    } finally {
        client.release();
    }
});

/**
 * Reply to a thread
 * POST /api/portal/messages/threads/:id
 */
router.post('/threads/:id', [
    body('body').notEmpty().trim()
], async (req, res) => {
    try {
        const { id } = req.params;
        const { body } = req.body;
        const patientId = req.portalAccount.patient_id;
        const portalAccountId = req.portalAccount.id;

        // Verify thread belongs to patient
        const threadResult = await pool.query(
            'SELECT * FROM portal_message_threads WHERE id = $1 AND patient_id = $2',
            [id, patientId]
        );

        if (threadResult.rows.length === 0) {
            return res.status(404).json({ error: 'Thread not found' });
        }

        await pool.query('BEGIN');

        // 1. Insert message
        const msgResult = await pool.query(
            'INSERT INTO portal_messages (thread_id, sender_portal_account_id, sender_id, sender_type, body) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [id, portalAccountId, portalAccountId, 'patient', body]
        );

        // 2. Update thread last_message_at and status if needed (e.g. reopen)
        await pool.query(
            'UPDATE portal_message_threads SET last_message_at = CURRENT_TIMESTAMP, status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            ['open', id]
        );

        // 3. AUTO-SCHEDULING LOGIC: If body contains [ACCEPTED_SLOT:YYYY-MM-DDTHH:mm]
        const acceptMatch = body.match(/\[ACCEPTED_SLOT:(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})\]/);
        if (acceptMatch) {
            const [_, date, time] = acceptMatch;

            // Find the most recent pending appointment request for this patient
            const pendingReq = await pool.query(
                'SELECT * FROM portal_appointment_requests WHERE patient_id = $1 AND status = $2 ORDER BY created_at DESC LIMIT 1',
                [patientId, 'pending']
            );

            if (pendingReq.rows.length > 0) {
                const request = pendingReq.rows[0];
                const providerId = request.provider_id || (await pool.query('SELECT primary_care_provider FROM patients WHERE id = $1', [patientId])).rows[0]?.primary_care_provider;

                if (providerId) {
                    // Create the appointment
                    const apptResult = await pool.query(`
                        INSERT INTO appointments (patient_id, provider_id, appointment_date, appointment_time, duration, appointment_type, status, notes)
                        VALUES ($1, $2, $3, $4, $5, $6, 'scheduled', $7)
                        RETURNING id
                    `, [patientId, providerId, date, time, 30, request.appointment_type || 'Follow-up', 'Auto-scheduled via portal message acceptance']);

                    // Update the request status
                    await pool.query(
                        'UPDATE portal_appointment_requests SET status = $1, processed_at = CURRENT_TIMESTAMP WHERE id = $2',
                        ['approved', request.id]
                    );

                    // Mark related In-Basket items as completed
                    await pool.query(
                        "UPDATE inbox_items SET status = 'completed', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE reference_id = $1 AND reference_table = $2",
                        [request.id, 'portal_appointment_requests']
                    );

                    // Also mark the portal message thread inbasket item as completed if it exists
                    await pool.query(
                        "UPDATE inbox_items SET status = 'completed', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE reference_id = $1 AND reference_table = $2",
                        [id, 'portal_message_threads']
                    );
                }
            }
        }

        await pool.query('COMMIT');

        // Trigger inbasket sync so staff sees it immediately
        try {
            await syncInboxItems(req.clinic?.id, req.clinic?.schema_name);
        } catch (syncError) {
            console.error('[Portal Messages] Sync error (non-blocking):', syncError);
        }

        res.json({ success: true });
    } catch (error) {
        await pool.query('ROLLBACK');
        console.error('[Portal Messages] Error replying to thread:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

/**
 * Delete a message thread
 * DELETE /api/portal/messages/threads/:id
 */
router.delete('/threads/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const patientId = req.portalAccount.patient_id;

        // Verify thread belongs to patient
        const threadRes = await pool.query(
            'SELECT id FROM portal_message_threads WHERE id = $1 AND patient_id = $2',
            [id, patientId]
        );

        if (threadRes.rows.length === 0) {
            return res.status(404).json({ error: 'Thread not found' });
        }

        // Delete all messages first (cascade should handle this but being explicit)
        await pool.query('DELETE FROM portal_messages WHERE thread_id = $1', [id]);

        // Delete the thread
        await pool.query('DELETE FROM portal_message_threads WHERE id = $1', [id]);

        res.json({ success: true });
    } catch (error) {
        console.error('[Portal Messages] Error deleting thread:', error);
        res.status(500).json({ error: 'Failed to delete thread' });
    }
});

module.exports = router;
