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
        const clinicId = req.user.clinic_id || req.clinic?.id;
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
        const clinicId = req.user.clinic_id || req.clinic?.id;
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
        const clinicId = req.user.clinic_id || req.clinic?.id;

        if (!clinicId) {
            return res.status(400).json({ error: 'Clinic context missing' });
        }

        const successUrl = `${process.env.FRONTEND_URL || process.env.APP_BASE_URL}/admin-settings?tab=billing&payment=success&session_id={CHECKOUT_SESSION_ID}`;
        const cancelUrl = `${process.env.FRONTEND_URL || process.env.APP_BASE_URL}/admin-settings?tab=billing&payment=cancelled`;

        const session = await stripeService.createCheckoutSession(
            clinicId,
            successUrl,
            cancelUrl
        );

        res.json({
            url: session.url,
            sessionId: session.id
        });
    } catch (error) {
        console.error('[Stripe] Checkout failed:', error);
        res.status(500).json({ error: 'Failed to create checkout session' });
    }
});

/**
 * POST /api/billing/stripe/sync
 * Manually triggers a sync of the subscription quantity.
 * Useful after adding/removing users or when referrals change.
 */
router.post('/sync', authenticate, async (req, res) => {
    try {
        const clinicId = req.user.clinic_id || req.clinic?.id;
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
 * Handles incoming Stripe webhook events.
 * This endpoint is exempt from express.json() parsing and tenant middleware.
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
        console.error('[Webhook] STRIPE_WEBHOOK_SECRET is not configured!');
        return res.status(500).json({ error: 'Webhook not configured' });
    }

    let event;
    try {
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
        console.error(`[Webhook] Signature verification failed: ${err.message}`);
        return res.status(400).json({ error: `Webhook Error: ${err.message}` });
    }

    try {
        console.log(`[Webhook] Received event: ${event.type} (${event.id})`);
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
        const clinicId = req.user.clinic_id || req.clinic?.id;

        // Get database status
        const { rows } = await pool.controlPool.query(
            'SELECT stripe_customer_id, stripe_subscription_status, stripe_subscription_id, current_period_end, billing_locked, last_payment_at FROM clinics WHERE id = $1',
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

/**
 * GET /api/billing/stripe/history
 * Returns billing/payment history for the clinic.
 * Fetches real invoices from Stripe and merges with local billing events.
 */
router.get('/history', authenticate, async (req, res) => {
    try {
        const clinicId = req.user.clinic_id || req.clinic?.id;

        // Get customer ID
        const { rows } = await pool.controlPool.query(
            'SELECT stripe_customer_id FROM clinics WHERE id = $1',
            [clinicId]
        );
        const customerId = rows[0]?.stripe_customer_id;

        let invoices = [];
        if (customerId) {
            try {
                const stripeInvoices = await stripe.invoices.list({
                    customer: customerId,
                    limit: 50,
                });
                invoices = stripeInvoices.data.map(inv => ({
                    id: inv.id,
                    date: inv.created ? new Date(inv.created * 1000).toISOString() : null,
                    amount: inv.amount_paid || inv.total || 0,
                    amountDollars: ((inv.amount_paid || inv.total || 0) / 100).toFixed(2),
                    status: inv.status,
                    paid: inv.status === 'paid',
                    invoiceUrl: inv.hosted_invoice_url,
                    invoicePdf: inv.invoice_pdf,
                    description: inv.description || `Subscription invoice`,
                    periodStart: inv.period_start ? new Date(inv.period_start * 1000).toISOString() : null,
                    periodEnd: inv.period_end ? new Date(inv.period_end * 1000).toISOString() : null,
                }));
            } catch (stripeErr) {
                console.error('[Stripe] Failed to fetch invoices from Stripe:', stripeErr.message);
            }
        }

        // Also get local billing events as fallback
        const eventsRes = await pool.controlPool.query(
            `SELECT * FROM platform_billing_events WHERE clinic_id = $1 ORDER BY created_at DESC LIMIT 50`,
            [clinicId]
        );

        res.json({
            invoices,
            localEvents: eventsRes.rows,
        });
    } catch (error) {
        console.error('[Stripe] History fetch failed:', error);
        res.status(500).json({ error: 'Failed to fetch billing history' });
    }
});

module.exports = router;
