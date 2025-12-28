# PageMD EMR Billing & Subscription System

## Pricing Tiers

### 1. Starter Plan - $299/month
- **Target:** Solo practitioners, small practices (1-2 providers)
- **Features:**
  - Up to 2 provider accounts
  - Up to 500 patient records
  - Basic scheduling
  - Visit notes & documentation
  - E-Prescribe (250 scripts/month)
  - Basic support (email only)
  - 1GB document storage

### 2. Professional Plan - $599/month
- **Target:** Small to medium practices (3-10 providers)
- **Features:**
  - Up to 10 provider accounts
  - Unlimited patient records
  - Advanced scheduling with reminders
  - Visit notes & documentation
  - E-Prescribe (unlimited)
  - Lab integrations
  - Billing & Superbill generation
  - Priority support (email + chat)
  - 10GB document storage
  - Telehealth (50 sessions/month)

### 3. Enterprise Plan - $999/month
- **Target:** Large practices, multi-location (10+ providers)
- **Features:**
  - Unlimited provider accounts
  - Unlimited patient records
  - All Professional features
  - Multi-location support
  - API access
  - Custom integrations
  - Dedicated account manager
  - 24/7 phone support
  - 100GB document storage
  - Unlimited telehealth
  - Analytics & reporting
  - HIPAA audit reports

### 4. Custom/Enterprise Plus - Contact Sales
- Custom pricing for health systems
- On-premise deployment options
- SLA guarantees
- Custom development

---

## Database Schema

```sql
-- Subscription Plans (defined by platform)
CREATE TABLE subscription_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    price_monthly DECIMAL(10,2) NOT NULL,
    price_yearly DECIMAL(10,2),
    stripe_price_id_monthly VARCHAR(100),
    stripe_price_id_yearly VARCHAR(100),
    features JSONB DEFAULT '[]',
    limits JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Clinic Subscriptions
CREATE TABLE clinic_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(id),
    plan_id UUID NOT NULL REFERENCES subscription_plans(id),
    status VARCHAR(50) DEFAULT 'active', -- active, past_due, canceled, suspended, trialing
    billing_cycle VARCHAR(20) DEFAULT 'monthly', -- monthly, yearly
    
    -- Stripe info
    stripe_customer_id VARCHAR(100),
    stripe_subscription_id VARCHAR(100),
    
    -- Dates
    current_period_start TIMESTAMP,
    current_period_end TIMESTAMP,
    trial_start TIMESTAMP,
    trial_end TIMESTAMP,
    canceled_at TIMESTAMP,
    
    -- Grace period for failed payments
    grace_period_end TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Payment History
CREATE TABLE subscription_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID REFERENCES clinic_subscriptions(id),
    clinic_id UUID NOT NULL REFERENCES clinics(id),
    
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'USD',
    status VARCHAR(50), -- succeeded, failed, pending, refunded
    
    stripe_payment_intent_id VARCHAR(100),
    stripe_invoice_id VARCHAR(100),
    
    paid_at TIMESTAMP,
    failure_reason TEXT,
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- Invoices
CREATE TABLE subscription_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(id),
    subscription_id UUID REFERENCES clinic_subscriptions(id),
    
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    amount_due DECIMAL(10,2) NOT NULL,
    amount_paid DECIMAL(10,2) DEFAULT 0,
    currency VARCHAR(10) DEFAULT 'USD',
    status VARCHAR(50), -- draft, open, paid, void, uncollectible
    
    stripe_invoice_id VARCHAR(100),
    stripe_invoice_url TEXT,
    stripe_pdf_url TEXT,
    
    due_date TIMESTAMP,
    paid_at TIMESTAMP,
    
    line_items JSONB DEFAULT '[]',
    
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Implementation Plan

### Phase 1: Foundation (Week 1)
1. Create subscription plans table and seed initial plans
2. Add subscription tracking to clinics
3. Create billing service for subscription management

### Phase 2: Stripe Integration (Week 2)
1. Set up Stripe account and API keys
2. Implement Stripe Customer creation on clinic onboard
3. Implement subscription checkout flow
4. Set up Stripe webhooks for payment events

### Phase 3: Access Control (Week 3)
1. Add subscription status check middleware
2. Implement grace period logic (7 days after failed payment)
3. Add "suspended" state with limited read-only access
4. Create payment reminder emails

### Phase 4: Admin Dashboard (Week 4)
1. Revenue analytics in Platform Admin
2. Subscription management UI
3. Invoice history and download
4. Manual subscription overrides for admins

---

## Stripe Webhook Events to Handle

- `customer.subscription.created` - New subscription
- `customer.subscription.updated` - Plan changes
- `customer.subscription.deleted` - Cancellation
- `invoice.payment_succeeded` - Successful payment
- `invoice.payment_failed` - Failed payment (trigger grace period)
- `invoice.finalized` - Invoice ready
- `customer.subscription.trial_will_end` - Trial ending soon

---

## Access Control Logic

```javascript
// Middleware to check subscription status
const checkSubscription = async (req, res, next) => {
    const clinic = req.clinic;
    
    if (!clinic.subscription_status) {
        // No subscription - only allow trial/free tier features
        req.subscriptionTier = 'free';
        return next();
    }
    
    if (clinic.subscription_status === 'suspended') {
        // Clinic is suspended - read-only access
        if (req.method !== 'GET') {
            return res.status(403).json({
                error: 'Account suspended',
                message: 'Please update your payment method to continue using PageMD.',
                action: 'update_payment'
            });
        }
    }
    
    if (clinic.subscription_status === 'past_due') {
        // In grace period - show warning but allow access
        req.paymentWarning = true;
    }
    
    req.subscriptionTier = clinic.subscription_plan_slug;
    next();
};
```

---

## Environment Variables Needed

```env
# Stripe Configuration
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# Billing Settings
TRIAL_PERIOD_DAYS=14
GRACE_PERIOD_DAYS=7
```

---

## Next Steps

1. **Stripe Account Setup:** Create a Stripe account at https://stripe.com
2. **Create Products in Stripe:** Set up the three pricing plans
3. **Get API Keys:** Add to environment variables
4. **Run Database Migration:** Create the subscription tables
5. **Implement Checkout Flow:** Add subscription payment UI

Would you like me to proceed with implementing this system?
