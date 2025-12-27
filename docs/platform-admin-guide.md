# Platform Admin (Super Admin) Guide

## Overview
As the platform owner, you have a separate **Super Admin** control layer that manages all clinics, subscriptions, billing, and support. This is completely separate from individual clinic data.

## Accessing Super Admin APIs

All Super Admin endpoints require the `X-Super-Admin-Secret` header:

```bash
curl -H "X-Super-Admin-Secret: YOUR_SECRET_KEY" \
  https://bemypcp.com/api/super/dashboard
```

**Set your secret** in the `.env.prod` file:
```
SUPER_ADMIN_SECRET=your-very-secure-secret-key-min-32-chars
```

---

## Available Endpoints

### 1. Dashboard Overview
**GET** `/api/super/dashboard`

Returns platform-wide metrics:
- Total clinics by status (active, suspended, trial)
- Active subscriptions breakdown
- Monthly revenue
- Open support tickets
- Recent clinic signups

**Example Response:**
```json
{
  "clinics": [
    { "status": "active", "count": 45 },
    { "status": "trial", "count": 12 }
  ],
  "revenue": {
    "total": "15420.00",
    "transactions": 38
  }
}
```

---

### 2. Clinic Management

#### List All Clinics
**GET** `/api/super/clinics?status=active&search=cardiology`

Query params:
- `status`: Filter by clinic status
- `search`: Search by name or slug

#### Get Clinic Details
**GET** `/api/super/clinics/:id`

Returns full clinic profile + usage metrics + payment history

#### Update Clinic Status
**PATCH** `/api/super/clinics/:id/status`

```json
{
  "status": "suspended",
  "reason": "Payment past due"
}
```

Allowed statuses: `active`, `suspended`, `deactivated`

#### Onboard New Clinic
**POST** `/api/super/clinics/onboard`

```json
{
  "clinic": {
    "slug": "clinic-name",
    "displayName": "Clinic Full Name",
    "specialty": "Primary Care"
  },
  "dbConfig": {
    "host": "db",
    "port": 5432,
    "dbName": "clinic_name_db",
    "dbUser": "emr_user",
    "password": "secure-password"
  }
}
```

Automatically creates:
- Clinic record
- Database connection
- 30-day trial subscription

---

### 3. Subscription & Billing

#### List All Subscriptions
**GET** `/api/super/subscriptions?status=active`

#### Record Payment
**POST** `/api/super/payments`

```json
{
  "clinic_id": "uuid-here",
  "amount": 299.00,
  "payment_method": "stripe",
  "transaction_id": "ch_abc123",
  "description": "Monthly subscription - Professional Plan"
}
```

#### Revenue Analytics
**GET** `/api/super/revenue?period=month`

Returns:
- Daily revenue breakdown
- Total revenue summary
- Average transaction value
- Number of paying clinics

---

### 4. Support Tickets

#### List Tickets
**GET** `/api/super/tickets?status=open&priority=high`

Query params:
- `status`: open, in_progress, resolved, closed
- `priority`: low, normal, high, urgent
- `clinic_id`: Filter by specific clinic

#### Update Ticket
**PATCH** `/api/super/tickets/:id`

```json
{
  "status": "in_progress",
  "assigned_to": "admin-uuid",
  "priority": "high"
}
```

---

## Database Access (For Advanced Queries)

You can directly query the Control Database:

```bash
# SSH into server
ssh -i your-key.pem ubuntu@bemypcp.com

# Access Control DB
docker exec -it emr-db psql -U emr_user -d emr_db

# Example queries:
\dt  # List all tables

SELECT display_name, status, subscription_status, created_at 
FROM clinics 
ORDER BY created_at DESC;

SELECT clinic_id, SUM(amount) as total_paid 
FROM payment_history 
WHERE status = 'completed' 
GROUP BY clinic_id;
```

---

## Business Metrics You Track

### Control Database Tables:

1. **`clinics`** - All registered clinics
   - Status, specialty, contact info
   - Trial dates, subscription status
   - Total providers/patients

2. **`clinic_subscriptions`** - Active subscriptions
   - Plan, billing cycle, renewal dates
   - Trial tracking

3. **`subscription_plans`** - Your pricing tiers
   - Features, limits, pricing

4. **`payment_history`** - Complete revenue log
   - Amount, method, transaction IDs
   - Success/failure tracking

5. **`support_tickets`** - Customer support
   - Status, priority, assignments
   - Response tracking

6. **`clinic_usage_metrics`** - Daily usage per clinic
   - Active providers, patients, visits
   - Storage, API calls

7. **`platform_audit_logs`** - All admin actions
   - Who did what, when

---

## Example Workflows

### Monthly Billing Cycle
```bash
# 1. Get all clinics due for renewal
GET /api/super/subscriptions?status=active

# 2. Charge via Stripe (external)
# 3. Record payment
POST /api/super/payments { ... }

# 4. Suspend non-payers
PATCH /api/super/clinics/:id/status { "status": "suspended" }
```

### Clinic Onboarding
```bash
# 1. Provision clinic
POST /api/super/clinics/onboard { ... }

# 2. Clinic receives credentials
# 3. 30-day trial starts automatically
# 4. Monitor usage during trial
GET /api/super/clinics/:id

# 5. Convert to paid or cancel
```

---

## Building a Frontend Dashboard

You can build a React/Vue/Svelte admin portal that calls these APIs:

**Recommended Sections:**
1. **Overview** - Dashboard stats
2. **Clinics** - List, search, manage
3. **Billing** - Subscriptions, payments, revenue charts
4. **Support** - Ticket queue, assignments
5. **Analytics** - Usage trends, growth metrics

**Example Tech Stack:**
- Next.js or Vite
- TailwindCSS
- Chart.js for revenue graphs
- React Table for clinic lists

---

## Security Best Practices

1. **Protect the Super Admin Secret**
   - Never commit to Git
   - Use environment variables
   - Rotate regularly

2. **Restrict Access**
   - Consider IP whitelisting
   - Add MFA for Super Admin login
   - Audit all platform actions

3. **Separate from Clinic Data**
   - Super Admin never accesses patient data
   - All queries use `pool.controlPool`
   - Physical database isolation

---

## Monitoring & Alerts

Set up alerts for:
- Failed payments
- High-priority support tickets
- Suspended clinics
- Trial expirations
- Unusual usage spikes

Use tools like:
- Sentry for error tracking
- Prometheus for metrics
- Slack webhooks for notifications
