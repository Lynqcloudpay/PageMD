const express = require('express');
const pool = require('../db');
const tenantManager = require('../services/tenantManager');
const governanceService = require('../services/governanceService');
const AuditService = require('../services/auditService');

const router = express.Router();


// Middleware to verify Platform Admin authentication
const verifySuperAdmin = async (req, res, next) => {
    const token = req.headers['x-platform-token'];

    console.log(`[SuperAdminAuth] Verifying token for ${req.method} ${req.originalUrl}`);
    console.log(`[SuperAdminAuth] Token received: ${token ? 'PRESENT' : 'MISSING'}`);

    if (!token) {
        console.warn('[SuperAdminAuth] 401: No X-Platform-Token header');
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
            console.warn(`[SuperAdminAuth] 401: Invalid or expired token: ${token.substring(0, 8)}...`);
            return res.status(401).json({ error: 'Invalid or expired session' });
        }

        // Attach admin info to request
        req.platformAdmin = result.rows[0];
        console.log(`[SuperAdminAuth] 200: Authenticated as ${req.platformAdmin.email}`);
        next();
    } catch (error) {
        console.error('[SuperAdminAuth] 500: Auth verification error:', error);
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
                c.stripe_subscription_status as subscription_status,
                c.current_period_end,
                c.billing_locked,
                c.last_payment_at,
                CASE 
                    WHEN c.stripe_subscription_status = 'active' THEN 'Active Subscription'
                    WHEN c.stripe_subscription_status = 'trialing' THEN 'Trial'
                    WHEN c.stripe_subscription_status IS NULL THEN 'No Subscription'
                    ELSE COALESCE(c.stripe_subscription_status, 'Free')
                END as plan_name,
                (SELECT SUM(amount_total) FROM platform_billing_events WHERE clinic_id = c.id AND event_type = 'payment_succeeded') as total_revenue,
                (SELECT created_at FROM platform_billing_events WHERE clinic_id = c.id AND event_type = 'payment_succeeded' ORDER BY created_at DESC LIMIT 1) as last_payment_date,
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
        c.billing_grace_phase,
        c.billing_grace_start_at,
        c.billing_manual_override,
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

        const clinicData = clinic.rows[0];

        // Stubbed recent usage metrics
        const usage = [];

        // Fetch real payment history for the overview
        const paymentsRes = await pool.controlPool.query(`
            SELECT * FROM platform_billing_events 
            WHERE clinic_id = $1 
            ORDER BY created_at DESC 
            LIMIT 5
        `, [id]);
        const payments = paymentsRes.rows.map(p => ({
            amount: (p.amount_total / 100).toFixed(2),
            status: p.status,
            created_at: p.created_at
        }));

        // 3. Growth Stats (Referrals & Ghost Seats)
        const ghostRes = await pool.controlPool.query(`
            SELECT count(*) FROM public.clinic_referrals 
            WHERE referrer_clinic_id = $1 
            AND (status = 'active' OR (status = 'churned' AND grace_period_expires_at > NOW()))
        `, [id]);
        const ghostSeats = parseInt(ghostRes.rows[0].count) || 0;

        const activeReferrals = await pool.controlPool.query(`
            SELECT * FROM public.clinic_referrals WHERE referrer_clinic_id = $1 ORDER BY created_at DESC
        `, [id]);

        // 4. Physical Seats (Count of provider-level users in this clinic's schema)
        let physicalSeats = 1;
        try {
            const schemaName = clinicData.schema_name;
            if (schemaName) {
                const usersRes = await pool.controlPool.query(`
                    SELECT count(*) FROM ${schemaName}.users 
                    WHERE status = 'active' 
                    AND UPPER(role) IN ('CLINICIAN', 'PHYSICIAN', 'DOCTOR', 'NP', 'PROVIDER', 'PA', 'NURSE PRACTITIONER')
                `);
                physicalSeats = parseInt(usersRes.rows[0].count) || 1;
            }
        } catch (e) {
            console.warn(`[SuperAdmin] Could not count physical seats for clinic ${id}:`, e.message);
        }

        // 5. Calculate Billing Tier (Staircase Model)
        const TIERS = [
            { name: 'Solo', min: 1, max: 1, rate: 399 },
            { name: 'Partner', min: 2, max: 3, rate: 299 },
            { name: 'Professional', min: 4, max: 5, rate: 249 },
            { name: 'Premier', min: 6, max: 8, rate: 199 },
            { name: 'Elite', min: 9, max: 10, rate: 149 },
            { name: 'Enterprise', min: 11, max: 999, rate: 99 },
        ];

        const totalBillingSeats = physicalSeats + ghostSeats;

        // Calculate total monthly using Average Cost methodology
        let virtualTotal = 0;
        for (let i = 1; i <= totalBillingSeats; i++) {
            const tier = TIERS.find(t => i >= t.min && i <= t.max) || TIERS[TIERS.length - 1];
            virtualTotal += tier.rate;
        }

        const avgRatePerSeat = totalBillingSeats > 0 ? virtualTotal / totalBillingSeats : 399;
        const totalMonthly = Math.round(physicalSeats * avgRatePerSeat);

        console.log(`[SuperAdmin-Billing] Clinic: ${id}, Physical: ${physicalSeats}, Ghost: ${ghostSeats}, Virtual Total: ${virtualTotal}, Avg Rate: ${avgRatePerSeat}, Final: ${totalMonthly}`);

        const currentTier = TIERS.find(t => totalBillingSeats >= t.min && totalBillingSeats <= t.max) || TIERS[TIERS.length - 1];
        const displayAvgRate = Math.round(avgRatePerSeat);

        res.json({
            clinic: clinicData,
            usage: usage,
            recent_payments: payments,
            growth: {
                ghostSeats,
                referrals: activeReferrals.rows
            },
            billing: {
                physicalSeats,
                ghostSeats,
                totalBillingSeats,
                currentTier: currentTier.name,
                marginalRate: currentTier.rate,
                avgRatePerSeat: parseFloat(avgRatePerSeat.toFixed(2)),
                totalMonthly,
                virtualTotal,
                tiers: TIERS
            }
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
 * GET /api/super/clinics/:id/billing
 * Get billing history and payment events for a specific clinic
 */
router.get('/clinics/:id/billing', verifySuperAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        // Get clinic billing info
        const clinicRes = await pool.controlPool.query(`
            SELECT 
                id, display_name, slug,
                stripe_customer_id, stripe_subscription_id, stripe_subscription_status,
                current_period_end, billing_locked, last_payment_at, status,
                billing_grace_phase, billing_grace_start_at, billing_manual_override
            FROM clinics WHERE id = $1
        `, [id]);

        if (clinicRes.rows.length === 0) {
            return res.status(404).json({ error: 'Clinic not found' });
        }

        const clinic = clinicRes.rows[0];

        // Get local payment history
        const eventsRes = await pool.controlPool.query(`
            SELECT * FROM platform_billing_events 
            WHERE clinic_id = $1 
            ORDER BY created_at DESC 
            LIMIT 50
        `, [id]);

        // Calculate totals from local events
        const totalsRes = await pool.controlPool.query(`
            SELECT 
                COALESCE(SUM(amount_total), 0) as total_revenue,
                COUNT(*) as payment_count
            FROM platform_billing_events 
            WHERE clinic_id = $1 AND event_type = 'payment_succeeded'
        `, [id]);

        // Also pull real Stripe invoices if customer exists
        let stripeInvoices = [];
        if (clinic.stripe_customer_id) {
            try {
                const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
                const invoices = await stripe.invoices.list({
                    customer: clinic.stripe_customer_id,
                    limit: 50,
                });
                stripeInvoices = invoices.data.map(inv => ({
                    id: inv.id,
                    date: inv.created ? new Date(inv.created * 1000).toISOString() : null,
                    amount: inv.amount_paid || inv.total || 0,
                    amountDollars: ((inv.amount_paid || inv.total || 0) / 100).toFixed(2),
                    status: inv.status,
                    paid: inv.status === 'paid',
                    invoiceUrl: inv.hosted_invoice_url,
                    invoicePdf: inv.invoice_pdf,
                    description: inv.description || 'Subscription invoice',
                    periodStart: inv.period_start ? new Date(inv.period_start * 1000).toISOString() : null,
                    periodEnd: inv.period_end ? new Date(inv.period_end * 1000).toISOString() : null,
                }));
            } catch (stripeErr) {
                console.error('[SuperAdmin] Failed to fetch Stripe invoices:', stripeErr.message);
            }
        }
        // Get dunning logs
        const dunningLogsRes = await pool.controlPool.query(`
            SELECT * FROM clinic_dunning_logs 
            WHERE clinic_id = $1 
            ORDER BY created_at DESC
        `, [id]);

        res.json({
            clinic,
            events: eventsRes.rows,
            dunningLogs: dunningLogsRes.rows,
            stripeInvoices,
            totals: {
                totalRevenue: totalsRes.rows[0].total_revenue,
                totalRevenueDollars: (totalsRes.rows[0].total_revenue / 100).toFixed(2),
                paymentCount: parseInt(totalsRes.rows[0].payment_count) || 0
            }
        });
    } catch (error) {
        console.error('[SuperAdmin] Error fetching clinic billing:', error);
        res.status(500).json({ error: 'Failed to fetch billing history' });
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

        // Log the action (Phase 3: Secure Audit)
        await AuditService.log(null, `clinic_${status} `, id, { reason });

        // AUTOMATIC CHURN HANDLING
        // If the clinic is suspended/deactivated, update any referrals pointing TO this clinic.
        if (['suspended', 'deactivated'].includes(status)) {
            await pool.controlPool.query(`
                UPDATE clinic_referrals 
                SET status = 'churned', 
                    grace_period_expires_at = NOW() + INTERVAL '30 days',
                    updated_at = NOW()
                WHERE referred_clinic_id = $1
            `, [id]);
            console.log(`[SuperAdmin] Churned referrals for clinic ${id} (Soft Landing: 90 days)`);
        }
        // If reactivated, restore the referral status
        else if (status === 'active') {
            await pool.controlPool.query(`
                UPDATE clinic_referrals 
                SET status = 'active', 
                    grace_period_expires_at = NULL,
                    updated_at = NOW()
                WHERE referred_clinic_id = $1
            `, [id]);
            console.log(`[SuperAdmin] Restored referrals for clinic ${id}`);
        }

        res.json({ message: `Clinic ${status} successfully`, status });
    } catch (error) {
        console.error('Error updating clinic status:', error);
        res.status(500).json({ error: 'Failed to update clinic status' });
    }
});

/**
 * POST /api/super/clinics/:id/impersonate
 * Generate a one-time impersonation token for a clinic admin.
 */
router.post('/clinics/:id/impersonate', verifySuperAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        if (!reason) {
            return res.status(400).json({ error: 'Reason for impersonation is required for auditing.' });
        }

        // 1. Find the clinic and a target admin
        const clinicRes = await pool.controlPool.query('SELECT schema_name, display_name FROM clinics WHERE id = $1', [id]);
        if (clinicRes.rows.length === 0) return res.status(404).json({ error: 'Clinic not found' });

        const { schema_name, display_name } = clinicRes.rows[0];

        // 2. Find an active admin user in that clinic
        const userRes = await pool.controlPool.query(`
            SELECT id FROM ${schema_name}.users 
            WHERE role ILIKE 'admin' AND status = 'active'
            LIMIT 1
        `);

        if (userRes.rows.length === 0) {
            return res.status(404).json({ error: 'No active admin found in this clinic to impersonate.' });
        }

        const targetUserId = userRes.rows[0].id;
        const crypto = require('crypto');
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        // 3. Store in token table
        await pool.controlPool.query(`
            INSERT INTO platform_impersonation_tokens 
            (admin_id, target_clinic_id, target_user_id, token, reason, expires_at)
            VALUES ($1, $2, $3, $4, $5, $6)
        `, [req.platformAdmin.id, id, targetUserId, token, reason, expiresAt]);

        // 4. Log the audit event
        await pool.controlPool.query(`
            INSERT INTO audit_logs (admin_id, action, target_type, target_id, details)
            VALUES ($1, $2, $3, $4, $5)
        `, [req.platformAdmin.id, 'IMPERSONATION_TOKEN_GENERATED', 'clinic', id, JSON.stringify({ reason, targetUserId, clinicName: display_name })]);

        res.json({
            token,
            targetUserId,
            expiresAt,
            impersonateUrl: `/auth/impersonate?token=${token}`
        });

    } catch (error) {
        console.error('[SuperAdmin] Impersonation generation failed:', error);
        res.status(500).json({ error: 'Failed to generate impersonation token' });
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
            billing_manual_override: 'boolean',
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

// ═══════════════════════════════════════════════════════════════
// CLINIC SETUP & ONBOARDING (Platform Admin Access)
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/super/clinic-setup/:tenantId
 */
router.get('/clinic-setup/:tenantId', verifySuperAdmin, async (req, res) => {
    try {
        const { tenantId } = req.params;

        let checklist = await pool.controlPool.query(
            'SELECT * FROM clinic_setup_checklist WHERE tenant_id = $1',
            [tenantId]
        );

        if (checklist.rows.length === 0) {
            await pool.controlPool.query(
                'INSERT INTO clinic_setup_checklist (tenant_id) VALUES ($1)',
                [tenantId]
            );
            checklist = await pool.controlPool.query(
                'SELECT * FROM clinic_setup_checklist WHERE tenant_id = $1',
                [tenantId]
            );
        }

        const faxNumbers = await pool.controlPool.query(
            'SELECT * FROM clinic_fax_numbers WHERE tenant_id = $1 ORDER BY created_at',
            [tenantId]
        );

        const labInterfaces = await pool.controlPool.query(
            'SELECT * FROM clinic_lab_interfaces WHERE tenant_id = $1 ORDER BY lab_name',
            [tenantId]
        );

        const cl = checklist.rows[0];
        const items = [
            cl.basic_info_complete,
            cl.users_created,
            cl.fax_configured,
            cl.quest_configured || cl.labcorp_configured,
            cl.patient_portal_enabled,
            cl.billing_configured
        ];
        const completedCount = items.filter(Boolean).length;
        const completionPercent = Math.round((completedCount / items.length) * 100);

        res.json({
            checklist: checklist.rows[0],
            faxNumbers: faxNumbers.rows,
            labInterfaces: labInterfaces.rows,
            completionPercent,
            isComplete: completionPercent === 100
        });
    } catch (error) {
        console.error('[SUPER-ADMIN] Error getting setup:', error);
        res.status(500).json({ error: 'Failed to get clinic setup' });
    }
});

/**
 * PUT /api/super/clinic-setup/:tenantId
 */
router.put('/clinic-setup/:tenantId', verifySuperAdmin, async (req, res) => {
    try {
        const { tenantId } = req.params;
        const updates = req.body;
        const allowedFields = [
            'basic_info_complete', 'users_created', 'fax_configured',
            'quest_configured', 'labcorp_configured', 'patient_portal_enabled',
            'billing_configured', 'eprescribe_configured', 'onboarding_complete'
        ];

        const setClauses = [];
        const values = [];
        let paramIndex = 1;

        for (const [key, value] of Object.entries(updates)) {
            if (allowedFields.includes(key)) {
                setClauses.push(`${key} = $${paramIndex}`);
                values.push(value);
                paramIndex++;
                if (value === true) {
                    setClauses.push(`${key.replace('_complete', '_date').replace('_configured', '_date').replace('_enabled', '_date')} = CURRENT_TIMESTAMP`);
                }
            }
        }

        if (setClauses.length === 0) return res.status(400).json({ error: 'No valid fields' });

        setClauses.push('updated_at = CURRENT_TIMESTAMP');
        values.push(tenantId);

        const result = await pool.controlPool.query(
            `UPDATE clinic_setup_checklist SET ${setClauses.join(', ')} WHERE tenant_id = $${paramIndex} RETURNING *`,
            values
        );
        res.json(result.rows[0]);
    } catch (error) {
        console.error('[SUPER-ADMIN] Error updating checklist:', error);
        res.status(500).json({ error: 'Failed to update checklist' });
    }
});

/**
 * POST /api/super/clinic-setup/:tenantId/fax
 */
router.post('/clinic-setup/:tenantId/fax', verifySuperAdmin, async (req, res) => {
    try {
        const { tenantId } = req.params;
        const { phoneNumber, provider = 'telnyx', label } = req.body;
        let normalized = phoneNumber.replace(/\D/g, '');
        if (normalized.length === 10) normalized = '1' + normalized;
        if (!normalized.startsWith('+')) normalized = '+' + normalized;

        const result = await pool.controlPool.query(
            'INSERT INTO clinic_fax_numbers (tenant_id, phone_number, provider, label) VALUES ($1, $2, $3, $4) RETURNING *',
            [tenantId, normalized, provider, label]
        );

        await pool.controlPool.query(
            'UPDATE clinic_setup_checklist SET fax_configured = true, fax_date = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = $1',
            [tenantId]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: 'Failed to add fax' });
    }
});

/**
 * DELETE /api/super/clinic-setup/:tenantId/fax/:faxId
 */
router.delete('/clinic-setup/:tenantId/fax/:faxId', verifySuperAdmin, async (req, res) => {
    try {
        const { tenantId, faxId } = req.params;
        await pool.controlPool.query('DELETE FROM clinic_fax_numbers WHERE id = $1 AND tenant_id = $2', [faxId, tenantId]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed' });
    }
});

// ═══════════════════════════════════════════════════════════════
// PARTNER & API MANAGEMENT
// ═══════════════════════════════════════════════════════════════

const oauthService = require('../services/oauthService');

/**
 * GET /api/super/partners
 */
router.get('/partners', verifySuperAdmin, async (req, res) => {
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

        const countQuery = status ? 'SELECT COUNT(*) FROM partners WHERE status = $1' : 'SELECT COUNT(*) FROM partners';
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
        console.error('[SuperAdmin] GET /partners error:', error);
        res.status(500).json({ error: 'Failed to list partners', details: error.message });
    }
});

/**
 * POST /api/super/partners
 */
router.post('/partners', verifySuperAdmin, async (req, res) => {
    try {
        const { name, contact_email, description } = req.body;
        const result = await pool.controlPool.query(
            `INSERT INTO partners (name, contact_email, description) VALUES ($1, $2, $3) RETURNING *`,
            [name, contact_email, description]
        );
        res.status(201).json({ data: result.rows[0] });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create partner' });
    }
});

/**
 * GET /api/super/partners/:id/apps
 */
router.get('/partners/:partnerId/apps', verifySuperAdmin, async (req, res) => {
    try {
        const { partnerId } = req.params;
        const result = await pool.controlPool.query(
            `SELECT a.*, rlp.name as rate_limit_policy
             FROM apps a
             LEFT JOIN rate_limit_policies rlp ON a.rate_limit_policy_id = rlp.id
             WHERE a.partner_id = $1
             ORDER BY a.created_at DESC`,
            [partnerId]
        );
        res.json({ data: result.rows });
    } catch (error) {
        res.status(500).json({ error: 'Failed to list apps' });
    }
});

/**
 * POST /api/super/partners/:partnerId/apps
 */
router.post('/partners/:partnerId/apps', verifySuperAdmin, async (req, res) => {
    try {
        const { partnerId } = req.params;
        const { name, description, env = 'sandbox', allowed_scopes = [] } = req.body;

        const app = await oauthService.createApp(partnerId, {
            name,
            description,
            env,
            allowedScopes: allowed_scopes
        });

        res.status(201).json({ data: app });
    } catch (error) {
        console.error('[SuperAdmin] App creation error:', error);
        res.status(500).json({ error: 'Failed to create app' });
    }
});

/**
 * POST /api/super/apps/:id/rotate-secret
 */
router.post('/apps/:id/rotate-secret', verifySuperAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await oauthService.rotateClientSecret(id);
        res.json({ data: { client_secret: result.client_secret } });
    } catch (error) {
        res.status(500).json({ error: 'Failed to rotate secret' });
    }
});

