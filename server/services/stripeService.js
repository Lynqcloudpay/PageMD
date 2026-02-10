const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const pool = require('../db');
const gracePeriodService = require('./GracePeriodService');

/**
 * PRICING TIERS (Staircase Model) - Source of Truth: growth.js / PricingPage.jsx
 * The effective rate decreases as the clinic grows.
 * Ghost seats (from referrals) count toward the tier but are not billed.
 */
const TIERS = [
    { name: 'Solo', min: 1, max: 1, rate: 399 },
    { name: 'Partner', min: 2, max: 3, rate: 299 },
    { name: 'Professional', min: 4, max: 5, rate: 249 },
    { name: 'Premier', min: 6, max: 8, rate: 199 },
    { name: 'Elite', min: 9, max: 10, rate: 149 },
    { name: 'Enterprise', min: 11, max: 999, rate: 99 },
];

/**
 * StripeService handles platform-level subscription management for clinics.
 * It manages the link between our 'clinics' table and Stripe's Billing engine.
 */
class StripeService {
    /**
     * Calculates the monthly billing amount using the staircase model.
     * The formula:
     * 1. Calculate total seats = physical + ghost
     * 2. Calculate cumulative staircase cost for ALL seats
     * 3. Derive the effective rate = total cost / total seats
     * 4. Final charge = effective rate × physical seats only
     * 
     * Example: 2 physical + 5 ghost = 7 total seats
     * - Seat 1: $399 (Solo)
     * - Seats 2-3: 2 × $299 = $598 (Partner)
     * - Seats 4-5: 2 × $249 = $498 (Professional)
     * - Seats 6-7: 2 × $199 = $398 (Premier)
     * - Total virtual cost: $1893
     * - Effective rate: $1893 / 7 = $270.43
     * - Final charge: 2 × $270.43 = $541 (rounded)
     */
    async calculateMonthlyTotal(clinicId) {
        const counts = await this._getSeatCounts(clinicId);
        const totalSeats = counts.physicalSeats + counts.ghostSeats;

        if (totalSeats === 0) {
            return {
                physicalSeats: 0,
                ghostSeats: 0,
                totalSeats: 0,
                virtualTotal: 0,
                effectiveRate: 0,
                monthlyTotal: 0,
                tier: 'None'
            };
        }

        // Calculate cumulative staircase cost for ALL virtual seats
        // Uses the same TIERS array as growth.js for consistency
        let virtualTotal = 0;
        for (let i = 1; i <= totalSeats; i++) {
            const tier = TIERS.find(t => i >= t.min && i <= t.max) || TIERS[TIERS.length - 1];
            virtualTotal += tier.rate;
        }

        // Calculate effective rate (averaged across all seats)
        const effectiveRate = virtualTotal / totalSeats;

        // Final charge is effective rate × physical seats only
        const monthlyTotal = Math.round(effectiveRate * counts.physicalSeats);

        // Determine display tier name from current seat count
        const currentTier = TIERS.find(t => totalSeats >= t.min && totalSeats <= t.max) || TIERS[TIERS.length - 1];
        const tier = currentTier.name;

        return {
            physicalSeats: counts.physicalSeats,
            ghostSeats: counts.ghostSeats,
            totalSeats,
            virtualTotal,
            effectiveRate: Math.round(effectiveRate * 100) / 100, // 2 decimal places
            monthlyTotal,
            tier
        };
    }

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
     * Uses the single $1/unit price with quantity = calculated monthly total.
     */
    async createCheckoutSession(clinicId, successUrl, cancelUrl) {
        const customerId = await this.ensureCustomer(clinicId);
        const billing = await this.calculateMonthlyTotal(clinicId);

        // Ensure at least $1 for the initial subscription
        const quantity = Math.max(billing.monthlyTotal, 1);

        const session = await stripe.checkout.sessions.create({
            customer: customerId,
            mode: 'subscription',
            payment_method_types: ['card', 'us_bank_account'],
            payment_method_collection: 'always',
            line_items: [
                {
                    price: process.env.STRIPE_PRICE_ID,
                    quantity: quantity,
                }
            ],
            subscription_data: {
                metadata: {
                    clinic_id: clinicId,
                    tier: billing.tier,
                    physical_seats: billing.physicalSeats,
                    ghost_seats: billing.ghostSeats,
                }
            },
            success_url: successUrl,
            cancel_url: cancelUrl,
        });

        return session;
    }

