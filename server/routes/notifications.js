const express = require('express');
const pool = require('../db');
const { authenticate } = require('../middleware/auth');
const router = express.Router();

router.use(authenticate);

/**
 * GET /notifications
 * Aggregates all alerts for the logged-in clinic admin
 */
router.get('/', async (req, res) => {
    try {
        const clinicId = req.user?.clinic_id || req.clinic?.id;

        if (!clinicId) {
            return res.json({ alerts: [], count: 0 });
        }

        const alerts = [];

        // ---------------------------------------------------------
        // 1. System Announcements (Platform Admin Broadcasts)
        // ---------------------------------------------------------
        const announcements = await pool.controlPool.query(`
            SELECT id, title, message, type, created_at, expires_at
            FROM public.system_announcements
            WHERE is_active = true
            AND (expires_at IS NULL OR expires_at > NOW())
            AND (
                target_type = 'all'
                OR (target_type = 'clinic' AND target_value = $1)
            )
            ORDER BY created_at DESC
        `, [clinicId]);

        for (const row of announcements.rows) {
            alerts.push({
                id: `sys-${row.id}`,
                type: 'system', // mapped to 'info' icon usually
                severity: row.type === 'critical' ? 'error' : row.type === 'warning' ? 'warning' : 'info',
                title: row.title,
                message: row.message,
                createdAt: row.created_at,
                actionUrl: null, // Broadcasts usually don't link anywhere, unless message contains link
                dismissible: true
            });
        }

        // ---------------------------------------------------------
        // 2. Account Status Alerts (Lockouts, Audits)
        // ---------------------------------------------------------
        const clinicRes = await pool.controlPool.query(
            "SELECT billing_locked, prescribing_locked, status, is_read_only FROM clinics WHERE id = $1",
            [clinicId]
        );
        const clinic = clinicRes.rows[0];

        if (clinic) {
            if (clinic.billing_locked) {
                alerts.push({
                    id: 'account-billing-locked',
                    type: 'security',
                    severity: 'error',
                    title: 'Billing Suspended',
                    message: 'Your billing privileges are currently locked. Please contact support.',
                    createdAt: new Date(),
                    actionUrl: '/admin-settings?tab=practice',
                    dismissible: false // Critical logic usually shouldn't be dismissed
                });
            }

            if (clinic.prescribing_locked) {
                alerts.push({
                    id: 'account-rx-locked',
                    type: 'security',
                    severity: 'error',
                    title: 'ePrescribing Suspended',
                    message: 'eRefills and prescribing are disabled. Please check your compliance status.',
                    createdAt: new Date(),
                    actionUrl: '/admin-settings?tab=clinical',
                    dismissible: false
                });
            }

            if (clinic.status === 'suspended') {
                alerts.push({
                    id: 'account-suspended',
                    type: 'security',
                    severity: 'error',
                    title: 'Account Suspended',
                    message: 'Your clinic account is suspended. Functionality is limited.',
                    createdAt: new Date(),
                    actionUrl: '/support',
                    dismissible: false
                });
            }
        }

        // ---------------------------------------------------------
        // 3. Subscription/Payment Alerts
        // ---------------------------------------------------------
        const subRes = await pool.controlPool.query(`
            SELECT status, current_period_end 
            FROM clinic_subscriptions 
            WHERE clinic_id = $1 AND status IN ('past_due', 'unpaid', 'trial')
            ORDER BY created_at DESC LIMIT 1
        `, [clinicId]);

        if (subRes.rows.length > 0) {
            const sub = subRes.rows[0];
            if (sub.status === 'past_due' || sub.status === 'unpaid') {
                alerts.push({
                    id: 'billing-past-due',
                    type: 'billing',
                    severity: 'error',
                    title: 'Payment Past Due',
                    message: 'We could not process your last payment. Please update your payment method to avoid interruption.',
                    createdAt: new Date(),
                    actionUrl: '/admin-settings?tab=practice',
                    dismissible: false
                });
            }
        }

        // ---------------------------------------------------------
        // 4. Growth Rewards (Imported Logic)
        // ---------------------------------------------------------
        // We replicate the logic from growth.js briefly or fetch it. 
        // For simplicity and performance, we'll implement the query directly here to keep it single-pass if possible,
        // but to avoid code duplication we should ideally use a service. 
        // For now, let's copy the lightweight logic since it's just checking specific tables.

        // Churned Referrals
        const churnedRes = await pool.controlPool.query(`
            SELECT referred_clinic_name, grace_period_expires_at, updated_at
            FROM public.clinic_referrals 
            WHERE referrer_clinic_id = $1 
            AND status = 'churned' 
            AND grace_period_expires_at > NOW()
            ORDER BY grace_period_expires_at ASC
        `, [clinicId]);

        for (const row of churnedRes.rows) {
            const daysRemaining = Math.ceil((new Date(row.grace_period_expires_at) - new Date()) / (1000 * 60 * 60 * 24));
            alerts.push({
                id: `churn-${row.referred_clinic_name}`,
                type: 'growth',
                severity: daysRemaining <= 14 ? 'warning' : 'info',
                title: 'Referral Churn Notice',
                message: `${row.referred_clinic_name} has deactivated. Your discount is protected for ${daysRemaining} more days.`,
                createdAt: row.updated_at,
                actionUrl: '/admin-settings?tab=rewards',
                dismissible: true
            });
        }

        // New Referrals
        const newReferralsRes = await pool.controlPool.query(`
            SELECT referred_clinic_name, updated_at
            FROM public.clinic_referrals 
            WHERE referrer_clinic_id = $1 
            AND status = 'active'
            AND updated_at > NOW() - INTERVAL '30 days'
            ORDER BY updated_at DESC
        `, [clinicId]);

        for (const row of newReferralsRes.rows) {
            alerts.push({
                id: `new-${row.referred_clinic_name}`,
                type: 'growth', // 'success' maps to Up Trend in frontend
                severity: 'success',
                title: 'New Referral Signup!',
                message: `${row.referred_clinic_name} has signed up! You are now receiving a referral discount.`,
                createdAt: row.updated_at,
                actionUrl: '/admin-settings?tab=rewards',
                dismissible: true
            });
        }

        // ---------------------------------------------------------
        // 5. Filter Dismissed Alerts
        // ---------------------------------------------------------
        const dismissedRes = await pool.controlPool.query(
            "SELECT alert_id FROM clinic_alert_dismissals WHERE clinic_id = $1",
            [clinicId]
        );
        const dismissedIds = new Set(dismissedRes.rows.map(r => r.alert_id));

        // Filter out dismissed alerts, BUT keep non-dismissible ones (security/billing locks)
        const activeAlerts = alerts.filter(a => {
            if (!a.dismissible) return true; // Always show forced alerts
            return !dismissedIds.has(a.id);
        });

        res.json({ alerts: activeAlerts, count: activeAlerts.length });

    } catch (error) {
        console.error('[Notifications] Failed to aggregate alerts:', error);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
});

/**
 * POST /notifications/:id/dismiss
 * Dismiss a specific alert
 */
router.post('/:id/dismiss', async (req, res) => {
    try {
        const clinicId = req.user?.clinic_id || req.clinic?.id;
        const alertId = req.params.id;

        if (!clinicId) return res.status(400).json({ error: 'Clinic context required' });

        await pool.controlPool.query(`
            INSERT INTO public.clinic_alert_dismissals (clinic_id, alert_id, dismissed_at)
            VALUES ($1, $2, NOW())
            ON CONFLICT (clinic_id, alert_id) DO UPDATE SET dismissed_at = NOW()
        `, [clinicId, alertId]);

        res.json({ success: true });
    } catch (error) {
        console.error('[Notifications] Dismiss failed:', error);
        res.status(500).json({ error: 'Failed to dismiss alert' });
    }
});

/**
 * POST /notifications/dismiss-all
 * Dismiss ALL specific alerts (only dismissible ones)
 */
router.post('/dismiss-all', async (req, res) => {
    try {
        const clinicId = req.user?.clinic_id || req.clinic?.id;
        if (!clinicId) return res.status(400).json({ error: 'Clinic context required' });

        // Strategy: We can't just "Insert everything" because we don't store generated alerts in a table.
        // We receive a list of IDs from the frontend to dismiss, OR we trust the frontend to call this when it has the IDs.
        // Actually, better design: The backend knows what *would* be generated. 
        // Calculating "all" alerts just to dismiss them is heavy but safe.
        // Alternatively, receive IDs from body.

        const { alertIds } = req.body; // Expect frontend to send IDs? 
        // User asked for "Dismiss All". The frontend knows the IDs it is displaying.
        // Let's support passing IDs. If no IDs passed, we might have to infer them (system updates + growth).

        let idsToDismiss = alertIds;

        if (!idsToDismiss || !Array.isArray(idsToDismiss)) {
            // Fallback: Infer IDs for system announcements and growth (Static alerts like Locked Account are not dismissible anyway)
            idsToDismiss = [];

            // Fetch generic IDs
            const announcements = await pool.controlPool.query("SELECT id FROM system_announcements WHERE is_active = true");
            idsToDismiss.push(...announcements.rows.map(r => `sys-${r.id}`));

            // Fetch growth IDs (simplified)
            const growth = await pool.controlPool.query(`
                SELECT referred_clinic_name FROM clinic_referrals 
                WHERE referrer_clinic_id = $1 AND (status = 'active' OR status = 'churned')
            `, [clinicId]); // This is broad but safe since dismissals are harmless if ID doesn't exist

            idsToDismiss.push(...growth.rows.map(r => `churn-${r.referred_clinic_name}`));
            idsToDismiss.push(...growth.rows.map(r => `new-${r.referred_clinic_name}`));
        }

        if (idsToDismiss.length > 0) {
            const values = idsToDismiss.map((id, i) => `($1, $${i + 2}, NOW())`).join(',');
            await pool.controlPool.query(`
                INSERT INTO public.clinic_alert_dismissals (clinic_id, alert_id, dismissed_at)
                VALUES ${values}
                ON CONFLICT (clinic_id, alert_id) DO UPDATE SET dismissed_at = NOW()
            `, [clinicId, ...idsToDismiss]);
        }

        res.json({ success: true, count: idsToDismiss.length });
    } catch (error) {
        console.error('[Notifications] Dismiss all failed:', error);
        res.status(500).json({ error: 'Failed to dismiss all' });
    }
});

module.exports = router;
