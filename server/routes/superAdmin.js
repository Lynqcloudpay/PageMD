const express = require('express');
const pool = require('../db');
const tenantManager = require('../services/tenantManager');
const governanceService = require('../services/governanceService');
const AuditService = require('../services/auditService');

const router = express.Router();


// Middleware to verify Platform Admin authentication
const verifySuperAdmin = async (req, res, next) => {
    const token = req.headers['x-platform-token'];

    if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        // Validate session token
        const result = await pool.controlPool.query(
            `SELECT sa.* FROM platform_admin_sessions pas
       JOIN super_admins sa ON pas.admin_id = sa.id
       WHERE pas.token = $1 AND pas.expires_at > NOW() AND sa.is_active = true`,
            [token]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid or expired session' });
        }

        // Attach admin info to request
        req.platformAdmin = result.rows[0];
        next();
    } catch (error) {
        console.error('Auth verification error:', error);
        res.status(500).json({ error: 'Authentication failed' });
    }
};

// ═══════════════════════════════════════════════════════════════
// CLINIC MANAGEMENT
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/super/clinics
 * List all clinics with detailed metrics
 */
router.get('/clinics', verifySuperAdmin, async (req, res) => {
    try {
        const { status, search } = req.query;

        let query = `
            SELECT 
                c.*,
                NULL as subscription_status,
                NULL as current_period_end,
                'Active' as plan_name,
                0 as price_monthly,
                COUNT(DISTINCT st.id) FILTER (WHERE st.status IN ('open', 'in_progress')) as open_tickets,
                COALESCE(csc.onboarding_complete, false) as onboarding_complete
            FROM clinics c
            LEFT JOIN platform_support_tickets st ON c.id = st.clinic_id
            LEFT JOIN clinic_setup_checklist csc ON c.slug = csc.tenant_id
        `;

        const conditions = [];
        const params = [];

        if (req.query.tenant_type) {
            conditions.push(`c.tenant_type = $${params.length + 1}`);
            params.push(req.query.tenant_type);
        }

        if (req.query.emr_version) {
            conditions.push(`c.emr_version = $${params.length + 1}`);
            params.push(req.query.emr_version);
        }

        if (status) {
            conditions.push(`c.status = $${params.length + 1}`);
            params.push(status);
        }

        if (search) {
            conditions.push(`(c.display_name ILIKE $${params.length + 1} OR c.slug ILIKE $${params.length + 1})`);
            params.push(`%${search}%`);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        query += ' GROUP BY c.id, csc.onboarding_complete ORDER BY c.created_at DESC';

        const { rows } = await pool.controlPool.query(query, params);
        res.json(rows);
    } catch (error) {
        console.error('Error fetching clinics:', error);
        res.status(500).json({ error: 'Failed to fetch clinics from Control DB' });
    }
});

/**
 * GET /api/super/clinics/:id
 * Get detailed clinic information
 */
router.get('/clinics/:id', verifySuperAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        const clinic = await pool.controlPool.query(`
        SELECT
        c.*,
            NULL as subscription_status,
            NULL as billing_cycle,
            NULL as current_period_start,
            NULL as current_period_end,
            NULL as trial_end_date,
            'Active' as plan_name,
            0 as price_monthly,
            0 as price_yearly
      FROM clinics c
      WHERE c.id = $1
            `, [id]);

        if (clinic.rows.length === 0) {
            return res.status(404).json({ error: 'Clinic not found' });
        }

        // Stubbed recent usage metrics
        const usage = [];

        // Stubbed payment history
        const payments = [];

        res.json({
            clinic: clinic.rows[0],
            usage: usage,
            recent_payments: payments
        });
    } catch (error) {
        console.error('Error fetching clinic details:', error);
        res.status(500).json({ error: 'Failed to fetch clinic details' });
    }
});

/**
 * GET /api/super/clinics/:id/users
 * List all users in a specific clinic
 * Priority placement to avoid generic ID collision
 */
