const express = require('express');
const pool = require('../db');
const tenantManager = require('../services/tenantManager');

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
        cs.status as subscription_status,
        cs.current_period_end,
        sp.name as plan_name,
        sp.price_monthly,
        COUNT(DISTINCT st.id) FILTER (WHERE st.status IN ('open', 'in_progress')) as open_tickets
      FROM clinics c
      LEFT JOIN clinic_subscriptions cs ON c.id = cs.clinic_id
      LEFT JOIN subscription_plans sp ON cs.plan_id = sp.id
      LEFT JOIN support_tickets st ON c.id = st.clinic_id
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

        query += ' GROUP BY c.id, cs.id, sp.id ORDER BY c.created_at DESC';

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
        cs.status as subscription_status,
        cs.billing_cycle,
        cs.current_period_start,
        cs.current_period_end,
        cs.trial_end_date,
        sp.name as plan_name,
        sp.price_monthly,
        sp.price_yearly
      FROM clinics c
      LEFT JOIN clinic_subscriptions cs ON c.id = cs.clinic_id
      LEFT JOIN subscription_plans sp ON cs.plan_id = sp.id
      WHERE c.id = $1
    `, [id]);

        if (clinic.rows.length === 0) {
            return res.status(404).json({ error: 'Clinic not found' });
        }

        // Get recent usage metrics
        const usage = await pool.controlPool.query(`
      SELECT * FROM clinic_usage_metrics
      WHERE clinic_id = $1
      ORDER BY metric_date DESC
      LIMIT 30
    `, [id]);

        // Get payment history
        const payments = await pool.controlPool.query(`
      SELECT * FROM payment_history
      WHERE clinic_id = $1
      ORDER BY created_at DESC
      LIMIT 10
    `, [id]);

        res.json({
            clinic: clinic.rows[0],
            usage: usage.rows,
            recent_payments: payments.rows
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
        console.log(`[SuperAdmin] Request for clinic users. ID: ${id}`);

        // 1. Get clinic schema
        const clinicRes = await pool.controlPool.query('SELECT schema_name FROM clinics WHERE id = $1', [id]);
        if (clinicRes.rows.length === 0) {
            console.warn(`[SuperAdmin] Clinic not found during user list request: ${id}`);
            return res.status(404).json({ error: 'Clinic not found' });
        }

        const { schema_name } = clinicRes.rows[0];
        console.log(`[SuperAdmin] Found schema: ${schema_name} for clinic: ${id}`);

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
        await pool.controlPool.query(`
      INSERT INTO platform_audit_logs (action, target_clinic_id, details)
      VALUES ($1, $2, $3)
    `, [`clinic_${status}`, id, JSON.stringify({ reason })]);

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
            compliance_zone,
            region
        } = req.body;

        const updates = [];
        const params = [id];
        let pCount = 1;

        const allowedKeys = {
            is_read_only: 'boolean',
            billing_locked: 'boolean',
            prescribing_locked: 'boolean',
            emr_version: 'string',
            tenant_type: 'string',
            compliance_zone: 'string',
            region: 'string'
        };

        for (const [key, type] of Object.entries(allowedKeys)) {
            if (req.body[key] !== undefined) {
                pCount++;
                updates.push(`${key} = $${pCount}`);
                params.push(req.body[key]);
            }
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No valid update fields provided' });
        }

        const query = `UPDATE clinics SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $1 RETURNING *`;
        const result = await pool.controlPool.query(query, params);

        // Log the control change
        await pool.controlPool.query(`
            INSERT INTO platform_audit_logs (action, target_clinic_id, details)
            VALUES ($1, $2, $3)
        `, ['clinic_controls_updated', id, JSON.stringify(req.body)]);

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating clinic controls:', error);
        res.status(500).json({ error: 'Failed to update clinic controls' });
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
        INSERT INTO clinic_subscriptions (clinic_id, plan_id, status, trial_end_date, current_period_start, current_period_end)
        VALUES ($1, $2, 'trial', NOW() + INTERVAL '30 days', NOW(), NOW() + INTERVAL '30 days')
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
      INSERT INTO payment_history (clinic_id, amount, payment_method, transaction_id, description, status, paid_at)
      VALUES ($1, $2, $3, $4, $5, 'completed', NOW())
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
      FROM support_tickets st
      JOIN clinics c ON st.clinic_id = c.id
    `;

        const conditions = [];
        const params = [];

        if (status) {
            conditions.push(`st.status = $${params.length + 1}`);
            params.push(status);
        }

        if (priority) {
            conditions.push(`st.priority = $${params.length + 1}`);
            params.push(priority);
        }

        if (clinic_id) {
            conditions.push(`st.clinic_id = $${params.length + 1}`);
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
            updates.push(`status = $${paramCount}`);
            params.push(status);

            if (status === 'resolved' || status === 'closed') {
                paramCount++;
                updates.push(`resolved_at = NOW()`);
            }
        }

        if (assigned_to) {
            paramCount++;
            updates.push(`assigned_to = $${paramCount}`);
            params.push(assigned_to);
        }

        if (priority) {
            paramCount++;
            updates.push(`priority = $${paramCount}`);
            params.push(priority);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No updates provided' });
        }

        const query = `UPDATE support_tickets SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $1 RETURNING *`;
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
        await pool.controlPool.query(`
            INSERT INTO platform_audit_logs (action, target_clinic_id, details)
            VALUES ($1, $2, $3)
        `, ['user_password_reset_by_admin', id, JSON.stringify({ userId })]);

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

        res.json({ message: `User status updated to ${status}` });
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
        // Total clinics by status
        const clinicsStats = await pool.controlPool.query(`
      SELECT 
        status,
        COUNT(*) as count
      FROM clinics
      GROUP BY status
    `);

        // Active subscriptions
        const subscriptionStats = await pool.controlPool.query(`
      SELECT 
        status,
        COUNT(*) as count
      FROM clinic_subscriptions
      GROUP BY status
    `);

        // Revenue this month
        const revenue = await pool.controlPool.query(`
      SELECT 
        SUM(amount) as total,
        COUNT(*) as transactions
      FROM payment_history
      WHERE paid_at >= DATE_TRUNC('month', NOW())
        AND status = 'completed'
    `);

        // Open support tickets
        const tickets = await pool.controlPool.query(`
      SELECT 
        status,
        COUNT(*) as count
      FROM support_tickets
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

        // 1. Generate a secure random token
        const crypto = require('crypto');
        const token = crypto.randomBytes(32).toString('hex');

        // 2. Create impersonation record
        await pool.controlPool.query(`
            INSERT INTO platform_impersonation_tokens 
            (admin_id, target_clinic_id, target_user_id, token, reason, expires_at)
            VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '15 minutes')
        `, [req.platformAdmin.id, id, userId, token, reason]);

        // 3. Log the "Break Glass" event
        await pool.controlPool.query(`
            INSERT INTO platform_audit_logs (action, target_clinic_id, details)
            VALUES ($1, $2, $3)
        `, ['impersonation_initiated', id, JSON.stringify({ userId, reason, adminEmail: req.platformAdmin.email })]);

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
                   COALESCE(json_agg(tp.privilege_name) FILTER (WHERE tp.privilege_name IS NOT NULL), '[]') as privileges
            FROM platform_role_templates t
            LEFT JOIN platform_role_template_privileges tp ON t.id = tp.template_id
            GROUP BY t.id
            ORDER BY t.name
        `);
        res.json(templates.rows);
    } catch (error) {
        console.error('Error fetching role templates:', error);
        res.status(500).json({ error: 'Failed to fetch role templates' });
    }
});

