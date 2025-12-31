# Billing Module Deployment Guide

## Prerequisites
*   Node.js v18+
*   PostgreSQL 14+

## Migration Steps (Phase 1)
Run the hardening migration to add Idempotency and Audit Logging.

```bash
cd server
node scripts/updateBillingPhase1.js
```

**Verification:**
*   Check table `claims` has column `idempotency_key`.
*   Check table `billing_event_log` exists.

## Smoke Testing
After deployment, run the integration suite:

```bash
cd server
node scripts/auditBillingPort.js
```

Expected Output:
*   TEST A: Billing Manager Report ... 200 OK
*   TEST B: Claim Generation ... 200 OK
*   TEST C: Payment Posting ... 200 OK
*   TEST D: Balance Check ... OK

## Configuration
*   Ensure `JWT_SECRET` is set.
*   Ensure `DB_HOST` is accessible.