router.get('/clinics/:id/users', verifySuperAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`[SuperAdmin] Request for clinic users.ID: ${id} `);

        // 1. Get clinic schema
        const clinicRes = await pool.controlPool.query('SELECT schema_name FROM clinics WHERE id = $1', [id]);
        if (clinicRes.rows.length === 0) {
            console.warn(`[SuperAdmin] Clinic not found during user list request: ${id} `);
            return res.status(404).json({ error: 'Clinic not found' });
        }

        const { schema_name } = clinicRes.rows[0];
        console.log(`[SuperAdmin] Found schema: ${schema_name} for clinic: ${id} `);

        // 2. Query users from that schema
        const usersRes = await pool.controlPool.query(`
        SELECT
        u.id, u.email, u.first_name, u.last_name, u.status, u.role, u.is_admin, u.last_login, u.created_at,
            r.name as role_display_name
            FROM ${schema_name}.users u
            LEFT JOIN ${schema_name}.roles r ON u.role_id = r.id
            ORDER BY u.created_at DESC
            `);

        console.log(`[SuperAdmin] Successfully retrieved ${usersRes.rows.length} users for ${schema_name}`);
        res.json(usersRes.rows);
    } catch (error) {
        console.error('[SuperAdmin] Error fetching clinic users:', error);
        res.status(500).json({ error: 'Failed to fetch users for this clinic' });
    }
});

/**
 * PATCH /api/super/clinics/:id/status
 * Update clinic status (activate, suspend, deactivate)
 */
router.patch('/clinics/:id/status', verifySuperAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { status, reason } = req.body;

        if (!['active', 'suspended', 'deactivated'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        await pool.controlPool.query(
            'UPDATE clinics SET status = $1, updated_at = NOW() WHERE id = $2',
            [status, id]
        );

        // Log the action
        // Log the action (Phase 3: Secure Audit)
        await AuditService.log(null, `clinic_${status} `, id, { reason });

        res.json({ message: `Clinic ${status} successfully`, status });
    } catch (error) {
        console.error('Error updating clinic status:', error);
        res.status(500).json({ error: 'Failed to update clinic status' });
    }
});

/**
 * PATCH /api/super/clinics/:id/controls
 * Update individual kill switches and metadata
 */
router.patch('/clinics/:id/controls', verifySuperAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const {
            is_read_only,
            billing_locked,
            prescribing_locked,
            emr_version,
            tenant_type,
            compliance_zones,
            region,
            go_live_date
        } = req.body;

        // 1. Fetch current state for audit comparison
        const beforeRes = await pool.controlPool.query('SELECT * FROM clinics WHERE id = $1', [id]);
        if (beforeRes.rows.length === 0) return res.status(404).json({ error: 'Clinic not found' });
        const beforeData = beforeRes.rows[0];

        // 2. Validation
        if (tenant_type && !['Solo', 'Group', 'Enterprise'].includes(tenant_type)) {
            return res.status(400).json({ error: 'Invalid tenant type. Must be Solo, Group, or Enterprise.' });
        }

        const updates = [];
        const params = [id];
        let pCount = 1;

        const allowedKeys = {
            is_read_only: 'boolean',
            billing_locked: 'boolean',
            prescribing_locked: 'boolean',
            emr_version: 'string',
            tenant_type: 'string',
            compliance_zones: 'object', // for JSONB
            region: 'string',
            go_live_date: 'string'
        };

        for (const [key, type] of Object.entries(allowedKeys)) {
            if (req.body[key] !== undefined) {
                pCount++;
                updates.push(`${key} = $${pCount} `);

                // Special handling for date fields: empty string means NULL
                if (key === 'go_live_date' && req.body[key] === '') {
                    params.push(null);
                }
                // Ensure objects/arrays are stringified for JSONB columns
                else if (type === 'object' && typeof req.body[key] === 'object') {
                    params.push(JSON.stringify(req.body[key]));
                } else {
                    params.push(req.body[key]);
                }
            }
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No valid update fields provided' });
        }

        const query = `UPDATE clinics SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $1 RETURNING * `;
        const result = await pool.controlPool.query(query, params);
        const afterData = result.rows[0];

        // 3. Structured Platform Audit Log (Before/After)
        // 3. Structured Platform Audit Log (Phase 3: Hashed)
        await AuditService.log(null, 'clinic_controls_updated', id, {
            adminEmail: req.platformAdmin.email,
            changes: req.body,
            previousState: {
                is_read_only: beforeData.is_read_only,
                billing_locked: beforeData.billing_locked,
                prescribing_locked: beforeData.prescribing_locked,
                emr_version: beforeData.emr_version,
                tenant_type: beforeData.tenant_type,
                compliance_zones: beforeData.compliance_zones
            }
        });

        res.json(afterData);
    } catch (error) {
        console.error('Error updating clinic controls:', error);
        res.status(500).json({ error: 'Failed to update clinic controls' });
    }
});

