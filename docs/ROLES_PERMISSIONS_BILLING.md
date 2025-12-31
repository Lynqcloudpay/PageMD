# Billing Roles & Permissions

The billing module uses strict Role-Based Access Control (RBAC).

## Permissions

### `billing:view`
*   **Description**: Read-only access to billing data.
*   **Granted To**: Billers, Front Desk, Clinicians, Auditors.
*   **Capabilities**:
    *   Search Patients.
    *   View Open Encounters.
    *   View Ledgers (Charges/Payments).
    *   View Claims & X12 Data.
    *   Run Billing Reports.

### `billing:edit`
*   **Description**: Write access to financial records.
*   **Granted To**: Billers, Practice Managers.
*   **Capabilities**:
    *   Generate Claims (Create `claims`, Update `billing`).
    *   Post Payments (Create `ar_session`, `ar_activity`).
    *   Void/Reverse Payments (Future).
    *   Update Fee Schedules (Future).

## Role Definitions

| Role | Permissions | Responsibilities |
| :--- | :--- | :--- |
| **Biller** | `billing:view`, `billing:edit` | Full Revenue Cycle Management. |
| **Front Desk** | `billing:view` | Collect copays (if separate app), View Balances. |
| **Clinician** | `billing:view` | Review charges on their visits. |
| **Auditor** | `billing:view` | Compliance checks. |

## Implementation
Permissions are enforced at the API route level using `requirePermission('...')`.
Tests verify that users without `billing:edit` receive `403 Forbidden` on POST endpoints.
