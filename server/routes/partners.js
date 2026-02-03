/**
 * Partner Management Routes
 * 
 * Admin endpoints for managing partners and apps
 * Requires admin.apps.manage scope or internal admin auth
 */

const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const oauthService = require('../services/oauthService');
const pool = require('../db');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * List all partners (admin only)
 * GET /api/admin/partners
 */
router.get('/partners', requireRole('admin', 'superadmin'), async (req, res) => {
    try {
        const { status, page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;

        let query = `
      SELECT p.*, 
             COUNT(a.id) as app_count,
             COUNT(a.id) FILTER (WHERE a.status = 'active') as active_app_count
      FROM partners p
      LEFT JOIN apps a ON p.id = a.partner_id
    `;
        const params = [];

        if (status) {
            query += ` WHERE p.status = $1`;
            params.push(status);
        }

        query += ` GROUP BY p.id ORDER BY p.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(parseInt(limit, 10), offset);

        const result = await pool.controlPool.query(query, params);

        // Get total count
        const countQuery = status
            ? 'SELECT COUNT(*) FROM partners WHERE status = $1'
            : 'SELECT COUNT(*) FROM partners';
        const countResult = await pool.controlPool.query(countQuery, status ? [status] : []);

        res.json({
            data: result.rows,
            pagination: {
                page: parseInt(page, 10),
                limit: parseInt(limit, 10),
                total: parseInt(countResult.rows[0].count, 10)
            }
        });
    } catch (error) {
        console.error('[Partners] List error:', error);
        res.status(500).json({ error: { code: 'server_error', message: 'Failed to list partners' } });
    }
});

/**
 * Create a new partner
 * POST /api/admin/partners
 */
router.post('/partners', requireRole('admin', 'superadmin'), async (req, res) => {
    try {
        const { name, contact_email, contact_name, company_url, description } = req.body;

        if (!name || !contact_email) {
            return res.status(400).json({
                error: {
                    code: 'invalid_request',
                    message: 'name and contact_email are required'
                }
            });
        }

        const result = await pool.controlPool.query(
            `INSERT INTO partners (name, contact_email, contact_name, company_url, description)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
            [name, contact_email, contact_name, company_url, description]
        );

        res.status(201).json({ data: result.rows[0] });
    } catch (error) {
        console.error('[Partners] Create error:', error);
        res.status(500).json({ error: { code: 'server_error', message: 'Failed to create partner' } });
    }
});

/**
 * Get partner details
 * GET /api/admin/partners/:id
 */
router.get('/partners/:id', requireRole('admin', 'superadmin'), async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.controlPool.query(
            `SELECT p.*, 
              json_agg(json_build_object(
                'id', a.id,
                'name', a.name,
                'env', a.env,
                'status', a.status,
                'client_id', a.client_id,
                'created_at', a.created_at
              )) FILTER (WHERE a.id IS NOT NULL) as apps
       FROM partners p
       LEFT JOIN apps a ON p.id = a.partner_id
       WHERE p.id = $1
       GROUP BY p.id`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: { code: 'not_found', message: 'Partner not found' } });
        }

        res.json({ data: result.rows[0] });
    } catch (error) {
        console.error('[Partners] Get error:', error);
        res.status(500).json({ error: { code: 'server_error', message: 'Failed to get partner' } });
    }
});

/**
 * Update partner
 * PATCH /api/admin/partners/:id
 */
