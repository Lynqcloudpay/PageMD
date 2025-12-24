# Superbill Hardening - Remaining Items

## Completed ✅
1. Diagnosis source tracking (MANUAL, NOTE, ORDER)
2. Strict backend validation on finalize (NPI, POS, pointers)
3. Database schema for revisions (previous_version_id, claim_frequency_code)
4. Sync endpoint for pulling updates from notes/orders
5. Diagnosis pointers input (fixed focus issue)

## Priority 1: Charges & Fee Schedule 🔴
**Problem**: All charges show $0.00
**Fix Needed**:
- [ ] Auto-populate charges from fee_schedule when CPT is selected
- [ ] Update suggested lines to fetch and use fee_schedule rates
- [ ] Add validation warning if total charges = $0 on finalize

## Priority 2: Auto-Populate Providers & POS 🔴  
**Problem**: Providers and facility dropdowns empty
**Fix Needed**:
- [ ] Auto-fill rendering_provider from visit.provider_id
- [ ] Auto-fill billing_provider (default to rendering or org default)
- [ ] Auto-fill facility_location from visit or org default
- [ ] Pre-select POS from visit type or default to '11' (Office)

## Priority 3: Insurance Display 🟡
**Problem**: No insurance information visible
**Fix Needed**:
- [ ] Fetch and display patient's active insurance policy
- [ ] Show: Payer name, Member ID, Group #
- [ ] Add Authorization # field (optional)
- [ ] Link to insurance_policies table

## Priority 4: Modifiers UI Enhancement 🟡
**Current**: Has 4 modifier text inputs
**Enhancement Needed**:
- [ ] Make modifier inputs more obvious (visible labels)
- [ ] Consider dropdown/autocomplete for common modifiers
- [ ] Add helper text for common modifiers (25, 59, etc.)

## Priority 5: Diagnosis Pointer Validation 🟡
**Current**: Free text (user can type "99")
**Enhancement Needed**:
- [ ] Validate pointers against actual diagnosis count
- [ ] Show error if invalid pointer (e.g., "5" when only 3 dx exist)
- [ ] Consider multi-select dropdown UI for better UX
- [ ] Block finalize if any line has invalid pointers

## Priority 6: Billing.jsx Conflicts 🔴
**Problem**: Billing modal filters/requirements conflict with new design
**Fixes Needed**:
- [ ] Remove `.filter(v => v.note_signed_at || v.locked)` - show all visits
- [ ] Remove requirement for diagnosisCodes/procedureCodes before "Create"
- [ ] Allow creating superbill with just visit selected
- [ ] Add "(Unsigned)" label for draft notes

## Priority 7: Finalize Validation Checklist
**Current Backend Checks**:
- ✅ ≥1 Dx
- ✅ ≥1 CPT line  
- ✅ every CPT has diagnosis_pointers (added)
- ✅ rendering_provider_id has NPI
- ✅ billing_provider_id has NPI
- ✅ POS present

**Still Needed**:
- [ ] service_date validation
- [ ] Warn/block if total charges = $0
- [ ] Validate pointer format and range

## Lower Priority Enhancements
- [ ] Verify/remove old Superbill component if duplicate exists
- [ ] Add claim frequency code UI (currently backend-only)
- [ ] Add revision history viewer
- [ ] Implement "Reopen" functionality for finalized superbills

## Testing Checklist
- [ ] Create superbill from visit with orders → suggested lines appear
- [ ] Sync button adds new diagnoses from note
- [ ] Charges auto-populate from fee schedule
- [ ] Providers auto-fill from visit
- [ ] Cannot finalize with missing required fields
- [ ] Diagnosis pointers validated
- [ ] PDF export includes all data
- [ ] CMS-1500 JSON structure correct
