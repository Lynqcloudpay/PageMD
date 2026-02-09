const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const pool = require('../db');

/**
 * StripeService handles platform-level subscription management for clinics.
 * It manages the link between our 'clinics' table and Stripe's Billing engine.
 */
class StripeService {
    /**
     * Ensures a clinic has a Stripe Customer ID.
     * Updates the control database if a new customer is created.
     */
    async ensureCustomer(clinicId) {
        const result = await pool.controlPool.query(
            'SELECT id, display_name, slug, stripe_customer_id FROM clinics WHERE id = $1',
            [clinicId]
        );

        const clinic = result.rows[0];
        if (!clinic) throw new Error('Clinic not found');

        if (clinic.stripe_customer_id) {
            return clinic.stripe_customer_id;
        }

        // Create new customer in Stripe
        console.log(`[Stripe] Creating customer for clinic: ${clinic.display_name} (${clinic.slug})`);
        const customer = await stripe.customers.create({
            name: clinic.display_name,
            metadata: {
                clinic_id: clinic.id,
                slug: clinic.slug
            }
        });

        // Save back to DB
        await pool.controlPool.query(
            'UPDATE clinics SET stripe_customer_id = $1 WHERE id = $2',
            [customer.id, clinic.id]
        );

        return customer.id;
    }

    /**
     * Creates a Checkout Session for a clinic to subscribe to PageMD.
     * Implements "Option A" (Hosted Checkout).
     */
    async createCheckoutSession(clinicId, priceId, successUrl, cancelUrl) {
        const customerId = await this.ensureCustomer(clinicId);

        const session = await stripe.checkout.sessions.create({
            customer: customerId,
            mode: 'subscription',
            payment_method_types: ['card', 'us_bank_account'],
            payment_method_collection: 'always',
            line_items: [
                {
                    price: priceId,
                    quantity: 1, // Will be synced to actual seat count after subscription starts
                }
            ],
            subscription_data: {
                metadata: {
                    clinic_id: clinicId
                }
            },
            success_url: successUrl,
            cancel_url: cancelUrl,
        });

        return session;
    }

    /**
     * Syncs a clinic's actual seat count (Physical + Ghost) to Stripe.
     * This ensures the "Staircase" billing model is reflected in the next invoice.
     */
    async syncSubscriptionQuantity(clinicId) {
        // 1. Get Clinic & Stripe Info
        const clinicRes = await pool.controlPool.query(
            'SELECT id, stripe_subscription_id FROM clinics WHERE id = $1',
            [clinicId]
        );
        const clinic = clinicRes.rows[0];

        if (!clinic || !clinic.stripe_subscription_id) {
            console.log(`[Stripe] No active subscription to sync for clinic ${clinicId}`);
            return;
        }

        // 2. Calculate actual seat count (logic pulled from growth.js)
        const counts = await this._getSeatCounts(clinicId);
        const totalSeats = counts.physicalSeats; // We bill based on physical seats, ghost seats cover the cost

        // 3. Update Stripe Subscription
        const subscription = await stripe.subscriptions.retrieve(clinic.stripe_subscription_id);
        const subscriptionItemId = subscription.items.data[0].id;

        console.log(`[Stripe] Syncing quantity for clinic ${clinicId}: ${totalSeats} seats`);
        await stripe.subscriptionItems.update(subscriptionItemId, {
            quantity: totalSeats,
        });
    }

    /**
     * Internal helper to count seats for a clinic.
     * Matches logic used in growth.js /stats endpoint.
     */
    async _getSeatCounts(clinicId) {
        // Get schema name
        const clinicRes = await pool.controlPool.query('SELECT schema_name FROM clinics WHERE id = $1', [clinicId]);
        const schemaName = clinicRes.rows[0]?.schema_name;

        if (!schemaName) return { physicalSeats: 1, ghostSeats: 0 };

        // Count active providers in clinic schema
        const userRes = await pool.controlPool.query(`
            SELECT count(*) FROM ${schemaName}.users 
             WHERE status = 'active'
             AND UPPER(role) IN ('CLINICIAN', 'PHYSICIAN', 'DOCTOR', 'NP', 'PROVIDER', 'PA', 'NURSE PRACTITIONER')`);
        const physicalSeats = parseInt(userRes.rows[0].count) || 1;

        // Count successful referrals in public schema
        const referralRes = await pool.controlPool.query(`
            SELECT count(*) FROM public.clinic_referrals 
             WHERE referrer_clinic_id = $1 AND status = 'active'`, [clinicId]);
        const ghostSeats = parseInt(referralRes.rows[0].count) || 0;

        return { physicalSeats, ghostSeats };
    }

    /**
     * Handles Stripe Webhook events to keep local clinic status in sync.
     */
    async handleWebhook(event) {
        const data = event.data.object;

        switch (event.type) {
            case 'customer.subscription.created':
            case 'customer.subscription.updated':
                await this._updateSubscriptionStatus(data);
                break;
            case 'customer.subscription.deleted':
                await this._cancelSubscription(data);
                break;
            case 'invoice.payment_succeeded':
                await this._recordPayment(data);
                break;
            case 'invoice.payment_failed':
                await this._handlePaymentFailure(data);
                break;
        }
    }

    async _updateSubscriptionStatus(subscription) {
        const clinicId = subscription.metadata.clinic_id;
        const status = subscription.status;
        const periodEnd = new Date(subscription.current_period_end * 1000);
        const priceId = subscription.items.data[0].price.id;

        console.log(`[Stripe] Updating subscription for clinic ${clinicId}: ${status}`);
        await pool.controlPool.query(`
            UPDATE clinics 
               SET stripe_subscription_id = $1,
                   stripe_price_id = $2,
                   stripe_subscription_status = $3,
                   current_period_end = $4,
                   billing_locked = $5
             WHERE id = $6`,
            [subscription.id, priceId, status, periodEnd, status === 'past_due' || status === 'unpaid', clinicId]
        );
    }

    async _cancelSubscription(subscription) {
        const clinicId = subscription.metadata.clinic_id;
        console.warn(`[Stripe] Subscription canceled for clinic ${clinicId}`);
        await pool.controlPool.query(
            "UPDATE clinics SET stripe_subscription_status = 'canceled', billing_locked = true WHERE id = $1",
            [clinicId]
        );
    }

    async _recordPayment(invoice) {
        const customerId = invoice.customer;
        const result = await pool.controlPool.query('SELECT id FROM clinics WHERE stripe_customer_id = $1', [customerId]);
        const clinicId = result.rows[0]?.id;

        if (clinicId) {
            await pool.controlPool.query(`
                INSERT INTO platform_billing_events (clinic_id, stripe_event_id, event_type, amount_total, status)
                VALUES ($1, $2, 'payment_succeeded', $3, 'completed')`,
                [clinic_id, invoice.id, invoice.amount_paid]
            );
        }
    }

    async _handlePaymentFailure(invoice) {
        const customerId = invoice.customer;
        const result = await pool.controlPool.query('SELECT id FROM clinics WHERE stripe_customer_id = $1', [customerId]);
        const clinicId = result.rows[0]?.id;

        if (clinicId) {
            console.error(`[Stripe] Payment failed for clinic ${clinicId}`);
            // Optionally notify the clinic or lock billing
        }
    }
}

module.exports = new StripeService();
