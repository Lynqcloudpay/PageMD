# OpenEMR Billing Port Plan

## Objective
Port the entire OpenEMR billing system (Claims, AR, Posting, Reports) to the PageMD Node/React stack, replacing any existing minimal billing implementation.

## 1. Database Schema Mapping
We will replicate OpenEMR tables in the Postgres tenant schema.

| OpenEMR Table | PageMD Table | Description |
|or|---|---|
| `billing` | `billing` | Stores line items (CPT/HCPCS) pending or billed. |
| `ar_session` | `ar_session` | Payment/Adjustment headers (Check/EOB info). |
| `ar_activity` | `ar_activity` | Payment/Adjustment details (Line item allocation). |
| `claims` | `claims` | History of generated claims (X12/HCFA) with status and content. |
| `x12_partners` | `x12_partners` | Configuration for Clearinghouses/Payers (Receiver IDs, ISA/GS segments). |
| `form_encounter` | `visits` | Visit/Encounter metadata. We use `visits`. Need `last_level_billed` column? |
| `insurance_companies` | `insurance_companies` | Payer definitions. |

### Schema Definitions (to be added to `tenantSchema.js`)

**claims**
```sql
CREATE TABLE claims (
  patient_id BIGINT NOT NULL,
  encounter_id INT NOT NULL,
  version INT NOT NULL DEFAULT 1,
  payer_id INT DEFAULT 0,
  status INT DEFAULT 0, -- 0=Queued, 1=Billed, 2=Paid, etc.
  payer_type INT DEFAULT 0,
  bill_process INT DEFAULT 0,
  bill_time TIMESTAMP,
  process_time TIMESTAMP,
  process_file VARCHAR(255),
  target VARCHAR(30),
  x12_partner_id INT DEFAULT 0,
  submitted_claim TEXT, -- X12 blob
  PRIMARY KEY (patient_id, encounter_id, version)
);
```

**x12_partners**
```sql
CREATE TABLE x12_partners (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255),
  id_number VARCHAR(255),
  x12_sender_id VARCHAR(255),
  x12_receiver_id VARCHAR(255),
  processing_format VARCHAR(50), -- 'standard', 'cms', etc.
  x12_isa01 VARCHAR(2) DEFAULT '00',
  x12_isa02 VARCHAR(10) DEFAULT '          ',
  x12_isa03 VARCHAR(2) DEFAULT '00',
  x12_isa04 VARCHAR(10) DEFAULT '          ',
  x12_isa05 CHAR(2) DEFAULT 'ZZ',
  x12_isa07 CHAR(2) DEFAULT 'ZZ',
  x12_isa14 CHAR(1) DEFAULT '0',
  x12_isa15 CHAR(1) DEFAULT 'P',
  x12_gs02 VARCHAR(15),
  x12_gs03 VARCHAR(15)
);
```

**Updates to existing tables**
- `visits` (aka `encounters`): Ensure `last_level_billed` (INT) exists.
- `billing`: Ensure `billed` (INT), `activity` (Boolean/Int), `x12_partner_id` (INT) exist.

## 2. Functional Mapping

| OpenEMR Functionality | Node Service (`server/services/billingService.js`) | Description |
|---|---|---|
| `billing_report.php` (Search) | `getBillingReport(criteria)` | Filter unbilled/billed items. |
| `billing_process.php` (Gen X12) | `generateClaims(encounters, partnerId)` | Create `claims` rows, set `billing.billed=1`, Output X12. |
| `new_payment.php` (Save Session) | `createARSession(data)` | Create `ar_session` row. |
| `DistributionInsert` (Post line) | `postARActivity(items)` | Create `ar_activity` rows, update/calc balances. |
| `ProcessingTask` | `BillingProcessor` (Class) | Modular claim generation logic. |

## 3. UI Page Mapping (React)

| OpenEMR Screen | New React Page | Route |
|---|---|---|
| Billing Manager (`billing_report.php`) | `BillingManager.jsx` | `/billing/manager` |
| New Payment (`new_payment.php`) | `PaymentPosting.jsx` | `/billing/payments/new` |
| Search Payment (`search_payments.php`) | `PaymentSearch.jsx` | `/billing/payments` |
| X12 Partners (Admin) | `X12Partners.jsx` | `/settings/billing/partners` |
| Patient Ledger (Patient Summary) | `PatientLedger.jsx` | `/patient/:id/ledger` |

## 4. Workflows

### API Endpoints
- `GET /api/billing/unbilled` (for Manager)
- `POST /api/billing/claims/generate` (Generate X12)
- `GET /api/billing/claims/:id` (Download X12)
- `POST /api/billing/payments` (Create Session)
- `POST /api/billing/payments/:id/distribute` (Post Activity)
- `GET /api/billing/partners` (X12 Partners)

### Step-by-Step Port
1. **Schema Update**: Update `tenantSchema.js` and run migration script.
2. **Backend**:
   - Implement `BillingService` methods for claim generation (stub X12 format or implement basic 837).
   - Implement `ARService` for `ar_session`/`ar_activity`.
3. **Frontend**:
   - `BillingManager`: Grid of encounters, checkbox to select, "Generate X12" button.
   - `PaymentPosting`: Header inputs (check amt, date) + Detail grid (encounters with balances).
   - `Ledger`: View `ar_activity` history.

## 5. Verification
- Verify Fee Sheet entries appear in `BillingManager`.
- Verify Generating Claim creates `claims` row and marks `billing` as billed.
- Verify Posting Payment updates balance and creates `ar_activity`.

## 6. Completed Backend Implementation (Current Status)

### Database Schema
- **Modified Tables**:
  - `billing`: Verified/Updated columns for OpenEMR compatibility.
  - `claims`: Replaced with versioned schema (OpenEMR style) + compatibility columns.
  - `visits`: Added `last_level_billed`.
- **New Tables**:
  - `ar_session`: Payment headers.
  - `ar_activity`: Payment line item distribution.
  - `x12_partners`: Clearinghouse configuration.

### Services
- **BillingService (`server/services/billingService.js`)**:
  - `getBillingReport(criteria)`: Search billing items.
  - `generateClaims(encounters, partnerId)`: Create claims, update billing status, stub X12 generation.
- **ARService (`server/services/arService.js`)**:
  - `createSession(data)`: Create payment session.
  - `postActivity(sessionId, items)`: Distribute payments.
  - `getEncounterBalance(encounterId)`: Calculate real-time balance.

### API Routes (`/api/billing-openemr`)
- `GET /reports` -> Billing Manager data.
- `POST /claims/generate` -> Generate claims.
- `POST /ar/session` -> New Payment.
- `POST /ar/session/:id/distribute` -> Post Payment Details.
- `GET /encounter/:id/balance` -> Get Balance.
