/**
 * Webhooks API v1
 * 
 * Manage webhook subscriptions and view delivery history.
 */

const express = require('express');
const crypto = require('crypto');
const { requireScopes } = require('../../../middleware/oauthAuth');
const { success, successWithPagination, error, notFound, validationError, encodeCursor } = require('../../../utils/apiResponse');
const pool = require('../../../db');

const router = express.Router();

// Supported webhook event types
const VALID_EVENTS = [
    'patient.created',
    'patient.updated',
    'patient.deleted',
    'appointment.created',
    'appointment.updated',
    'appointment.cancelled',
    'encounter.created',
    'encounter.signed',
    'document.created',
    'message.received'
];

/**
 * List webhook subscriptions
 * GET /api/v1/webhooks/subscriptions
 */
router.get('/subscriptions', requireScopes('webhook.manage'), async (req, res) => {
    try {
        const tenantId = req.oauth?.tenantId || req.clinic?.id;
        const appId = req.oauth?.appId;

        const result = await pool.controlPool.query(
            `SELECT id, name, url, events, status, failure_count, last_success_at, last_failure_at, created_at
       FROM webhook_subscriptions
       WHERE tenant_id = $1 AND ($2::uuid IS NULL OR app_id = $2)
       ORDER BY created_at DESC`,
            [tenantId, appId]
        );

        return success(res, result.rows);
    } catch (err) {
        console.error('[Webhooks] List subscriptions error:', err);
        return error(res, 'server_error', 'Failed to list subscriptions', 500);
    }
});

/**
 * Create webhook subscription
 * POST /api/v1/webhooks/subscriptions
 */
router.post('/subscriptions', requireScopes('webhook.manage'), async (req, res) => {
    try {
        const { name, url, events } = req.body;
        const tenantId = req.oauth?.tenantId || req.clinic?.id;
        const appId = req.oauth?.appId;

        const errors = [];
        if (!url) errors.push({ field: 'url', issue: 'required' });
        if (!events || !Array.isArray(events) || events.length === 0) {
            errors.push({ field: 'events', issue: 'required and must be non-empty array' });
        }

        // Validate URL format
        if (url) {
            try {
                new URL(url);
                if (!url.startsWith('https://')) {
                    errors.push({ field: 'url', issue: 'must use HTTPS' });
                }
            } catch (e) {
                errors.push({ field: 'url', issue: 'invalid URL format' });
            }
        }

        // Validate events
        if (events) {
            const invalidEvents = events.filter(e => !VALID_EVENTS.includes(e));
            if (invalidEvents.length > 0) {
                errors.push({ field: 'events', issue: `Invalid events: ${invalidEvents.join(', ')}` });
            }
        }

        if (errors.length > 0) {
            return validationError(res, 'Validation failed', errors);
        }

        // Generate webhook secret
        const secret = crypto.randomBytes(32).toString('hex');

        const result = await pool.controlPool.query(
            `INSERT INTO webhook_subscriptions (tenant_id, app_id, name, url, events, secret)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, url, events, status, created_at`,
            [tenantId, appId, name, url, events, secret]
        );

        return success(res, {
            ...result.rows[0],
            secret // Only returned at creation
        }, 201);
    } catch (err) {
        console.error('[Webhooks] Create subscription error:', err);
        return error(res, 'server_error', 'Failed to create subscription', 500);
    }
});

/**
 * Get single subscription
 * GET /api/v1/webhooks/subscriptions/:id
 */
router.get('/subscriptions/:id', requireScopes('webhook.manage'), async (req, res) => {
    try {
        const tenantId = req.oauth?.tenantId || req.clinic?.id;

        const result = await pool.controlPool.query(
            `SELECT id, name, url, events, status, failure_count, last_success_at, last_failure_at, created_at
       FROM webhook_subscriptions
       WHERE id = $1 AND tenant_id = $2`,
            [req.params.id, tenantId]
        );

        if (result.rows.length === 0) {
            return notFound(res, 'Subscription');
        }

        return success(res, result.rows[0]);
    } catch (err) {
        console.error('[Webhooks] Get subscription error:', err);
        return error(res, 'server_error', 'Failed to get subscription', 500);
    }
});

/**
 * Update subscription
 * PATCH /api/v1/webhooks/subscriptions/:id
 */
router.patch('/subscriptions/:id', requireScopes('webhook.manage'), async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.oauth?.tenantId || req.clinic?.id;
        const { name, url, events, status } = req.body;

        const existing = await pool.controlPool.query(
            'SELECT id FROM webhook_subscriptions WHERE id = $1 AND tenant_id = $2',
            [id, tenantId]
        );

        if (existing.rows.length === 0) {
            return notFound(res, 'Subscription');
        }

        const updates = [];
        const values = [];
        let paramIndex = 1;

        if (name !== undefined) { updates.push(`name = $${paramIndex++}`); values.push(name); }
        if (url !== undefined) {
            try {
                new URL(url);
                if (!url.startsWith('https://')) {
                    return error(res, 'validation_error', 'URL must use HTTPS', 400);
                }
                updates.push(`url = $${paramIndex++}`);
                values.push(url);
            } catch (e) {
                return error(res, 'validation_error', 'Invalid URL format', 400);
            }
        }
        if (events !== undefined) {
            const invalidEvents = events.filter(e => !VALID_EVENTS.includes(e));
            if (invalidEvents.length > 0) {
                return error(res, 'validation_error', `Invalid events: ${invalidEvents.join(', ')}`, 400);
            }
            updates.push(`events = $${paramIndex++}`);
            values.push(events);
        }
        if (status !== undefined) {
            if (!['active', 'paused', 'disabled'].includes(status)) {
                return error(res, 'validation_error', 'Status must be active, paused, or disabled', 400);
            }
            updates.push(`status = $${paramIndex++}`);
            values.push(status);
        }

        if (updates.length === 0) {
            return error(res, 'invalid_request', 'No valid fields to update', 400);
        }

        updates.push('updated_at = NOW()');
        values.push(id);

        const result = await pool.controlPool.query(
            `UPDATE webhook_subscriptions SET ${updates.join(', ')} WHERE id = $${paramIndex}
       RETURNING id, name, url, events, status, updated_at`,
            values
        );

        return success(res, result.rows[0]);
    } catch (err) {
        console.error('[Webhooks] Update subscription error:', err);
        return error(res, 'server_error', 'Failed to update subscription', 500);
    }
});

