# Superbill Hardening Progress Report

## ✅ Completed (Production Ready)

### 1. **Database Schema & Audit Trail**
- ✅ `source` column for diagnosis provenance (MANUAL, NOTE, ORDER)
- ✅ `claim_frequency_code` for resubmissions (1=Original, 7=Replacement, 8=Void)
- ✅ `previous_version_id` and `revision_reason` for revision tracking
- ✅ `superbill_audit_logs` table for full audit trail
- ✅ `superbill_suggested_lines` for sync engine

### 2. **Strict Backend Validation on Finalize**
- ✅ Rendering provider must have NPI
- ✅ Billing provider must have NPI
- ✅ Place of service must be present
- ✅ At least 1 diagnosis required
- ✅ At least 1 procedure line required
- ✅ Every procedure line must have diagnosis_pointers
- ✅ Returns detailed validation error list (400) if any check fails

### 3. **Diagnosis Source Tracking & UI**
- ✅ Backend: Diagnoses tagged with source when created
  - `MANUAL` = user added via UI
  - `NOTE` = extracted from clinical note Assessment
  - `ORDER` = pulled from order diagnoses
- ✅ Frontend: Color-coded chips showing source
  - Blue badge for "NOTE"
  - Purple badge for "ORDER"
  - Gray badge for "MANUAL"

### 4. **Sync Engine**
- ✅ `POST /api/superbills/:id/sync` endpoint
- ✅ Pulls new diagnoses from note Assessment section
- ✅ Creates suggested lines from new orders
- ✅ Avoids duplicates
- ✅ Audit logged

### 5. **Medical Necessity Assistant**
- ✅ Clinical note panel in superbill UI
- ✅ Toggle to show/hide full note
- ✅ Helps billers see justification for diagnoses

### 6. **Suggested Lines Panel**
- ✅ Shows CPT codes auto-suggested from orders
- ✅ "Accept" promotes to billing line
- ✅ "Reject" dismisses suggestion
- ✅ Distinction between billing lines and suggestions

### 7. **Column Name Fixes** (Critical Bug Fixes)
- ✅ Fixed `type` → `order_type` in orders queries
- ✅ Fixed `description` → `test_name` in orders queries  
- ✅ Applied to both `/from-visit` and `/sync` endpoints

### 8. **Diagnosis Pointers Input Fix**
- ✅ Fixed input losing focus on keystroke
- ✅ Only refetch data when units/charge change (not modifiers/pointers)

### 9. **Charge Auto-Population** 🆕
- ✅ Suggested lines now fetch charges from `fee_schedule` table
- ✅ Charges default to fee_amount instead of $0.00
- ✅ Applied to both initial creation and sync operations

---

## 🔄 Next Priority Items

### Priority 1: Providers & Facility Auto-Fill
**Status**: Partially implemented (backend sets defaults, but may need UI enhancement)
- Backend already defaults rendering/billing provider from visit
- May need to verify auto-population is visible in UI

### Priority 2: Billing.jsx Modal Conflicts
**Issue**: Modal filters out unsigned visits and requires codes before creation
**Fix Needed**:
```javascript
// Remove this filter (line 786-787):
.filter(v => v.note_signed_at || v.locked)

// Show all visits, add "(Unsigned)" label for drafts

// Allow creating superbill without diagnosisCodes/procedureCodes requirement
```

### Priority 3: Insurance Display
**Add to Superbill UI**:
- Fetch patient's active insurance policy
- Display: Payer name, Member ID, Group #
- Add Authorization # input field

### Priority 4: Finalize Validation Enhancement
**Add checks for**:
- ⚠️ Warn if total_charges = $0 (requires user confirmation)
- ✅ Service date validation (already present in schema)
- ✅ Diagnosis pointer format validation

### Priority 5: Modifiers UI Enhancement
**Current**: 4 text input fields (works but not obvious)
**Enhancement**: Make labels clearer, consider dropdown for common modifiers

### Priority 6: Diagnosis Pointer Validation
**Add**:
- Client-side validation (prevent typing "5" when only 3 diagnoses exist)
- Server-side validation on finalize
- Consider multi-select dropdown UI

---

## 📊 Commercial Readiness Score

| Feature | Status | Score |
|---------|--------|-------|
| Encounter-based workflow | ✅ Complete | 10/10 |
| Diagnosis source tracking | ✅ Complete | 10/10 |
| Strict finalize validation | ✅ Complete | 10/10 |
| Sync engine | ✅ Complete | 10/10 |
| Audit logging | ✅ Complete | 10/10 |
| Charge auto-population | ✅ Complete | 10/10 |
| Diagnosis pointers | ✅ Functional | 8/10 (needs validation guardrails) |
| Provider/Facility defaults | ⚠️ Partial | 7/10 (backend done, UI needs verification) |
| Insurance display | ❌ Missing | 0/10 |
| Modifiers | ⚠️ Basic | 6/10 (functional but not user-friendly) |
| Billing modal workflow | ❌ Conflicts | 3/10 (filters/requirements don't match design) |

**Overall**: **75/100** (Production-ready core, needs polish for billing workflows)

---

## 🎯 Recommendations

### For Immediate Production Use:
1. ✅ Core superbill creation/editing works
2. ✅ Finalize validation is strict and audit-proof
3. ✅ Charges now auto-populate (not $0.00)
4. ⚠️ Use the direct superbill editor, avoid Billing.jsx modal for now

### For External Billing Company Handoff:
1. Fix Billing.jsx modal conflicts (Priority 2)
2. Add insurance display (Priority 3)
3. Add pointer validation (Priority 6)
4. Test end-to-end with real orders/notes

### For Full Commercial Polish:
- Complete all Priority items 1-6
- Add revision/reopen functionality
- Add claim frequency code UI
- Enhance PDF/CMS-1500/837P exports with all new fields

---

## 🚀 Deployment Status
- Latest commit: `64308b9` - "Feature: Auto-populate charges from fee schedule"
- Deployed to: `https://bemypcp.com`
- All tests: Passing ✅
- Ready for: Demo to billers, testing with real encounters
