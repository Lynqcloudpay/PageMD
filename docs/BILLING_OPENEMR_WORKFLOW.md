# OpenEMR-Style Billing Port Documentation

## Overview
This module replicates the core OpenEMR billing workflows (Billing Manager, Claims, Payments) using a modern React/Node architecture while maintaining database compatibility with OpenEMR's schema (`billing`, `claims`, `ar_session`, `ar_activity`).

## Workflows

### 1. Billing Manager (Superbill → Claim)
**Route**: `/billing/manager`
**Permission**: `billing:view` (Read), `billing:edit` (Generate)

*   **Filter**: Search unbilled encounters by Date Range.
*   **Grouped View**: Encounters are grouped by user/visit, aggregating multiple procedural codes (CPT).
*   **Action**: Select multiple encounters and click **Generate Claims**.
    *   **Backend Process**:
        *   Validates encounters.
        *   Generates X12 837P content.
        *   Creates `claims` record.
        *   Updates `billing` table (`billed = true`, `activity = 1`).

### 2. Claim Viewer & EDI
**Route**: `/claims/:id`
**Permission**: `billing:view`

*   **View**: Displays claim headers, patient info, and linked service lines.
*   **X12 Analysis**: Shows the raw EDI string generated for the claim.
*   **Download**: One-click download of `.x12` text file for clearinghouse submission.

### 3. Payment Posting (Account Receivables)
**Route**: `/billing/posting`
**Permission**: `billing:edit`

A wizard-style interface for posting payments and allocating them to line items.

*   **Step 1: Patient Search**: Find patient by Name or MRN.
*   **Step 2: Encounter Selection**: Lists "Open Encounters" (where Charges > Payments).
*   **Step 3: Ledger Review**: Shows the full financial history of the encounter (Charges, previous payments, adjustments).
*   **Step 4: Payment Entry**:
    *   Enter Amount, Method (Check/EFT), and Reference.
    *   **Auto-Allocate**: Button to distribute amount across unpaid lines.
    *   **Manual Allocation**: Fine-tune amounts per CPT code.
    *   **Validation**: Prevents posting if `Unapplied Amount` is not zero.
*   **Step 5: Process**:
    *   Submits to server with **Idempotency Key** to prevent double-posting.
    *   Atomic Transaction: Creates `ar_session` and `ar_activity` rows simultaneously.

## Database Schema & Integrity

The system uses the following OpenEMR-compatible tables in the tenant schema:

*   **billing**: Service lines (Charges).
*   **claims**: Generated claim headers and X12 content.
*   **ar_session**: Payment headers (Check info, total amount).
    *   *New Column*: `idempotency_key` (UUID UNIQUE) prevents duplicate posts.
*   **ar_activity**: Line-item payment allocations linked to `ar_session`.

## Security

*   **billing:view**: Required to search patients, view reports, view claims.
*   **billing:edit**: Required to Generate Claims or Post Payments.
*   **Audit**: All actions logged with `post_user` IDs.

## Developer Notes

*   **Services**: `client/src/services/billingOpenEMR.js` handles all API calls.
*   **API Routes**: `server/routes/billing-openemr.js`.
*   **Regression**: The `server/scripts/auditBillingPort.js` script verifies the entire flow from Billing to Payment.