/**
 * PATCH /api/super/clinics/:id/features
 * Update granular EMR feature toggles
 */
router.patch('/clinics/:id/features', verifySuperAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { features } = req.body;

        if (!features || typeof features !== 'object') {
            return res.status(400).json({ error: 'Invalid features object provided' });
        }

        // Fetch current features for audit
        const currentRes = await pool.controlPool.query('SELECT enabled_features FROM clinics WHERE id = $1', [id]);
        if (currentRes.rows.length === 0) return res.status(404).json({ error: 'Clinic not found' });

        const currentFeatures = currentRes.rows[0].enabled_features || {};
        const updatedFeatures = { ...currentFeatures, ...features };

        const result = await pool.controlPool.query(
            'UPDATE clinics SET enabled_features = $1, updated_at = NOW() WHERE id = $2 RETURNING enabled_features',
            [JSON.stringify(updatedFeatures), id]
        );

        // Audit the change
        await AuditService.log(null, 'clinic_features_updated', id, {
            adminEmail: req.platformAdmin.email,
            changes: features,
            previousFeatures: currentFeatures
        });

        res.json({ success: true, enabled_features: result.rows[0].enabled_features });
    } catch (error) {
        console.error('Error updating clinic features:', error);
        res.status(500).json({ error: 'Failed to update clinic features' });
    }
});

/**
 * DELETE /api/super/clinics/:id
 * Fully deletes a clinic and its data
 */
router.delete('/clinics/:id', verifySuperAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        await tenantManager.deprovisionClinic(id);
        res.json({ message: 'Clinic and all associated data deleted successfully' });
    } catch (error) {
        console.error('Error deleting clinic:', error);
        res.status(500).json({ error: error.message || 'Failed to delete clinic' });
    }
});

// Helper to generate secure random password
const generatePassword = (length = 16) => {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let ret = '';
    for (let i = 0, n = charset.length; i < length; ++i) {
        ret += charset.charAt(Math.floor(Math.random() * n));
    }
    return ret;
};

/**
 * POST /api/super/clinics/onboard
 * Provisions a new clinic
 */
router.post('/clinics/onboard', verifySuperAdmin, async (req, res) => {
    const { clinic, adminUser } = req.body;

    if (!clinic || !clinic.slug) {
        return res.status(400).json({ error: 'Missing required onboarding data (slug).' });
    }

    try {
        // Map frontend payload to TenantManager (expecting displayName)
        const clinicData = {
            ...clinic,
            displayName: clinic.displayName || clinic.name // flexible mapping
        };

        const clinicId = await tenantManager.provisionClinic(clinicData, {}, adminUser);

        // Create trial subscription
        const trialPlan = await pool.controlPool.query(
            "SELECT id FROM subscription_plans WHERE name = 'Trial' LIMIT 1"
        );

        if (trialPlan.rows.length > 0) {
            await pool.controlPool.query(`
        INSERT INTO clinic_subscriptions(clinic_id, plan_id, status, trial_end_date, current_period_start, current_period_end)
        VALUES($1, $2, 'trial', NOW() + INTERVAL '30 days', NOW(), NOW() + INTERVAL '30 days')
            `, [clinicId, trialPlan.rows[0].id]);
        }

        res.status(201).json({
            message: 'Clinic onboarded successfully with 30-day trial.',
            clinicId
        });
    } catch (error) {
        console.error('Onboarding failed:', error);
        res.status(500).json({ error: error.message || 'Failed to onboard clinic.' });
    }
});

// ═══════════════════════════════════════════════════════════════
// SUBSCRIPTION & BILLING MANAGEMENT
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/super/subscriptions
 * List all subscriptions with filtering
 */