/**
 * Delete subscription
 * DELETE /api/v1/webhooks/subscriptions/:id
 */
router.delete('/subscriptions/:id', requireScopes('webhook.manage'), async (req, res) => {
    try {
        const tenantId = req.oauth?.tenantId || req.clinic?.id;

        const result = await pool.controlPool.query(
            `DELETE FROM webhook_subscriptions WHERE id = $1 AND tenant_id = $2 RETURNING id`,
            [req.params.id, tenantId]
        );

        if (result.rows.length === 0) {
            return notFound(res, 'Subscription');
        }

        return res.status(204).end();
    } catch (err) {
        console.error('[Webhooks] Delete subscription error:', err);
        return error(res, 'server_error', 'Failed to delete subscription', 500);
    }
});

/**
 * Rotate subscription secret
 * POST /api/v1/webhooks/subscriptions/:id/rotate-secret
 */
router.post('/subscriptions/:id/rotate-secret', requireScopes('webhook.manage'), async (req, res) => {
    try {
        const tenantId = req.oauth?.tenantId || req.clinic?.id;
        const newSecret = crypto.randomBytes(32).toString('hex');

        const result = await pool.controlPool.query(
            `UPDATE webhook_subscriptions SET secret = $1, updated_at = NOW()
       WHERE id = $2 AND tenant_id = $3
       RETURNING id, name`,
            [newSecret, req.params.id, tenantId]
        );

        if (result.rows.length === 0) {
            return notFound(res, 'Subscription');
        }

        return success(res, { ...result.rows[0], secret: newSecret });
    } catch (err) {
        console.error('[Webhooks] Rotate secret error:', err);
        return error(res, 'server_error', 'Failed to rotate secret', 500);
    }
});

/**
 * List webhook deliveries
 * GET /api/v1/webhooks/deliveries
 */
router.get('/deliveries', requireScopes('webhook.manage'), async (req, res) => {
    try {
        const { subscription_id, status, cursor, limit = 20 } = req.query;
        const tenantId = req.oauth?.tenantId || req.clinic?.id;
        const maxLimit = Math.min(parseInt(limit, 10) || 20, 100);

        let query = `
      SELECT wd.id, wd.subscription_id, wd.event_id, wd.attempt, wd.status,
             wd.response_code, wd.last_error, wd.duration_ms, wd.created_at, wd.completed_at,
             oe.type as event_type
      FROM webhook_deliveries wd
      JOIN webhook_subscriptions ws ON wd.subscription_id = ws.id
      JOIN outbox_events oe ON wd.event_id = oe.id
      WHERE ws.tenant_id = $1
    `;
        const params = [tenantId];
        let paramIndex = 2;

        if (subscription_id) {
            query += ` AND wd.subscription_id = $${paramIndex++}`;
            params.push(subscription_id);
        }

        if (status) {
            query += ` AND wd.status = $${paramIndex++}`;
            params.push(status);
        }

        if (cursor) {
            try {
                const decodedCursor = Buffer.from(cursor, 'base64url').toString('utf-8');
                query += ` AND wd.id < $${paramIndex++}`;
                params.push(decodedCursor);
            } catch (e) {
                return error(res, 'invalid_cursor', 'Invalid cursor format', 400);
            }
        }

        query += ` ORDER BY wd.created_at DESC LIMIT $${paramIndex++}`;
        params.push(maxLimit + 1);

        const result = await pool.controlPool.query(query, params);

        const hasMore = result.rows.length > maxLimit;
        const deliveries = hasMore ? result.rows.slice(0, maxLimit) : result.rows;
        const nextCursor = hasMore && deliveries.length > 0 ? encodeCursor(deliveries[deliveries.length - 1].id) : null;

        return successWithPagination(res, deliveries, { limit: maxLimit, has_more: hasMore, next_cursor: nextCursor });
    } catch (err) {
        console.error('[Webhooks] List deliveries error:', err);
        return error(res, 'server_error', 'Failed to list deliveries', 500);
    }
});

/**
 * Get available event types
 * GET /api/v1/webhooks/events
 */
router.get('/events', requireScopes('webhook.manage'), (req, res) => {
    return success(res, VALID_EVENTS.map(e => ({ type: e, description: e.replace('.', ' ').replace(/^\w/, c => c.toUpperCase()) })));
});

module.exports = router;
