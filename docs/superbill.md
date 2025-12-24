
# Commercial-Grade Superbill System Architecture

## 1. Core Principle
- **Encounter-Based**: Superbill belongs to a `visit` (encounter) via `visit_id`.
- **Note Independence**: `note_id` is nullable. Billing is NOT blocked by note status (draft/signed).
- **Single Active Superbill**: Only one active (non-VOID) superbill per visit.

## 2. Superbill Lifecycle
- **DRAFT**: Editable state. Created automatically or manually.
- **READY**: Marked as complete but not yet finalized (optional workflow step).
- **FINALIZED**: Locked state. Immutable. Ready for claims generation.
- **VOID**: Canceled state.

## 3. Database Schema

### `superbills`
| Column | Type | Description |
|---|---|---|
| id | UUID | PK |
| visit_id | UUID | FK -> visits (Encounter) |
| patient_id | UUID | FK -> patients |
| note_id | UUID | FK -> visits (nullable) |
| status | ENUM | DRAFT, READY, FINALIZED, VOID |
| rendering_provider_id | UUID | FK -> users |
| billing_provider_id | UUID | FK -> users |
| facility_location_id | UUID | FK -> locations |
| total_charges | DECIMAL | Computed total |
| ... | ... | Dates, Accident Info, etc. |

### `superbill_diagnoses`
- Up to 12 ICD-10 codes.
- Sequence (1-12).

### `superbill_lines`
- CPT/HCPCS codes.
- Modifiers 1-4.
- Diagnosis Pointers (string "1,2,4").
- Units, Charges.

## 4. Finalization Rules
- **Mandatory Fields**:
  - At least 1 Diagnosis.
  - At least 1 Line Item.
  - Rendering Provider + NPI.
  - Place of Service.
- **Validation**:
  - Diagnosis Pointers MUST be present for every line.
  - Totals must be non-negative.
- **Unsigned Note Warning**: If `visit.note_signed_at` is null, warn user but ALLOW finalization.

## 5. Outputs
- **PDF**: Printable format with standard CMS-1500 layout logic.
- **CMS-1500 JSON**: Field-mapped export.
- **EDI 837P**: Loop-structure ready export.