router.get('/subscriptions', verifySuperAdmin, async (req, res) => {
    try {
        const { status } = req.query;

        let query = `
        SELECT
        cs.*,
            c.display_name as clinic_name,
            c.slug,
            sp.name as plan_name,
            sp.price_monthly,
            sp.price_yearly
      FROM clinic_subscriptions cs
      JOIN clinics c ON cs.clinic_id = c.id
      JOIN subscription_plans sp ON cs.plan_id = sp.id
            `;

        const params = [];
        if (status) {
            query += ' WHERE cs.status = $1';
            params.push(status);
        }

        query += ' ORDER BY cs.created_at DESC';

        const { rows } = await pool.controlPool.query(query, params);
        res.json(rows);
    } catch (error) {
        console.error('Error fetching subscriptions:', error);
        res.status(500).json({ error: 'Failed to fetch subscriptions' });
    }
});

/**
 * POST /api/super/payments
 * Record a payment
 */
router.post('/payments', verifySuperAdmin, async (req, res) => {
    try {
        const { clinic_id, amount, payment_method, transaction_id, description } = req.body;

        const result = await pool.controlPool.query(`
      INSERT INTO payment_history(clinic_id, amount, payment_method, transaction_id, description, status, paid_at)
        VALUES($1, $2, $3, $4, $5, 'completed', NOW())
        RETURNING *
            `, [clinic_id, amount, payment_method, transaction_id, description]);

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error recording payment:', error);
        res.status(500).json({ error: 'Failed to record payment' });
    }
});

/**
 * GET /api/super/revenue
 * Get revenue analytics
 */
router.get('/revenue', verifySuperAdmin, async (req, res) => {
    try {
        const { period = 'month' } = req.query;

        const interval = period === 'year' ? '12 months' : '30 days';

        const revenue = await pool.controlPool.query(`
        SELECT
        DATE_TRUNC('day', paid_at) as date,
            SUM(amount) as total,
            COUNT(*) as transaction_count
      FROM payment_history
      WHERE paid_at >= NOW() - INTERVAL '${interval}'
        AND status = 'completed'
      GROUP BY DATE_TRUNC('day', paid_at)
      ORDER BY date DESC
            `);

        const summary = await pool.controlPool.query(`
        SELECT
        COUNT(DISTINCT clinic_id) as paying_clinics,
            SUM(amount) as total_revenue,
            AVG(amount) as avg_transaction
      FROM payment_history
      WHERE paid_at >= NOW() - INTERVAL '${interval}'
        AND status = 'completed'
            `);

        res.json({
            period,
            daily_revenue: revenue.rows,
            summary: summary.rows[0]
        });
    } catch (error) {
        console.error('Error fetching revenue:', error);
        res.status(500).json({ error: 'Failed to fetch revenue data' });
    }
});

// ═══════════════════════════════════════════════════════════════
// SUPPORT TICKET MANAGEMENT
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/super/tickets
 * List support tickets
 */
router.get('/tickets', verifySuperAdmin, async (req, res) => {
    try {
        const { status, priority, clinic_id } = req.query;

        let query = `
        SELECT
        st.*,
            c.display_name as clinic_name,
            c.slug as clinic_slug
      FROM platform_support_tickets st
      JOIN clinics c ON st.clinic_id = c.id
            `;

        const conditions = [];
        const params = [];

        if (status) {
            conditions.push(`st.status = $${params.length + 1} `);
            params.push(status);
        }

        if (priority) {
            conditions.push(`st.priority = $${params.length + 1} `);
            params.push(priority);
        }

        if (clinic_id) {
            conditions.push(`st.clinic_id = $${params.length + 1} `);
            params.push(clinic_id);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        query += ' ORDER BY st.created_at DESC LIMIT 100';

        const { rows } = await pool.controlPool.query(query, params);
        res.json(rows);
    } catch (error) {
        console.error('Error fetching tickets:', error);
        res.status(500).json({ error: 'Failed to fetch tickets' });
    }
});

/**
 * PATCH /api/super/tickets/:id
 * Update ticket status
 */
router.patch('/tickets/:id', verifySuperAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { status, assigned_to, priority } = req.body;

        const updates = [];
        const params = [id];
        let paramCount = 1;

        if (status) {
            paramCount++;
            updates.push(`status = $${paramCount} `);
            params.push(status);

            if (status === 'resolved' || status === 'closed') {
                paramCount++;
                updates.push(`resolved_at = NOW()`);
            }
        }

        if (assigned_to) {
            paramCount++;
            updates.push(`assigned_to = $${paramCount} `);
            params.push(assigned_to);
        }

        if (priority) {
            paramCount++;
            updates.push(`priority = $${paramCount} `);
            params.push(priority);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No updates provided' });
        }

        const query = `UPDATE platform_support_tickets SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $1 RETURNING * `;
        const result = await pool.controlPool.query(query, params);

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating ticket:', error);
        res.status(500).json({ error: 'Failed to update ticket' });
    }
});