router.patch('/partners/:id', requireRole('admin', 'superadmin'), async (req, res) => {
    try {
        const { id } = req.params;
        const { name, contact_email, contact_name, company_url, description, status } = req.body;

        const updates = [];
        const values = [];
        let paramIndex = 1;

        if (name) { updates.push(`name = $${paramIndex++}`); values.push(name); }
        if (contact_email) { updates.push(`contact_email = $${paramIndex++}`); values.push(contact_email); }
        if (contact_name !== undefined) { updates.push(`contact_name = $${paramIndex++}`); values.push(contact_name); }
        if (company_url !== undefined) { updates.push(`company_url = $${paramIndex++}`); values.push(company_url); }
        if (description !== undefined) { updates.push(`description = $${paramIndex++}`); values.push(description); }
        if (status) { updates.push(`status = $${paramIndex++}`); values.push(status); }

        if (updates.length === 0) {
            return res.status(400).json({ error: { code: 'invalid_request', message: 'No fields to update' } });
        }

        updates.push(`updated_at = NOW()`);
        values.push(id);

        const result = await pool.controlPool.query(
            `UPDATE partners SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
            values
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: { code: 'not_found', message: 'Partner not found' } });
        }

        res.json({ data: result.rows[0] });
    } catch (error) {
        console.error('[Partners] Update error:', error);
        res.status(500).json({ error: { code: 'server_error', message: 'Failed to update partner' } });
    }
});

/**
 * Create an app for a partner
 * POST /api/admin/partners/:partnerId/apps
 */
router.post('/partners/:partnerId/apps', requireRole('admin', 'superadmin'), async (req, res) => {
    try {
        const { partnerId } = req.params;
        const { name, description, env = 'sandbox', redirect_uris = [], allowed_scopes = [], tenant_id } = req.body;

        // Verify partner exists
        const partnerCheck = await pool.controlPool.query(
            'SELECT id, status FROM partners WHERE id = $1',
            [partnerId]
        );

        if (partnerCheck.rows.length === 0) {
            return res.status(404).json({ error: { code: 'not_found', message: 'Partner not found' } });
        }

        if (partnerCheck.rows[0].status !== 'active') {
            return res.status(400).json({ error: { code: 'invalid_request', message: 'Partner is not active' } });
        }

        if (!name) {
            return res.status(400).json({ error: { code: 'invalid_request', message: 'name is required' } });
        }

        const app = await oauthService.createApp(partnerId, {
            name,
            description,
            env,
            redirectUris: redirect_uris,
            allowedScopes: allowed_scopes,
            tenantId: tenant_id
        });

        res.status(201).json({
            data: app,
            message: 'App created. Store the client_secret securely - it will not be shown again.'
        });
    } catch (error) {
        console.error('[Partners] Create app error:', error);
        res.status(500).json({ error: { code: 'server_error', message: 'Failed to create app' } });
    }
});

/**
 * List apps for a partner
 * GET /api/admin/partners/:partnerId/apps
 */
router.get('/partners/:partnerId/apps', requireRole('admin', 'superadmin'), async (req, res) => {
    try {
        const { partnerId } = req.params;

        const result = await pool.controlPool.query(
            `SELECT a.id, a.name, a.description, a.env, a.status, a.client_id,
              a.allowed_scopes, a.redirect_uris, a.tenant_id,
              a.created_at, a.updated_at,
              rlp.name as rate_limit_policy
       FROM apps a
       LEFT JOIN rate_limit_policies rlp ON a.rate_limit_policy_id = rlp.id
       WHERE a.partner_id = $1
       ORDER BY a.created_at DESC`,
            [partnerId]
        );

        res.json({ data: result.rows });
    } catch (error) {
        console.error('[Partners] List apps error:', error);
        res.status(500).json({ error: { code: 'server_error', message: 'Failed to list apps' } });
    }
});

/**
 * Get app details
 * GET /api/admin/apps/:id
 */
router.get('/apps/:id', requireRole('admin', 'superadmin'), async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.controlPool.query(
            `SELECT a.*, p.name as partner_name, rlp.name as rate_limit_policy
       FROM apps a
       JOIN partners p ON a.partner_id = p.id
       LEFT JOIN rate_limit_policies rlp ON a.rate_limit_policy_id = rlp.id
       WHERE a.id = $1`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: { code: 'not_found', message: 'App not found' } });
        }

        // Don't return client_secret_hash
        const app = result.rows[0];
        delete app.client_secret_hash;

        res.json({ data: app });
    } catch (error) {
        console.error('[Partners] Get app error:', error);
        res.status(500).json({ error: { code: 'server_error', message: 'Failed to get app' } });
    }
});

/**
 * Update app
 * PATCH /api/admin/apps/:id
 */
router.patch('/apps/:id', requireRole('admin', 'superadmin'), async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, status, redirect_uris, allowed_scopes, rate_limit_policy_id, tenant_id } = req.body;

        const updates = [];
        const values = [];
        let paramIndex = 1;

        if (name) { updates.push(`name = $${paramIndex++}`); values.push(name); }
        if (description !== undefined) { updates.push(`description = $${paramIndex++}`); values.push(description); }
        if (status) { updates.push(`status = $${paramIndex++}`); values.push(status); }
        if (redirect_uris) { updates.push(`redirect_uris = $${paramIndex++}`); values.push(redirect_uris); }
        if (allowed_scopes) { updates.push(`allowed_scopes = $${paramIndex++}`); values.push(allowed_scopes); }
        if (rate_limit_policy_id) { updates.push(`rate_limit_policy_id = $${paramIndex++}`); values.push(rate_limit_policy_id); }
        if (tenant_id !== undefined) { updates.push(`tenant_id = $${paramIndex++}`); values.push(tenant_id); }

        if (updates.length === 0) {
            return res.status(400).json({ error: { code: 'invalid_request', message: 'No fields to update' } });
        }

        updates.push(`updated_at = NOW()`);
        values.push(id);

        const result = await pool.controlPool.query(
            `UPDATE apps SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING id, name, status, allowed_scopes`,
            values
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: { code: 'not_found', message: 'App not found' } });
        }

        res.json({ data: result.rows[0] });
    } catch (error) {
        console.error('[Partners] Update app error:', error);
        res.status(500).json({ error: { code: 'server_error', message: 'Failed to update app' } });
    }
});

/**
 * Rotate app client secret
 * POST /api/admin/apps/:id/rotate-secret
 */
router.post('/apps/:id/rotate-secret', requireRole('admin', 'superadmin'), async (req, res) => {
    try {
        const { id } = req.params;

        // Verify app exists
        const appCheck = await pool.controlPool.query('SELECT id, name FROM apps WHERE id = $1', [id]);
        if (appCheck.rows.length === 0) {
            return res.status(404).json({ error: { code: 'not_found', message: 'App not found' } });
        }

        const result = await oauthService.rotateClientSecret(id);

        res.json({
            data: { client_secret: result.client_secret },
            message: 'Client secret rotated. Store the new secret securely - it will not be shown again.'
        });
    } catch (error) {
        console.error('[Partners] Rotate secret error:', error);
        res.status(500).json({ error: { code: 'server_error', message: 'Failed to rotate secret' } });
    }
});

/**
 * List rate limit policies
 * GET /api/admin/rate-limit-policies
 */
router.get('/rate-limit-policies', requireRole('admin', 'superadmin'), async (req, res) => {
    try {
        const result = await pool.controlPool.query(
            'SELECT * FROM rate_limit_policies ORDER BY per_day ASC'
        );
        res.json({ data: result.rows });
    } catch (error) {
        console.error('[Partners] List rate limit policies error:', error);
        res.status(500).json({ error: { code: 'server_error', message: 'Failed to list policies' } });
    }
});

/**
 * Get available scopes
 * GET /api/admin/scopes
 */
router.get('/scopes', requireRole('admin', 'superadmin'), async (req, res) => {
    res.json({
        data: [
            { scope: 'patient.read', description: 'Read patient demographics and records' },
            { scope: 'patient.write', description: 'Create and update patient records' },
            { scope: 'appointment.read', description: 'Read appointment data' },
            { scope: 'appointment.write', description: 'Create and update appointments' },
            { scope: 'encounter.read', description: 'Read encounter/visit data' },
            { scope: 'encounter.write', description: 'Create and update encounters' },
            { scope: 'document.read', description: 'Read clinical documents' },
            { scope: 'document.write', description: 'Upload clinical documents' },
            { scope: 'medication.read', description: 'Read medication data' },
            { scope: 'medication.write', description: 'Create prescriptions' },
            { scope: 'webhook.manage', description: 'Manage webhook subscriptions' },
            { scope: 'admin.apps.manage', description: 'Manage partner apps (admin)' },
            { scope: 'ai.use', description: 'Use AI capabilities' }
        ]
    });
});

module.exports = router;