    /**
     * Syncs a clinic's calculated monthly total to Stripe.
     * This ensures billing is updated when users are added/removed or referrals change.
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

        // 2. Calculate the new monthly total
        const billing = await this.calculateMonthlyTotal(clinicId);
        const quantity = Math.max(billing.monthlyTotal, 1);

        // 3. Update Stripe Subscription quantity
        const subscription = await stripe.subscriptions.retrieve(clinic.stripe_subscription_id);
        const subscriptionItemId = subscription.items.data[0].id;

        console.log(`[Stripe] Syncing quantity for clinic ${clinicId}: $${quantity} (${billing.physicalSeats} physical + ${billing.ghostSeats} ghost = ${billing.totalSeats} seats)`);
        await stripe.subscriptionItems.update(subscriptionItemId, {
            quantity: quantity,
        });

        // 4. Update metadata with current billing breakdown
        await stripe.subscriptions.update(clinic.stripe_subscription_id, {
            metadata: {
                clinic_id: clinicId,
                tier: billing.tier,
                physical_seats: billing.physicalSeats,
                ghost_seats: billing.ghostSeats,
                effective_rate: billing.effectiveRate,
            }
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

        // Count ghost seats: active referrals + churned referrals still in grace period
        // Must match growth.js logic exactly
        const referralRes = await pool.controlPool.query(`
            SELECT count(*) FROM public.clinic_referrals 
             WHERE referrer_clinic_id = $1 
             AND (
                status = 'active' 
                OR (status = 'churned' AND grace_period_expires_at > NOW())
             )`, [clinicId]);
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
        const priceId = subscription.items.data[0]?.price?.id;

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
        const result = await pool.controlPool.query('SELECT id, display_name FROM clinics WHERE stripe_customer_id = $1', [customerId]);
        const clinic = result.rows[0];

        if (clinic) {
            const clinicId = clinic.id;
            console.log(`[Stripe] ✅ Payment received for clinic ${clinic.display_name} (${clinicId}): $${(invoice.amount_paid / 100).toFixed(2)}`);

            try {
                // 1. Record the payment event
                await pool.controlPool.query(`
                    INSERT INTO platform_billing_events (clinic_id, stripe_event_id, event_type, amount_total, status)
                    VALUES ($1, $2, 'payment_succeeded', $3, 'completed')
                    ON CONFLICT (stripe_event_id) DO NOTHING`,
                    [clinicId, invoice.id, invoice.amount_paid]
                );

                // 2. AUTOMATICALLY ACTIVATE THE CLINIC SERVICE
                // This is the key automation - unlock billing and set status to active
                await pool.controlPool.query(`
                    UPDATE clinics 
                       SET billing_locked = false,
                           status = 'active',
                           last_payment_at = NOW(),
                           stripe_subscription_status = 'active'
                     WHERE id = $1`,
                    [clinicId]
                );

                console.log(`[Stripe] 🎉 Clinic ${clinic.display_name} service automatically activated!`);
            } catch (err) {
                console.error(`[Stripe] Error recording payment: ${err.message}`);
            }
        }
    }

    async _handlePaymentFailure(invoice) {
        const customerId = invoice.customer;
        const result = await pool.controlPool.query('SELECT id FROM clinics WHERE stripe_customer_id = $1', [customerId]);
        const clinicId = result.rows[0]?.id;

        if (clinicId) {
            console.error(`[Stripe] Payment failed for clinic ${clinicId}`);

            // Initiate/Evaluate Grace Period
            try {
                const clinicRes = await pool.controlPool.query(
                    "SELECT * FROM clinics WHERE id = $1",
                    [clinicId]
                );
                if (clinicRes.rows[0]) {
                    await gracePeriodService.evaluateClinic(clinicRes.rows[0]);
                }
            } catch (err) {
                console.error(`[Stripe] Failed to trigger grace period for ${clinicId}:`, err.message);
            }
        }
    }
}

module.exports = new StripeService();
