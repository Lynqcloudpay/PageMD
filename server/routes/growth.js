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
    if (totalBillingSeats <= 0) return 0;
    if (physicalSeats <= 0) return 0;

    let virtualTotal = 0;

    // 1. Calculate the total cost for the virtual practice (Physical + Ghost)
    for (let i = 1; i <= totalBillingSeats; i++) {
        const tier = TIERS.find(t => i >= t.min && i <= t.max) || TIERS[TIERS.length - 1];
        virtualTotal += tier.rate;
    }

    // 2. Find the Effective Average Rate
    const effectiveAverageRate = virtualTotal / totalBillingSeats;

    // 3. Final bill is Physical Doctors * Effective Average Rate
    return Math.round(physicalSeats * effectiveAverageRate);
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
        const totalMonthly = calculateTotalBilling(physicalSeats, ghostSeats);
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
            const nextTotal = calculateTotalBilling(physicalSeats, s - physicalSeats);
            const nextAvg = Math.round(nextTotal / physicalSeats);
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
 * Placeholder for sending referral invites
 */
router.post('/invite', async (req, res) => {
    try {
        const { email, name } = req.body;
        if (!email) return res.status(400).json({ error: 'Email required' });

        const clinicId = req.clinic.id;

        // Log the invitation
        await pool.controlPool.query(
            "INSERT INTO public.clinic_referrals (referrer_clinic_id, referred_clinic_name, referral_email, status) VALUES ($1, $2, $3, 'pending')",
            [clinicId, name, email]
        );

        // TODO: Integrate with SendGrid/AWS SES
        console.log(`[Growth] Invitation sent to ${email} from clinic ${clinicId}`);

        res.json({ success: true, message: 'Invitation sent' });
    } catch (error) {
        console.error('[Growth] Invite failed:', error);
        res.status(500).json({ error: 'System error' });
    }
});

module.exports = router;
