const express = require('express');
const pool = require('../../db');
const { authenticatePortal, requirePortalPermission } = require('../../middleware/portalAuth');
const { body, validationResult } = require('express-validator');

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
                (SELECT COUNT(*) FROM portal_messages WHERE thread_id = t.id AND read_at IS NULL AND sender_user_id IS NOT NULL) as unread_count
            FROM portal_message_threads t
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
        await pool.query(
            'INSERT INTO portal_messages (thread_id, sender_portal_account_id, sender_id, sender_type, body) VALUES ($1, $2, $3, $4, $5)',
            [id, portalAccountId, portalAccountId, 'patient', body]
        );

        // 2. Update thread last_message_at and status if needed (e.g. reopen)
        await pool.query(
            'UPDATE portal_message_threads SET last_message_at = CURRENT_TIMESTAMP, status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            ['open', id]
        );

        await pool.query('COMMIT');

        res.json({ success: true });
    } catch (error) {
        await pool.query('ROLLBACK');
        console.error('[Portal Messages] Error replying to thread:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

module.exports = router;
