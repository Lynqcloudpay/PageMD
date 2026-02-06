const express = require('express');
const pool = require('../db');
const { authenticate } = require('../middleware/auth');
const router = express.Router();

router.use(authenticate);

// Pricing Tiers (Source of Truth: PricingPage.jsx logic)
// We calculate average cost per seat using the staircase model.
const TIERS = [
    { name: 'Solo', min: 1, max: 1, rate: 399 },
    { name: 'Partner', min: 2, max: 3, rate: 299 },
    { name: 'Professional', min: 4, max: 5, rate: 249 },
    { name: 'Premier', min: 6, max: 8, rate: 199 },
    { name: 'Elite', min: 9, max: 10, rate: 149 },
    { name: 'Enterprise', min: 11, max: 999, rate: 99 },
];

/**
 * Helper: Calculate Total Monthly Billing based on physical and ghost seats
 * Ghost seats "cover" the most expensive early slots in the staircase model.
 */
const calculateTotalBilling = (physicalSeats, ghostSeats = 0) => {
    const totalBillingSeats = physicalSeats + ghostSeats;
    if (totalBillingSeats <= 0) return { total: 0, virtualTotal: 0, effectiveRate: 0 };
    if (physicalSeats <= 0) return { total: 0, virtualTotal: 0, effectiveRate: 0 };

    let virtualTotal = 0;

    // 1. Calculate the total cost for the virtual practice (Physical + Ghost)
    for (let i = 1; i <= totalBillingSeats; i++) {
        const tier = TIERS.find(t => i >= t.min && i <= t.max) || TIERS[TIERS.length - 1];
        virtualTotal += tier.rate;
    }

    // 2. Find the Effective Average Rate
    const effectiveAverageRate = virtualTotal / totalBillingSeats;

    // 3. Final bill is Physical Doctors * Effective Average Rate
    return {
        total: Math.round(physicalSeats * effectiveAverageRate),
        virtualTotal,
        effectiveRate: effectiveAverageRate
    };
};

/**
 * GET /stats
 * Returns growth reward stats for the current clinic
 */
router.get('/stats', async (req, res) => {
    try {
        const clinicId = req.clinic.id;

        // 1. Get Physical Seats (Count of Active Providers in this schema)
        // Note: In our multi-tenant schema model, we are already in the correct search_path.
        const userRes = await pool.query(
            `SELECT count(*) FROM users 
             WHERE status = 'active'
             AND UPPER(role) IN ('CLINICIAN', 'PHYSICIAN', 'DOCTOR', 'NP', 'PROVIDER', 'PA', 'NURSE PRACTITIONER')`
        );
        const physicalSeats = parseInt(userRes.rows[0].count) || 1;

        // 2. Get Ghost Seats (Count of successful, active referrals)
        const referralRes = await pool.controlPool.query(
            `SELECT count(*) FROM public.clinic_referrals 
             WHERE referrer_clinic_id = $1 
             AND (
                status = 'active' 
                OR (status = 'churned' AND grace_period_expires_at > NOW())
             )`,
            [clinicId]
        );
        const ghostSeats = parseInt(referralRes.rows[0].count) || 0;

        // 3. Billing Logic
        const totalBillingSeats = physicalSeats + ghostSeats;
        const billingData = calculateTotalBilling(physicalSeats, ghostSeats);
        const totalMonthly = billingData.total;
        const currentAvgPerSeat = totalBillingSeats > 0 ? Math.round(totalMonthly / physicalSeats) : 0;
        const currentTier = TIERS.find(t => totalBillingSeats >= t.min && totalBillingSeats <= t.max) || TIERS[TIERS.length - 1];

        // 4. Check for Churn Notifications (Soft Landing)
        const churnedRes = await pool.controlPool.query(
            `SELECT referred_clinic_name, grace_period_expires_at 
             FROM public.clinic_referrals 
             WHERE referrer_clinic_id = $1 
             AND status = 'churned' 
             AND grace_period_expires_at > NOW()
             ORDER BY grace_period_expires_at DESC`,
            [clinicId]
        );
        const activeGracePeriods = churnedRes.rows.map(r => ({
            name: r.referred_clinic_name,
            expiresAt: r.grace_period_expires_at
        }));

        // Calculate Next Milestone
        let nextMilestone = null;
        const maxCheck = 100; // Check up to Enterprise level
        for (let s = totalBillingSeats + 1; s <= maxCheck; s++) {
            const nextBilling = calculateTotalBilling(physicalSeats, s - physicalSeats);
            const nextAvg = Math.round(nextBilling.total / physicalSeats);
            if (nextAvg < currentAvgPerSeat) {
                nextMilestone = {
                    referralsNeeded: s - totalBillingSeats,
                    newRate: nextAvg,
                    totalSeats: s
                };
                break;
            }
        }

        // Get Referral Code
        const clinicRes = await pool.controlPool.query("SELECT referral_code FROM public.clinics WHERE id = $1", [clinicId]);
        const referralCode = clinicRes.rows[0]?.referral_code;

        // Get Active Referral List (masked)
        const referralsList = await pool.controlPool.query(`
            SELECT r.referred_clinic_name, r.status, r.created_at, r.grace_period_expires_at, c.display_name as active_name
            FROM public.clinic_referrals r
            LEFT JOIN public.clinics c ON r.referred_clinic_id = c.id
            WHERE r.referrer_clinic_id = $1
            ORDER BY r.created_at DESC
        `, [clinicId]);

        res.json({
            physicalSeats,
            ghostSeats,
            totalBillingSeats,
            currentRate: currentAvgPerSeat,
            marginalRate: currentTier.rate,
            tierName: currentTier.name,
            totalMonthly,
            virtualTotal: billingData.virtualTotal,
            effectiveRate: parseFloat(billingData.effectiveRate.toFixed(4)),
            referralCode,
            referralLink: referralCode ? `https://pagemdemr.com/register?ref=${referralCode}` : null,
            nextMilestone,
            activeGracePeriods,
            referrals: referralsList.rows.map(r => ({
                name: r.active_name || r.referred_clinic_name || 'Anonymous Practice',
                status: r.status,
                date: r.created_at,
                graceExpires: r.grace_period_expires_at
            }))
        });
    } catch (error) {
        console.error('[Growth] Stats failed:', error);
        res.status(500).json({ error: 'Failed to fetch growth stats' });
    }
});

