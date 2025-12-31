# OpenEMR Fee Sheet Port Plan

## Objective
Replace the current Superbill system by porting OpenEMR’s Fee Sheet/Superbill billing implementation exactly (logic + workflow), adapting it to the PageMD EMR.

## 1. Workflow Summary
The port will replicate the following OpenEMR workflow:
- **Encounter-Based**: Every fee sheet is tied to a specific `visit_id`.
- **Patient Price Levels**: Pricing is dynamic based on the patient's assigned `price_level`.
- **Itemized Services**: Support for CPT/HCPCS codes with:
    - Multiple modifiers (mapped to `modifier1-4`).
    - Units/Quantity.
    - Fee/Charge (automated lookup from `fee_schedule`).
    - Diagnosis Pointers (`justify`): Linking services to specific encounter diagnoses.
    - NDC Tracking: Storing National Drug Code info for specific procedure codes.
- **Product Sales**: Integrated product/drug dispensing logic (mirroring `drug_sales`).
- **Concurrency Control**: Use of `version` (mirroring OpenEMR's `visitChecksum`) to prevent overwriting concurrent updates.
- **Persistence**: Atomic save operations for all line items, diagnoses, and payments.

## 2. Mapping Layer (OpenEMR -> PageMD)

| OpenEMR Element | PageMD Database / Implementation |
| :--- | :--- |
| `billing` table | `superbill_lines` |
| `drug_sales` table | `superbill_lines` (with `ndc_info` fields) or new `drug_sales` table |
| `prices` table | `fee_schedule` (using `code_type`, `code`, `price_level`) |
| `justify` (Pointers) | `superbill_lines.diagnosis_pointers` (colon-separated or array) |
| `pricelevel` | `patients.price_level` |
| `billed` / `activity` flags | `superbills.status` and `superbill_lines.is_active` |
| `FeeSheet.class.php` | `server/services/FeeSheetService.js` |
| `BillingUtilities.php` | `server/services/BillingService.js` |

## 3. Technical Implementation Plan

### Step 1: Database Refinement
- Ensure `tenantSchema.js` includes all fields required by OpenEMR logic.
- Add `billing_modifiers` for standard lookup.
- (Completed) Added `price_level` to `fee_schedule`, `patients`, and `practice_settings`.

### Step 2: Backend Logic Port (Node.js)
- **`BillingService.js`**:
    - `addBilling()`: Mirror OpenEMR's insertion logic, including user/provider tracking.
    - `getBillingByEncounter()`: Fetch all active billing entries for a visit.
- **`FeeSheetService.js`**:
    - `calculateFee()`: Replicate `getPrice()` with `price_level` support.
    - `saveFeeSheet()`: Replicate the complex `save()` loop from `FeeSheet.class.php`, handling adds, updates, and deletes.
    - `validateInventory()`: Mirror `checkInventory()` for products.

### Step 3: API Alignment
- Update `/server/routes/superbills.js` to use the new Services.
- Ensure endpoints handle the `expected_version` for concurrency.

### Step 4: Frontend UI Port (React)
- **`FeeSheet` Component**: Rebuild the UI to match OpenEMR's layout and behavior.
- **Diagnosis Selection**: Improve the diagnosis list and pointer selection (justification).
- **Service Entry**: Inline editing for modifiers, units, and fees (per permission).
- **Category Picker**: The "Fee Sheet Categories" dropdowns for fast code addition.

## 4. Deployment & Verification Checklist
1.  **Smoke Test**: Create a superbill, add services, link diagnoses, and save.
2.  **Pricing Test**: Verify different fees applied for "Standard" vs "Level 1" patients.
3.  **Concurrency Test**: Open the same superbill in two tabs and verify the second save fails due to version mismatch.
4.  **Pointer Validation**: Ensure diagnosis pointers correctly reference the active diagnosis list.
5.  **Audit Logs**: Verify all changes are recorded in `superbill_audit_logs`.