/**
 * GET /api/super/clinics/:id/governance/drift
 * Detect permission drift for a specific clinic
 */
router.get('/clinics/:id/governance/drift', verifySuperAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        // 1. Get clinic info (schema name)
        const clinicRes = await pool.controlPool.query('SELECT schema_name FROM clinics WHERE id = $1', [id]);
        if (clinicRes.rows.length === 0) return res.status(404).json({ error: 'Clinic not found' });
        const schema = clinicRes.rows[0].schema_name;

        // 2. Fetch global templates
        const templatesRes = await pool.controlPool.query(`
            SELECT t.name as template_name, tp.privilege_name
            FROM platform_role_templates t
            JOIN platform_role_template_privileges tp ON t.id = tp.template_id
        `);

        // 3. Fetch clinic's actual roles and privileges
        const clinicRolesRes = await pool.controlPool.query(`
            SELECT r.name as role_name, p.name as privilege_name
            FROM ${schema}.roles r
            JOIN ${schema}.role_privileges rp ON r.id = rp.role_id
            JOIN ${schema}.privileges p ON rp.privilege_id = p.id
        `);

        // 4. Calculate drift
        const templates = {};
        templatesRes.rows.forEach(r => {
            if (!templates[r.template_name]) templates[r.template_name] = new Set();
            templates[r.template_name].add(r.privilege_name);
        });

        const clinicRoles = {};
        clinicRolesRes.rows.forEach(r => {
            if (!clinicRoles[r.role_name]) clinicRoles[r.role_name] = new Set();
            clinicRoles[r.role_name].add(r.privilege_name);
        });

        const driftReports = [];
        for (const [tplName, tplPrivs] of Object.entries(templates)) {
            const actualPrivs = clinicRoles[tplName];

            if (!actualPrivs) {
                driftReports.push({
                    roleName: tplName,
                    status: 'missing',
                    missingPrivileges: Array.from(tplPrivs),
                    extraPrivileges: []
                });
                continue;
            }

            const missing = Array.from(tplPrivs).filter(p => !actualPrivs.has(p));
            const extra = Array.from(actualPrivs).filter(p => !tplPrivs.has(p));

            if (missing.length > 0 || extra.length > 0) {
                driftReports.push({
                    roleName: tplName,
                    status: 'drifted',
                    missingPrivileges: missing,
                    extraPrivileges: extra
                });
            } else {
                driftReports.push({
                    roleName: tplName,
                    status: 'synced',
                    missingPrivileges: [],
                    extraPrivileges: []
                });
            }
        }

        res.json({ clinicId: id, drift: driftReports });
    } catch (error) {
        console.error('Error detecting drift:', error);
        res.status(500).json({ error: 'Failed to detect permission drift' });
    }
});