/**
 * DELETE /api/super/partners/:partnerId
 */
router.delete('/partners/:id', verifySuperAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        // Delete all apps for this partner first
        await pool.controlPool.query('DELETE FROM apps WHERE partner_id = $1', [id]);
        const result = await pool.controlPool.query('DELETE FROM partners WHERE id = $1 RETURNING *', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Partner not found' });
        }

        res.json({ message: 'Partner and associated apps deleted successfully' });
    } catch (error) {
        console.error('[SuperAdmin] DELETE /partners/:id error:', error);
        res.status(500).json({ error: 'Failed to delete partner' });
    }
});

/**
 * PATCH /api/super/apps/:id
 */
router.patch('/apps/:id', verifySuperAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, status, env, allowed_scopes } = req.body;

        const updates = [];
        const values = [];
        let pIndex = 1;

        if (name) { updates.push(`name = $${pIndex++}`); values.push(name); }
        if (description !== undefined) { updates.push(`description = $${pIndex++}`); values.push(description); }
        if (status) { updates.push(`status = $${pIndex++}`); values.push(status); }
        if (env) { updates.push(`env = $${pIndex++}`); values.push(env); }
        if (allowed_scopes) { updates.push(`allowed_scopes = $${pIndex++}`); values.push(allowed_scopes); }

        if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

        values.push(id);
        const query = `UPDATE apps SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${pIndex} RETURNING *`;
        const result = await pool.controlPool.query(query, values);

        if (result.rows.length === 0) return res.status(404).json({ error: 'App not found' });
        res.json({ data: result.rows[0] });
    } catch (error) {
        console.error('[SuperAdmin] PATCH /apps/:id error:', error);
        res.status(500).json({ error: 'Failed to update app' });
    }
});

