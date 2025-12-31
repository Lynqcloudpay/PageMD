# UAT Checklist for Payment Posting (Phase 2)

Use this exact checklist so results are unambiguous.
**500 Errors are considered FAIL.**

## A) Payment Posting

### 1. Partial Allocation
*   **Setup**: Charge: `$150`.
*   **Action**: Post `$40`.
*   **Expected**:
    *   Balance = `$110`.
    *   `ar_session.pay_total` = `$40`.
    *   One or more `ar_activity` lines totaling `$40`.
    *   HTTP 200.

### 2. Multi-line Allocation
*   **Setup**: Two CPTs (e.g., `$60` + `$90`).
*   **Action**: Post `$100` split `$60`/`$40`.
*   **Expected**:
    *   Two `ar_activity` rows.
    *   Correct remaining balance per CPT.
    *   HTTP 200.

### 3. Invalid Code
*   **Setup**: Any visit.
*   **Action**: Try allocating to a CPT code NOT on the visit.
*   **Expected**:
    *   **HTTP 400 Bad Request**.
    *   Message: `ALLOCATION_INVALID_CODE` or similar.
    *   No new `ar_session` row created (rollback).

### 4. Overpayment
*   **Setup**: Visit with balance `$50`.
*   **Action**: Try paying `$60` (without credit row).
*   **Expected**:
    *   **HTTP 400 Bad Request**.
    *   Message: `ALLOCATION_OVERPAYMENT`.
    *   No rows inserted.

### 5. Idempotency
*   **Setup**: Valid payment payload.
*   **Action**: Double-submit same payment (simulate double-click or replay).
*   **Expected**:
    *   First request: **HTTP 200**.
    *   Second request: **HTTP 409 Conflict**.
    *   Only one `ar_session` exists in DB.

## B) Reports

### 1. AR Aging Reconciliation
*   **Action**: Pick one patient from each bucket (0-30, 31-60, etc.) in the report.
*   **Check**: Compare Report Amount vs Patient Ledger Balance.
*   **Expected**: Matches exactly.

### 2. Collections Action
*   **Action**: Select a 120+ day account. Click "Send to Collections".
*   **Expected**:
    *   Event logged in `billing_event_log`.
    *   UI reflects "Sent" status (if implemented) or Report updates.
    *   Repeated click does not create duplicate log entries (idempotent).

## C) Security

### 1. Role Access
*   **Action**: Log in as “biller” (non-admin).
*   **Expected**:
    *   Can view Billing Reports.
    *   Can Post Payments.
    *   **Cannot** access Admin-only routes (e.g., User Management, Settings).