/**
 * POST /invite
 * Sends a referral invitation with a unique, single-use token.
 */
router.post('/invite', async (req, res) => {
    try {
        const { email, name } = req.body;
        if (!email) return res.status(400).json({ error: 'Email required' });

        const clinicId = req.clinic.id;
        const clinicName = req.clinic.display_name || req.clinic.name;

        // 1. Generate unique token
        const crypto = require('crypto');
        const token = crypto.randomUUID();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30); // 30 day expiry

        // 2. Log the invitation with the token
        await pool.controlPool.query(
            `INSERT INTO public.clinic_referrals 
             (referrer_clinic_id, referred_clinic_name, referral_email, status, token, token_expires_at, invite_sent_at) 
             VALUES ($1, $2, $3, 'pending', $4, $5, NOW())`,
            [clinicId, name, email, token, expiresAt]
        );

        // 3. Send Invitation Email
        const emailService = require('../services/emailService');
        const frontendUrl = process.env.FRONTEND_URL || 'https://pagemdemr.com';
        const inviteLink = `${frontendUrl}/register?token=${token}`;

        const emailSent = await emailService.sendReferralInvite(email, name, clinicName, inviteLink);

        if (!emailSent) {
            console.warn(`[Growth] Failed to send invitation email to ${email}`);
            // We still return success because the referral record is created, 
            // but we could also return a partial success message.
        }

        console.log(`[Growth] Dynamic invitation sent to ${email} (token: ${token}) from clinic ${clinicId}`);

        res.json({
            success: true,
            message: emailSent ? 'Invitation sent' : 'Invitation recorded (email failed to send)',
            token: process.env.NODE_ENV === 'development' ? token : undefined
        });
    } catch (error) {
        console.error('[Growth] Invite failed:', error);
        res.status(500).json({ error: 'System error' });
    }
});

/**
 * GET /alerts
 * Returns active alerts for the clinic admin (churn notifications, grace period warnings)
 */