/**
 * POST /api/super/clinics/:id/governance/sync
 * Repair/Sync a specific role in a clinic to match the global template
 */
router.post('/clinics/:id/governance/sync', verifySuperAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { roleName } = req.body;

        if (!roleName) return res.status(400).json({ error: 'Role name required' });

        const clinicRes = await pool.controlPool.query('SELECT schema_name FROM clinics WHERE id = $1', [id]);
        if (clinicRes.rows.length === 0) return res.status(404).json({ error: 'Clinic not found' });
        const schema = clinicRes.rows[0].schema_name;

        const tplRes = await pool.controlPool.query(`
            SELECT tp.privilege_name
            FROM platform_role_templates t
            JOIN platform_role_template_privileges tp ON t.id = tp.template_id
            WHERE t.name = $1
        `, [roleName]);

        if (tplRes.rows.length === 0) return res.status(404).json({ error: 'Template not found' });
        const targetPrivs = tplRes.rows.map(r => r.privilege_name);

        await pool.controlPool.query('BEGIN');

        try {
            let rRes = await pool.controlPool.query(`SELECT id FROM ${schema}.roles WHERE name = $1`, [roleName]);
            let roleId;
            if (rRes.rows.length === 0) {
                const newRole = await pool.controlPool.query(`INSERT INTO ${schema}.roles (name, description) VALUES ($1, $2) RETURNING id`, [roleName, `Synced from Global Template: ${roleName}`]);
                roleId = newRole.rows[0].id;
            } else {
                roleId = rRes.rows[0].id;
            }

            await pool.controlPool.query(`DELETE FROM ${schema}.role_privileges WHERE role_id = $1`, [roleId]);

            for (const pName of targetPrivs) {
                const pRes = await pool.controlPool.query(`SELECT id FROM ${schema}.privileges WHERE name = $1`, [pName]);
                if (pRes.rows.length > 0) {
                    await pool.controlPool.query(`
                        INSERT INTO ${schema}.role_privileges (role_id, privilege_id) 
                        VALUES ($1, $2)
                    `, [roleId, pRes.rows[0].id]);
                }
            }

            await pool.controlPool.query(`
                INSERT INTO platform_audit_logs (action, target_clinic_id, details)
                VALUES ($1, $2, $3)
            `, ['role_template_synced', id, JSON.stringify({ roleName, adminEmail: req.platformAdmin.email })]);

            await pool.controlPool.query('COMMIT');
            res.json({ message: `Role ${roleName} synced successfully` });
        } catch (innerError) {
            await pool.controlPool.query('ROLLBACK');
            throw innerError;
        }
    } catch (error) {
        console.error('Error syncing role:', error);
        res.status(500).json({ error: 'Failed to sync role' });
    }
});

module.exports = router;
