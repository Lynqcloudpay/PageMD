const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const stripeService = require('../services/stripeService');
const { authenticate } = require('../middleware/auth');
const pool = require('../db');
const router = express.Router();

/**
 * GET /api/billing/stripe/preview
 * Returns a preview of the calculated billing for the current clinic.
 * Useful for displaying the billing breakdown on the admin page.
 */
router.get('/preview', authenticate, async (req, res) => {
    try {
        const clinicId = req.user.clinicId || req.clinic?.id;
        if (!clinicId) {
            return res.status(400).json({ error: 'Clinic context missing' });
        }

        const billing = await stripeService.calculateMonthlyTotal(clinicId);
        res.json(billing);
    } catch (error) {
        console.error('[Stripe] Preview failed:', error);
        res.status(500).json({ error: 'Failed to calculate billing preview' });
    }
});

/**
 * POST /api/billing/stripe/portal
 * Creates a Stripe Customer Portal session for viewing invoices and managing billing.
 */
router.post('/portal', authenticate, async (req, res) => {
    try {
        const clinicId = req.user.clinicId || req.clinic?.id;
        if (!clinicId) {
            return res.status(400).json({ error: 'Clinic context missing' });
        }

        // Get the clinic's Stripe customer ID
        const { rows } = await pool.controlPool.query(
            'SELECT stripe_customer_id FROM clinics WHERE id = $1',
            [clinicId]
        );

        const customerId = rows[0]?.stripe_customer_id;
        if (!customerId) {
            return res.status(400).json({ error: 'No billing account found. Please set up a subscription first.' });
        }

        // Create a portal session
        const returnUrl = `${process.env.FRONTEND_URL || process.env.APP_BASE_URL}/settings/billing`;
        const portalSession = await stripe.billingPortal.sessions.create({
            customer: customerId,
            return_url: returnUrl,
        });

        res.json({ url: portalSession.url });
    } catch (error) {
        console.error('[Stripe] Portal session failed:', error);
        res.status(500).json({ error: 'Failed to open billing portal' });
    }
});

/**
 * POST /api/billing/stripe/create-checkout-session
 * Initial subscription setup. Users are redirected here from the Billing page.
 * The price is calculated dynamically based on seat counts.
 */
router.post('/create-checkout-session', authenticate, async (req, res) => {
    try {
        const clinicId = req.user.clinicId || req.clinic?.id;

        if (!clinicId) {
            return res.status(400).json({ error: 'Clinic context missing' });
        }

        const successUrl = `${process.env.FRONTEND_URL || process.env.APP_BASE_URL}/settings/billing?session_id={CHECKOUT_SESSION_ID}`;
        const cancelUrl = `${process.env.FRONTEND_URL || process.env.APP_BASE_URL}/settings/billing`;

        const session = await stripeService.createCheckoutSession(
            clinicId,
            successUrl,
            cancelUrl
        );

        res.json({ url: session.url });
    } catch (error) {
        console.error('[Stripe] Checkout failed:', error);
        res.status(500).json({ error: 'Failed to initiate payment' });
    }
});

/**
 * POST /api/billing/stripe/sync
 * Manually triggers a sync of the subscription quantity.
 * Useful after adding/removing users or when referrals change.
 */
router.post('/sync', authenticate, async (req, res) => {
    try {
        const clinicId = req.user.clinicId || req.clinic?.id;
        if (!clinicId) {
            return res.status(400).json({ error: 'Clinic context missing' });
        }

        await stripeService.syncSubscriptionQuantity(clinicId);
        const billing = await stripeService.calculateMonthlyTotal(clinicId);

        res.json({
            success: true,
            message: 'Subscription synced successfully',
            billing
        });
    } catch (error) {
        console.error('[Stripe] Sync failed:', error);
        res.status(500).json({ error: 'Failed to sync subscription' });
    }
});

/**
 * POST /api/billing/stripe/webhook
 * Stripe calls this when subscription events occur.
 * NOTE: This endpoint must NOT use the authenticate middleware.
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(
            req.body,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (err) {
        console.error(`[Webhook] Signature verification failed: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
        await stripeService.handleWebhook(event);
        res.json({ received: true });
    } catch (error) {
        console.error(`[Webhook] Processing failed: ${error.message}`);
        res.status(500).json({ error: 'Webhook handler failed' });
    }
});

/**
 * GET /api/billing/stripe/status
 * Returns current subscription status and billing breakdown for the clinic.
 */
router.get('/status', authenticate, async (req, res) => {
    try {
        const clinicId = req.user.clinicId || req.clinic?.id;

        // Get database status
        const { rows } = await pool.controlPool.query(
            'SELECT stripe_subscription_status, stripe_subscription_id, current_period_end, billing_locked FROM clinics WHERE id = $1',
            [clinicId]
        );

        // Get calculated billing
        const billing = await stripeService.calculateMonthlyTotal(clinicId);

        res.json({
            ...(rows[0] || { stripe_subscription_status: 'none' }),
            billing
        });
    } catch (error) {
        console.error('[Stripe] Status check failed:', error);
        res.status(500).json({ error: 'Failed to fetch billing status' });
    }
});

module.exports = router;