router.get('/alerts', async (req, res) => {
    try {
        // Use user's clinic_id as primary source (set by authenticate), fallback to resolved tenant
        const clinicId = req.user?.clinic_id || req.clinic?.id;

        if (!clinicId) {
            console.warn('[Growth] Alerts requested but no clinic ID found in user or tenant context');
            return res.json({ alerts: [], count: 0 });
        }

        console.log(`[Growth] Fetching alerts for clinic: ${clinicId} (User: ${req.user?.email})`);

        const alerts = [];


        // 1. Check for churned referrals (with grace period active)
        const churnedRes = await pool.controlPool.query(`
            SELECT referred_clinic_name, grace_period_expires_at, status, updated_at
            FROM public.clinic_referrals 
            WHERE referrer_clinic_id = $1 
            AND status = 'churned' 
            AND grace_period_expires_at > NOW()
            ORDER BY grace_period_expires_at ASC
        `, [clinicId]);

        console.log(`[Growth] Found ${churnedRes.rows.length} churned referrals`);

        for (const row of churnedRes.rows) {
            const daysRemaining = Math.ceil((new Date(row.grace_period_expires_at) - new Date()) / (1000 * 60 * 60 * 24));
            alerts.push({
                id: `churn-${row.referred_clinic_name}`,
                type: 'churn',
                severity: daysRemaining <= 14 ? 'warning' : 'info',
                title: 'Referral Churn Notice',
                message: `${row.referred_clinic_name} has deactivated. Your discount is protected for ${daysRemaining} more days (until ${new Date(row.grace_period_expires_at).toLocaleDateString()}).`,
                createdAt: row.updated_at,
                expiresAt: row.grace_period_expires_at,
                actionUrl: '/admin-settings?tab=rewards',
                actionLabel: 'View Growth Rewards'
            });
        }

        // 2. Check for NEW active referrals (signed up in last 30 days)
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
                type: 'success',
                severity: 'success',
                title: 'New Referral Signup!',
                message: `${row.referred_clinic_name} has signed up! You are now receiving a referral discount.`,
                createdAt: row.updated_at,
                actionUrl: '/admin-settings?tab=rewards',
                actionLabel: 'View Discount'
            });
        }

        // 3. Get dismissed alerts for this clinic
        const dismissedRes = await pool.controlPool.query(`
            SELECT alert_id FROM public.growth_alert_dismissals WHERE clinic_id = $1
        `, [clinicId]);
        const dismissedIds = new Set(dismissedRes.rows.map(r => r.alert_id));

        // 4. Check for grace periods expiring soon (within 14 days)
        const expiringRes = await pool.controlPool.query(`
            SELECT referred_clinic_name, grace_period_expires_at
            FROM public.clinic_referrals 
            WHERE referrer_clinic_id = $1 
            AND status = 'churned' 
            AND grace_period_expires_at > NOW()
            AND grace_period_expires_at < NOW() + INTERVAL '14 days'
        `, [clinicId]);

        for (const row of expiringRes.rows) {
            const daysRemaining = Math.ceil((new Date(row.grace_period_expires_at) - new Date()) / (1000 * 60 * 60 * 24));
            // Only add if not already covered by the main churn alert
            if (!alerts.find(a => a.id === `churn-${row.referred_clinic_name}`)) {
                alerts.push({
                    id: `expire-${row.referred_clinic_name}`,
                    type: 'expiring',
                    severity: 'warning',
                    title: 'Grace Period Expiring',
                    message: `Your discount from ${row.referred_clinic_name} expires in ${daysRemaining} days. Consider inviting more clinics to maintain your rate.`,
                    createdAt: new Date(),
                    expiresAt: row.grace_period_expires_at,
                    actionUrl: '/admin-settings?tab=rewards',
                    actionLabel: 'Invite Clinics'
                });
            }
        }

        // Filter out dismissed alerts
        const activeAlerts = alerts.filter(a => !dismissedIds.has(a.id));

        res.json({ alerts: activeAlerts, count: activeAlerts.length });
    } catch (error) {
        console.error('[Growth] Alerts failed:', error);
        res.status(500).json({ error: 'Failed to fetch alerts' });
    }
});

/**
 * POST /alerts/dismiss-all
 * Dismiss all active alerts for the current clinic
 */
router.post('/alerts/dismiss-all', async (req, res) => {
    try {
        const clinicId = req.user?.clinic_id || req.clinic?.id;
        if (!clinicId) return res.status(400).json({ error: 'Clinic context required' });

        // Get all currently active alert IDs for this clinic to record them as dismissed
        // This is necessary because alerts are generated dynamically

        // 1. Get current lists (simplified logic to match GET /alerts)
        const churnedIds = await pool.controlPool.query(
            "SELECT referred_clinic_name FROM public.clinic_referrals WHERE referrer_clinic_id = $1 AND status = 'churned' AND grace_period_expires_at > NOW()",
            [clinicId]
        );
        const newIds = await pool.controlPool.query(
            "SELECT referred_clinic_name FROM public.clinic_referrals WHERE referrer_clinic_id = $1 AND status = 'active' AND updated_at > NOW() - INTERVAL '30 days'",
            [clinicId]
        );

        const allIds = [
            ...churnedIds.rows.map(r => `churn-${r.referred_clinic_name}`),
            ...newIds.rows.map(r => `new-${r.referred_clinic_name}`)
        ];

        if (allIds.length > 0) {
            const values = allIds.map((id, i) => `($1, $${i + 2}, NOW())`).join(',');
            await pool.controlPool.query(`
                INSERT INTO public.growth_alert_dismissals (clinic_id, alert_id, dismissed_at)
                VALUES ${values}
                ON CONFLICT (clinic_id, alert_id) DO UPDATE SET dismissed_at = NOW()
            `, [clinicId, ...allIds]);
        }

        res.json({ success: true, dismissedCount: allIds.length });
    } catch (error) {
        console.error('[Growth] Dismiss all alerts failed:', error);
        res.status(500).json({ error: 'Failed to dismiss all alerts' });
    }
});

router.post('/alerts/:id/dismiss', async (req, res) => {
    try {
        const clinicId = req.user?.clinic_id || req.clinic?.id;
        const alertId = req.params.id;

        if (!clinicId) {
            return res.status(400).json({ error: 'Clinic context required' });
        }

        await pool.controlPool.query(`
            INSERT INTO public.growth_alert_dismissals (clinic_id, alert_id, dismissed_at)
            VALUES ($1, $2, NOW())
            ON CONFLICT (clinic_id, alert_id) DO UPDATE SET dismissed_at = NOW()
        `, [clinicId, alertId]);

        res.json({ success: true });
    } catch (error) {
        console.error('[Growth] Dismiss alert failed:', error);
        res.status(500).json({ error: 'Failed to dismiss alert' });
    }
});

module.exports = router;