/**
 * DELETE /api/super/apps/:id
 */
router.delete('/apps/:id', verifySuperAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        // Clean up related tokens first (if not cascading)
        await pool.controlPool.query('DELETE FROM oauth_access_tokens WHERE app_id = $1', [id]);
        await pool.controlPool.query('DELETE FROM oauth_refresh_tokens WHERE app_id = $1', [id]);
        await pool.controlPool.query('DELETE FROM oauth_authorization_codes WHERE app_id = $1', [id]);

        const result = await pool.controlPool.query('DELETE FROM apps WHERE id = $1 RETURNING *', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'App not found' });
        }

        res.json({ message: 'Application deleted successfully' });
    } catch (error) {
        console.error('[SuperAdmin] DELETE /apps/:id error:', error);
        res.status(500).json({ error: 'Failed to delete application' });
    }
});

/**
 * GET /api/super/rate-limit-policies
 */
router.get('/rate-limit-policies', verifySuperAdmin, async (req, res) => {
    try {
        const result = await pool.controlPool.query('SELECT * FROM rate_limit_policies ORDER BY per_day ASC');
        res.json({ data: result.rows });
    } catch (error) {
        console.error('[SuperAdmin] GET /rate-limit-policies error:', error);
        res.status(500).json({ error: 'Failed to fetch policies', details: error.message });
    }
});