// ═══════════════════════════════════════════════════════════════
// CLINIC PERSONNEL & ACCESS MANAGEMENT
// ═══════════════════════════════════════════════════════════════

/**
 * Clinic Personnel Route (Moved up)
 */

/**
 * POST /api/super/clinics/:id/users/:userId/reset-password
 * Reset a clinic user's password (by Platform Admin)
 */
router.post('/clinics/:id/users/:userId/reset-password', verifySuperAdmin, async (req, res) => {
    try {
        const { id, userId } = req.params;
        const { newPassword } = req.body;

        if (!newPassword || newPassword.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters' });
        }

        // 1. Get clinic schema
        const clinicRes = await pool.controlPool.query('SELECT schema_name FROM clinics WHERE id = $1', [id]);
        if (clinicRes.rows.length === 0) return res.status(404).json({ error: 'Clinic not found' });
        const { schema_name } = clinicRes.rows[0];

        // 2. Hash new password
        const bcrypt = require('bcryptjs');
        const hash = await bcrypt.hash(newPassword, 10);

        // 3. Update in tenant schema
        await pool.controlPool.query(`
            UPDATE ${schema_name}.users SET password_hash = $1, updated_at = NOW() WHERE id = $2
            `, [hash, userId]);

        // 4. Log the action
        // 4. Log the action
        await AuditService.log(null, 'user_password_reset_by_admin', id, { userId });

        res.json({ message: 'Password reset successfully' });
    } catch (error) {
        console.error('Error resetting user password:', error);
        res.status(500).json({ error: 'Failed to reset password' });
    }
});

/**
 * PATCH /api/super/clinics/:id/users/:userId/status
 * Enable/Disable a clinic user
 */
router.patch('/clinics/:id/users/:userId/status', verifySuperAdmin, async (req, res) => {
    try {
        const { id, userId } = req.params;
        const { status } = req.body; // 'active' or 'suspended'

        const clinicRes = await pool.controlPool.query('SELECT schema_name FROM clinics WHERE id = $1', [id]);
        const { schema_name } = clinicRes.rows[0];

        await pool.controlPool.query(`
            UPDATE ${schema_name}.users SET status = $1, updated_at = NOW() WHERE id = $2
            `, [status, userId]);

        res.json({ message: `User status updated to ${status} ` });
    } catch (error) {
        console.error('Error updating user status:', error);
        res.status(500).json({ error: 'Failed to update user status' });
    }
});

// ═══════════════════════════════════════════════════════════════
// ANALYTICS & REPORTING
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/super/dashboard
 * Platform overview dashboard
 */
router.get('/dashboard', verifySuperAdmin, async (req, res) => {
    try {
        // clinics stats
        const clinicsStats = await pool.controlPool.query(`
        SELECT status, COUNT(*) as count FROM clinics GROUP BY status
            `);

        // Active subscriptions (stub)
        const subscriptionStats = { rows: [] };

        // Revenue this month (stub)
        const revenue = { rows: [{ total: 0, transactions: 0 }] };

        // Open support tickets
        const tickets = await pool.controlPool.query(`
        SELECT status, COUNT(*) as count 
        FROM platform_support_tickets 
        WHERE status IN ('open', 'in_progress')
        GROUP BY status
            `);

        // Recent activity
        const recentClinics = await pool.controlPool.query(`
      SELECT id, display_name, slug, created_at, status
      FROM clinics
      ORDER BY created_at DESC
      LIMIT 5
            `);

        res.json({
            clinics: clinicsStats.rows,
            subscriptions: subscriptionStats.rows,
            revenue: revenue.rows[0],
            support_tickets: tickets.rows,
            recent_clinics: recentClinics.rows
        });
    } catch (error) {
        console.error('Error fetching dashboard:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard data' });
    }
});

