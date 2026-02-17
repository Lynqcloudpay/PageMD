/**
 * Echo API Routes
 * 
 * REST endpoints for the Echo AI Clinical Assistant.
 * All routes require authentication and the 'ai.echo' permission.
 */

const express = require('express');
const pool = require('../db');
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../services/authorization');
const echoService = require('../services/echoService');
const echoTrendEngine = require('../services/echoTrendEngine');
const echoContextEngine = require('../services/echoContextEngine');
const echoCDSEngine = require('../services/echoCDSEngine');
const multer = require('multer');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// All routes require auth
router.use(authenticate);

// ─── Chat Endpoint ──────────────────────────────────────────────────────────

/**
 * POST /api/echo/chat
 * Main chat endpoint for Echo interactions
 */
router.post('/chat', requirePermission('ai.echo'), async (req, res) => {
    try {
        const { message, patientId, conversationId, uiContext } = req.body;

        if (!message || message.trim().length === 0) {
            return res.status(400).json({ error: 'Message is required' });
        }

        const result = await echoService.chat({
            message: message.trim(),
            patientId: patientId || null,
            conversationId: conversationId || null,
            user: req.user,
            uiContext: uiContext || null
        });

        res.json({
            success: true,
            response: result.response,
            conversationId: result.conversationId,
            toolCalls: result.toolCalls,
            usage: result.usage,
            visualizations: result.visualizations || []
        });

    } catch (err) {
        console.error('[Echo API] Chat error:', err);
        res.status(500).json({ error: 'Echo encountered an error. Please try again.' });
    }
});

/**
 * POST /api/echo/transcribe
 * Transcribe clinical audio using Whisper
 */
router.post('/transcribe', requirePermission('ai.echo'), upload.single('audio'), async (req, res) => {
    try {
        if (!req.file) {
            console.warn('[Echo API] Transcribe called without audio file. Check multipart headers.');
            return res.status(400).json({ error: 'No audio file provided' });
        }

        const transcription = await echoService.transcribeAudio(req.file.buffer, req.file.originalname);
        res.json({ success: true, text: transcription });
    } catch (err) {
        console.error('[Echo API] Transcribe error details:', {
            message: err.message,
            stack: err.stack,
            fileName: req.file?.originalname,
            fileSize: req.file?.size
        });
        res.status(500).json({ error: 'Failed to transcribe audio' });
    }
});

/**
 * POST /api/echo/commit
 * Execute a staged clinical action after provider approval
 */