/**
 * GET /api/super/scopes
 */
router.get('/scopes', verifySuperAdmin, async (req, res) => {
    res.json({
        data: [
            { scope: 'patient.read', description: 'Read patient demographics and records' },
            { scope: 'patient.write', description: 'Create and update patient records' },
            { scope: 'medication.read', description: 'Read medication data' },
            { scope: 'medication.write', description: 'Create prescriptions' },
            { scope: 'appointment.read', description: 'Read appointments' },
            { scope: 'appointment.write', description: 'Schedule appointments' },
            { scope: 'admin.apps.manage', description: 'Manage partner apps' }
        ]
    });
});

// ═══════════════════════════════════════════════════════════════
// ARCHIVE MANAGEMENT (HIPAA COLD STORAGE)
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/super/archives
 * List all available clinic archives
 */
router.get('/archives', verifySuperAdmin, async (req, res) => {
    try {
        const archives = await require('../services/archivalService').listArchives();
        res.json(archives);
    } catch (error) {
        console.error('[SuperAdmin] Failed to list archives:', error);
        res.status(500).json({ error: 'Failed to retrieve archives' });
    }
});

/**
 * GET /api/super/archives/:filename
 * Download a specific archive file
 */
router.get('/archives/:filename', verifySuperAdmin, async (req, res) => {
    try {
        const { filename } = req.params;
        const archivalService = require('../services/archivalService');

        // Security: Ensure filename is safe and exists
        const readStream = archivalService.getArchiveReadStream(filename);

        // Set headers for download
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', 'application/gzip');

        readStream.pipe(res);
    } catch (error) {
        console.error(`[SuperAdmin] Failed to download archive ${req.params.filename}:`, error);
        if (error.message === 'Archive not found') {
            return res.status(404).json({ error: 'Archive not found' });
        }
        res.status(500).json({ error: 'Failed to download archive' });
    }
});

module.exports = router;
