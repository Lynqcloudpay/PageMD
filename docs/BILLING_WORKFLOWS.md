# OpenEMR Billing Workflows

## Core Workflow: The Revenue Cycle

### 1. The Encounter (Clinical)
*   **Provider** completes a visit note.
*   **Superbill** is generated (automatically or manually).
*   **Status**: `Unbilled`.
*   **Table**: `billing` (activity=1, billed=0).

### 2. Claim Generation (Backoffice)
*   **Role**: Biller (`billing:edit`).
*   **Tool**: Billing Manager (`/billing/manager`).
*   **Action**:
    1.  Select Date Range.
    2.  Filter `Unbilled`.
    3.  Select Encounters.
    4.  Click **Generate Claims**.
*   **Outcome**:
    *   `claims` record created (Version 1).
    *   `billing` record updated (`billed=1`, `x12_partner_id=...`).
    *   **Audit**: `claim_generated` event logged.
    *   **Idempotency**: Prevents double-generation if button clicked twice.

### 3. Claim Submission (Clearinghouse)
*   **Role**: Biller.
*   **Tool**: Claim Viewer (`/claims/:id`).
*   **Action**: Download X12 file.
*   **Process**: Upload to Clearinghouse (Office Ally, Availity, etc.).

### 4. Payment Posting (ERA/Manual)
*   **Role**: Poster (`billing:edit`).
*   **Tool**: Payment Posting (`/billing/posting`).
*   **Action**:
    1.  Receive Check/ERA.
    2.  Search Patient.
    3.  Select Encounter (Open Balance).
    4.  **Auto-Allocate**: Match payment to line items.
    5.  **Validation**: Total Payment must equal Sum of Allocations.
    6.  **Submit**.
*   **Outcome**:
    *   `ar_session` created (Header).
    *   `ar_activity` created (Line Items).
    *   Balances updated.
    *   **Audit**: `payment_posted` event logged.
*   **Safety**:
    *   **Atomic Transaction**: Header and Lines commit together.
    *   **Idempotency**: Duplicate `idempotency_key` returns `409 Conflict`.

### 5. Patient Statements (Patient Responsibility)
*   **Role**: Biller / Front Desk.
*   **Tool**: Patient Statements (`/billing/statements`).
*   **Action**:
    1.  Search Patient.
    2.  Select Date Range.
    3.  Generate PDF/Print View.
*   **Outcome**:
    *   Generates a detailed statement showing Charges, Payments, and Adjustments per encounter.
    *   Calculates "Patient Balance".

### 6. Reports & Analytics
*   **Role**: Administrator / Biller.
*   **Tool**: Billing Reports (`/billing/reports/ar-aging`).
*   **Reports**:
    *   **AR Aging**: Shows patient balances bucketed by age (0-30, 31-60, 60-90, 120+).
    *   **Collections Report**: Daily log of payments posted (`/billing/reports/collections`).

### 7. Insurance Verification (Frontend)
*   **Role**: Front Desk.
*   **Tool**: Patient Header (Chart).
*   **Action**: Click "Verify Eligibility".
*   **Outcome**:
    *   Checks policy status (Mocked currently).
    *   Returns Active/Rejected status immediately.

### 8. Collections Management
*   **Role**: Billing Manager.
*   **Tool**: AR Aging Report.
*   **Action**:
    *   Identify "120+" overdue balances.
    *   Click **Collect** (Send to Collections).
*   **Outcome**:
    *   Encounter marked as Sent to Collections.
    *   Audit log entry created (`sent_collections`).
