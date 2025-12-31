# Billing Troubleshooting Guide

## Common Errors

### 1. `409 Conflict: Payment already posted`
*   **Cause**: You attempted to submit the same payment form twice (e.g., double-click or network retry).
*   **System Action**: The system detected a duplicate `idempotency_key` and blocked the second attempt.
*   **Resolution**: Do not repost. Check the ledger; the first payment likely succeeded.

### 2. `400 Bad Request: Allocations do not equal total payment`
*   **Cause**: The sum of line-item allocations does not match the Request Header `pay_total`.
    *   Example: Check Amount = $100.00, Allocated = $90.00. Unapplied = $10.00.
*   **Resolution**: Ensure `Unapplied` is exactly $0.00 in the UI. Explicitly allocate every cent.

### 3. `500 Internal Server Error` (during Claim Gen)
*   **Cause**: Database transaction failure or connectivity issue.
*   **System Action**: The transaction was ROLLED BACK. No partial claims were created.
*   **Resolution**: Retry the action.

## Auditing

### Missing Claims
*   Check `billing_event_log` for removal events (not yet implemented) or filter `billing` table for `billed=false`.

### Balance Mismatch
*   Balances are calculated dynamically (`Charges - Payments`).
*   Verify `billing` entries (active=true) vs `ar_activity` entries (deleted=null).
*   Run `balance-check` script if available.

## Contact
For Level 2 support, contact the Engineering Team with the `Trace ID` or `User ID`.