/**
 * POST /api/super/clinics/:id/impersonate
 * Generate a short-lived impersonation token for a clinic user
 */
router.post('/clinics/:id/impersonate', verifySuperAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { userId, reason } = req.body;

        if (!reason) {
            return res.status(400).json({ error: 'Access reason is required for audit' });
        }

        // 1. Verify target user is NOT another platform admin (unless specifically allowed)
        // We check against the super_admins table
        const targetAdminCheck = await pool.controlPool.query('SELECT id FROM super_admins WHERE id = $1', [userId]);
        if (targetAdminCheck.rows.length > 0) {
            return res.status(403).json({ error: 'Cannot impersonate another Platform Administrator' });
        }

        // 2. Generate a secure random token
        const crypto = require('crypto');
        const token = crypto.randomBytes(32).toString('hex');

        // 3. Create impersonation record
        await pool.controlPool.query(`
            INSERT INTO platform_impersonation_tokens
            (admin_id, target_clinic_id, target_user_id, token, reason, expires_at)
        VALUES($1, $2, $3, $4, $5, NOW() + INTERVAL '15 minutes')
            `, [req.platformAdmin.id, id, userId, token, reason]);

        // 4. Log the "Break Glass" event
        // 4. Log the "Break Glass" event
        await AuditService.log(null, 'impersonation_initiated', id, {
            targetUserId: userId,
            reason,
            adminEmail: req.platformAdmin.email,
            expiresAt: new Date(Date.now() + 15 * 60000).toISOString()
        });

        res.json({ token });
    } catch (error) {
        console.error('Error initiating impersonation:', error);
        res.status(500).json({ error: 'Failed to initiate impersonation session' });
    }
});

/**
 * ROLE GOVERNANCE & TEMPLATES
 */

/**
 * GET /api/super/governance/roles
 * List all global role templates
 */
router.get('/governance/roles', verifySuperAdmin, async (req, res) => {
    try {
        const templates = await pool.controlPool.query(`
            SELECT t.*,
            COALESCE(json_agg(tp.privilege_name) FILTER(WHERE tp.privilege_name IS NOT NULL), '[]') as privilege_set
            FROM platform_role_templates t
            LEFT JOIN platform_role_template_privileges tp ON t.id = tp.template_id
            GROUP BY t.id
            ORDER BY t.role_key
            `);
        res.json(templates.rows);
    } catch (error) {
        console.error('Error fetching role templates:', error);
        res.status(500).json({ error: 'Failed to fetch role templates' });
    }
});

/**
 * POST /api/super/governance/roles
 * Create a new global role template
 */
