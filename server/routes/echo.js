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

const router = express.Router();

// All routes require auth
router.use(authenticate);

// ─── Chat Endpoint ──────────────────────────────────────────────────────────

/**
 * POST /api/echo/chat
 * Main chat endpoint for Echo interactions
 */
router.post('/chat', requirePermission('ai.echo'), async (req, res) => {
    try {
        const { message, patientId, conversationId } = req.body;

        if (!message || message.trim().length === 0) {
            return res.status(400).json({ error: 'Message is required' });
        }

        const result = await echoService.chat({
            message: message.trim(),
            patientId: patientId || null,
            conversationId: conversationId || null,
            user: req.user
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
 * GET /api/echo/trends/:patientId
 * Get all vital trends overview
 */
router.get('/trends/:patientId', requirePermission('ai.echo'), async (req, res) => {
    try {
        const { patientId } = req.params;

        const vitalHistory = await echoContextEngine.getVitalHistory(patientId, 50);
        const analysis = echoTrendEngine.analyzeAllVitals(vitalHistory);

        res.json(analysis);
    } catch (err) {
        console.error('[Echo API] All trends error:', err);
        res.status(500).json({ error: 'Failed to analyze trends' });
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