router.post('/commit', requirePermission('ai.echo'), async (req, res) => {
    const client = await pool.connect();
    try {
        const { type, payload, actions, conversationId } = req.body;
        const userId = req.user.id;
        const tenantId = req.user.clinic_id;

        // Normalize to array of actions
        const actionsToCommit = actions && Array.isArray(actions)
            ? actions
            : (type && payload ? [{ type, payload }] : []);

        if (actionsToCommit.length === 0) {
            return res.status(400).json({ error: 'Actions are required' });
        }

        await client.query('BEGIN');
        const results = [];

        for (const action of actionsToCommit) {
            const { type: actType, payload: actPayload } = action;
            let record;

            switch (actType) {
                case 'add_problem':
                    record = await client.query(
                        `INSERT INTO problems (patient_id, problem_name, icd10_code, status)
                         VALUES ($1, $2, $3, $4) RETURNING *`,
                        [actPayload.patient_id, actPayload.problem_name, actPayload.icd10_code, actPayload.status]
                    );
                    break;

                case 'add_medication':
                    record = await client.query(
                        `INSERT INTO medications (patient_id, medication_name, dosage, frequency, route, prescriber_id, active, status)
                         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
                        [actPayload.patient_id, actPayload.medication_name, actPayload.dosage, actPayload.frequency,
                        actPayload.route, userId, true, 'active']
                    );
                    break;

                case 'create_order':
                    record = await client.query(
                        `INSERT INTO orders (patient_id, order_type, ordered_by, test_name, order_payload)
                         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
                        [actPayload.patient_id, actPayload.order_type, userId, actPayload.test_name, actPayload.order_payload]
                    );
                    break;
            }
            if (record) results.push({ type: actType, record: record.rows[0] });
        }

        // Audit for the commit(s)
        await client.query(
            `INSERT INTO echo_audit (conversation_id, user_id, tenant_id, patient_id, action, output_summary, risk_level)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [conversationId, userId, tenantId, actionsToCommit[0].payload.patient_id,
                actionsToCommit.length > 1 ? 'batch_commit' : 'action_committed',
                `Committed ${results.length} clinical actions`, 'high']
        );

        await client.query('COMMIT');
        res.json({ success: true, count: results.length, results });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[Echo API] Commit error:', err);
        res.status(500).json({ error: 'Failed to commit clinical action(s)' });
    } finally {
        client.release();
    }
});

// ─── Conversations ──────────────────────────────────────────────────────────

/**
 * GET /api/echo/conversations/:patientId
 * Get conversation history for a patient
 */
router.get('/conversations/:patientId', requirePermission('ai.echo'), async (req, res) => {
    try {
        const { patientId } = req.params;
        const userId = req.user.id;

        const result = await pool.query(
            `SELECT id, title, message_count, total_tokens, created_at, updated_at
             FROM echo_conversations 
             WHERE patient_id = $1 AND user_id = $2
             ORDER BY updated_at DESC LIMIT 20`,
            [patientId, userId]
        );

        res.json(result.rows);
    } catch (err) {
        console.error('[Echo API] Conversations fetch error:', err);
        res.status(500).json({ error: 'Failed to fetch conversations' });
    }
});

/**
 * GET /api/echo/conversations/:id/messages
 * Get messages in a conversation
 */
router.get('/conversations/:id/messages', requirePermission('ai.echo'), async (req, res) => {
    try {
        const { id } = req.params;

        // Verify ownership
        const conv = await pool.query(
            'SELECT user_id FROM echo_conversations WHERE id = $1',
            [id]
        );
        if (conv.rows.length === 0) {
            return res.status(404).json({ error: 'Conversation not found' });
        }
        if (conv.rows[0].user_id !== req.user.id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const messages = await echoService.getMessageHistory(id, 100);
        res.json(messages);
    } catch (err) {
        console.error('[Echo API] Messages fetch error:', err);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

/**
 * DELETE /api/echo/conversations/:id
 * Delete a conversation
 */
router.delete('/conversations/:id', requirePermission('ai.echo'), async (req, res) => {
    try {
        const { id } = req.params;

        // Verify ownership
        const conv = await pool.query(
            'SELECT user_id FROM echo_conversations WHERE id = $1',
            [id]
        );
        if (conv.rows.length === 0) {
            return res.status(404).json({ error: 'Conversation not found' });
        }
        if (conv.rows[0].user_id !== req.user.id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        await pool.query('DELETE FROM echo_conversations WHERE id = $1', [id]);
        res.json({ success: true, message: 'Conversation deleted' });
    } catch (err) {
        console.error('[Echo API] Conversation delete error:', err);
        res.status(500).json({ error: 'Failed to delete conversation' });
    }
});

// ─── Trend Analysis ─────────────────────────────────────────────────────────

/**
 * GET /api/echo/trends/:patientId/:vitalType
 * Get specific vital trend analysis (standalone, without chat)
 */
router.get('/trends/:patientId/:vitalType', requirePermission('ai.echo'), async (req, res) => {
    try {
        const { patientId, vitalType } = req.params;

        const vitalHistory = await echoContextEngine.getVitalHistory(patientId, 50);
        const analysis = echoTrendEngine.analyzeVitalTrend(vitalHistory, vitalType);

        res.json(analysis);
    } catch (err) {
        console.error('[Echo API] Trend analysis error:', err);
        res.status(500).json({ error: 'Failed to analyze trend' });
    }
});

/**
 * GET /api/echo/gaps/:patientId
 * Proactive clinical gap analysis
 */
router.get('/gaps/:patientId', requirePermission('ai.echo'), async (req, res) => {
    try {
        const { patientId } = req.params;
        const tenantId = req.user.clinic_id;

        const context = await echoContextEngine.assemblePatientContext(patientId, tenantId);
        const gaps = await echoCDSEngine.analyzeClinicalGaps(context);

        res.json(gaps);
    } catch (err) {
        console.error('[Echo API] Gaps analysis error:', err);
        res.status(500).json({ error: 'Failed to analyze clinical gaps' });
    }
});

// ─── Usage & Health ─────────────────────────────────────────────────────────

/**
 * GET /api/echo/usage
 * Get current usage stats for the clinic
 */
router.get('/usage', requirePermission('ai.echo'), async (req, res) => {
    try {
        const tenantId = req.user.clinic_id;
        const budget = await echoService.checkTokenBudget(tenantId);

        res.json({
            today: budget,
            model: process.env.ECHO_MODEL || 'gpt-4o'
        });
    } catch (err) {
        console.error('[Echo API] Usage fetch error:', err);
        res.status(500).json({ error: 'Failed to fetch usage' });
    }
});

/**
 * GET /api/echo/health
 * Health check
 */
router.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'echo',
        model: process.env.ECHO_MODEL || 'gpt-4o',
        configured: !!(process.env.AI_API_KEY || process.env.OPENAI_API_KEY),
        version: '1.0.0'
    });
});

module.exports = router;