router.post('/governance/roles', verifySuperAdmin, async (req, res) => {
    const client = await pool.controlPool.connect();
    try {
        await client.query('BEGIN');
        const { role_key, display_name, description, version, privileges } = req.body;

        // 1. Create Template
        const templateRes = await client.query(`
            INSERT INTO platform_role_templates(role_key, display_name, description, version)
        VALUES($1, $2, $3, $4)
            RETURNING id
            `, [role_key, display_name, description, version || '1.0']);
        const templateId = templateRes.rows[0].id;

        // 2. Add Privileges
        if (privileges && privileges.length > 0) {
            for (const priv of privileges) {
                await client.query(`
                    INSERT INTO platform_role_template_privileges(template_id, privilege_name)
        VALUES($1, $2)
            `, [templateId, priv]);
            }
        }

        await AuditService.log(client, 'ROLE_TEMPLATE_CREATED', null, {
            role_key, display_name, privileges
        });

        await client.query('COMMIT');
        res.status(201).json({ id: templateId, message: 'Role template created' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error creating role template:', error);
        res.status(500).json({ error: error.message || 'Failed to create role template' });
    } finally {
        client.release();
    }
});

/**
 * PUT /api/super/governance/roles/:id
 * Update an existing global role template
 */
router.put('/governance/roles/:id', verifySuperAdmin, async (req, res) => {
    const client = await pool.controlPool.connect();
    try {
        await client.query('BEGIN');
        const { id } = req.params;
        const { role_key, display_name, description, version, privileges } = req.body;

        // 1. Update Template Metadata
        await client.query(`
            UPDATE platform_role_templates
            SET role_key = $1, display_name = $2, description = $3, version = $4, updated_at = NOW()
            WHERE id = $5
            `, [role_key, display_name, description, version, id]);

        // 2. Update Privileges (Delete all + Re-insert is simplest/ safest for full sync)
        await client.query('DELETE FROM platform_role_template_privileges WHERE template_id = $1', [id]);

        if (privileges && privileges.length > 0) {
            for (const priv of privileges) {
                await client.query(`
                    INSERT INTO platform_role_template_privileges(template_id, privilege_name)
        VALUES($1, $2)
                `, [id, priv]);
            }
        }

        await AuditService.log(client, 'ROLE_TEMPLATE_UPDATED', null, {
            id, role_key, display_name
        });

        await client.query('COMMIT');
        res.json({ message: 'Role template updated successfully' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error updating role template:', error);
        res.status(500).json({ error: error.message || 'Failed to update role template' });
    } finally {
        client.release();
    }
});

/**
 * DELETE /api/super/governance/roles/:id
 * Delete a global role template
 */
router.delete('/governance/roles/:id', verifySuperAdmin, async (req, res) => {
    const client = await pool.controlPool.connect();
    try {
        await client.query('BEGIN');
        const { id } = req.params;

        // 1. Delete Privileges
        await client.query('DELETE FROM platform_role_template_privileges WHERE template_id = $1', [id]);

        // 2. Delete Template
        await client.query('DELETE FROM platform_role_templates WHERE id = $1', [id]);

        await AuditService.log(client, 'ROLE_TEMPLATE_DELETED', null, { id });

        await client.query('COMMIT');
        res.json({ message: 'Role template deleted successfully' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error deleting role template:', error);
        res.status(500).json({ error: error.message || 'Failed to delete role template' });
    } finally {
        client.release();
    }
});

/**
 * GET /api/super/clinics/:id/governance/drift
 * Detect permission drift for a specific clinic
 */
router.get('/clinics/:id/governance/drift', verifySuperAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const drift = await governanceService.detectDrift(id);
        res.json({ clinicId: id, drift });
    } catch (error) {
        console.error('Error detecting drift:', error);
        res.status(500).json({ error: error.message || 'Failed to detect permission drift' });
    }
});

/**
 * POST /api/super/clinics/:id/governance/sync
 */
router.post('/clinics/:id/governance/sync', verifySuperAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { roleKey } = req.body;

        if (!roleKey) return res.status(400).json({ error: 'roleKey is required' });

        const result = await governanceService.syncRole(id, roleKey, req.platformAdmin.id);
        res.json({ message: `Role ${roleKey} synced successfully`, ...result });
    } catch (error) {
        console.error('Error syncing role:', error);
        if (error.message === 'SYNC_IN_PROGRESS') {
            return res.status(429).json({ error: 'Sync in progress for this clinic. Please wait.' });
        }
        res.status(500).json({ error: error.message || 'Failed to sync role' });
    }
});

/**
 * GET /api/super/audit/verify
 * Verify the cryptographic integrity of the audit log chain
 */
router.get('/audit/verify', verifySuperAdmin, async (req, res) => {
    try {
        const result = await AuditService.verifyChain();
        res.json(result);
    } catch (error) {
        console.error('Error verifying audit chain:', error);
        res.status(500).json({ error: 'Failed to verify audit chain' });
    }
});

/**
 * Audit Logs Retrieval
 */

/**
 * GET /api/super/audit-logs
 * List all platform-level audit logs
 */
router.get('/audit-logs', verifySuperAdmin, async (req, res) => {
    try {
        const { limit = 100, offset = 0 } = req.query;
        const result = await pool.controlPool.query(`
            SELECT pal.*, c.display_name as clinic_name, c.slug as clinic_slug
            FROM platform_audit_logs pal
            LEFT JOIN clinics c ON pal.target_clinic_id = c.id
            ORDER BY pal.created_at DESC
            LIMIT $1 OFFSET $2
            `, [parseInt(limit), parseInt(offset)]);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching platform audit logs:', error);
        res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
});

/**
 * GET /api/super/clinics/:id/audit-logs
 * List audit logs for a specific clinic
 */
router.get('/clinics/:id/audit-logs', verifySuperAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { limit = 50 } = req.query;
        const result = await pool.controlPool.query(`
        SELECT * FROM platform_audit_logs
            WHERE target_clinic_id = $1
            ORDER BY created_at DESC
            LIMIT $2
            `, [id, parseInt(limit)]);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching clinic audit logs:', error);
        res.status(500).json({ error: 'Failed to fetch clinic audit logs' });
    }
});

// ═══════════════════════════════════════════════════════════════
// SUPPORT TICKETS MANAGEMENT
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/super/support-tickets
 * List all support tickets with filtering
 */
router.get('/support-tickets', verifySuperAdmin, async (req, res) => {
    try {
        const { status = 'all', priority, limit = 50, offset = 0 } = req.query;

        let query = `
            SELECT st.*, c.display_name as clinic_name, c.slug as clinic_slug
            FROM platform_support_tickets st
            LEFT JOIN clinics c ON st.clinic_id = c.id
            `;
        const params = [];
        const conditions = [];

        if (status !== 'all') {
            params.push(status);
            conditions.push(`st.status = $${params.length} `);
        }

        if (priority) {
            params.push(priority);
            conditions.push(`st.priority = $${params.length} `);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        query += ' ORDER BY st.created_at DESC';
        params.push(parseInt(limit));
        query += ` LIMIT $${params.length} `;
        params.push(parseInt(offset));
        query += ` OFFSET $${params.length} `;

        const result = await pool.controlPool.query(query, params);

        // Get total count
        let countQuery = 'SELECT COUNT(*) FROM platform_support_tickets st';
        if (conditions.length > 0) {
            countQuery += ' WHERE ' + conditions.join(' AND ');
        }
        const countResult = await pool.controlPool.query(countQuery, params.slice(0, conditions.length));

        res.json({
            tickets: result.rows,
            total: parseInt(countResult.rows[0].count),
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
    } catch (error) {
        console.error('Error fetching support tickets:', error);
        res.status(500).json({ error: 'Failed to fetch support tickets' });
    }
});

/**
 * GET /api/super/support-tickets/:id
 * Get a single support ticket with full context
 */
router.get('/support-tickets/:id', verifySuperAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.controlPool.query(`
            SELECT st.*, c.display_name as clinic_name, c.slug as clinic_slug
            FROM platform_support_tickets st
            LEFT JOIN clinics c ON st.clinic_id = c.id
            WHERE st.id = $1
            `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Ticket not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching support ticket:', error);
        res.status(500).json({ error: 'Failed to fetch support ticket' });
    }
});

/**
 * PATCH /api/super/support-tickets/:id
 * Update ticket status
 */
router.patch('/support-tickets/:id', verifySuperAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { status, notes } = req.body;

        const result = await pool.controlPool.query(`
            UPDATE platform_support_tickets
            SET status = COALESCE($1, status),
            updated_at = NOW()
            WHERE id = $2
        RETURNING *
            `, [status, id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Ticket not found' });
        }

        // Log the action (non-blocking, don't fail if logging fails)
        try {
            await AuditService.log(
                req.platformAdmin.id,
                'support_ticket_updated',
                result.rows[0].clinic_id,
                { ticketId: id, newStatus: status, notes }
            );
        } catch (auditErr) {
            console.warn('Audit logging failed for ticket update:', auditErr.message);
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating support ticket:', error);
        res.status(500).json({ error: 'Failed to update support ticket' });
    }
});

/**
 * GET /api/super/support-tickets/stats
 * Get ticket statistics
 */
router.get('/support-stats', verifySuperAdmin, async (req, res) => {
    try {
        const result = await pool.controlPool.query(`
        SELECT
        COUNT(*) FILTER(WHERE status = 'open') as open_count,
            COUNT(*) FILTER(WHERE status = 'in_progress') as in_progress_count,
                COUNT(*) FILTER(WHERE status = 'resolved') as resolved_count,
                    COUNT(*) FILTER(WHERE priority = 'critical' AND status = 'open') as critical_open,
                        COUNT(*) FILTER(WHERE priority = 'high' AND status = 'open') as high_open,
                            COUNT(*) as total
            FROM platform_support_tickets
            `);

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching support stats:', error);
        res.status(500).json({ error: 'Failed to fetch support stats' });
    }
});

module.exports = router;
