# Mother Patient System - UI Cutover Documentation

## Overview

This document tracks the UI cutover from legacy endpoints to Mother endpoints, ensuring no split-brain data access.

---

## ChartGateway API

**File**: `client/src/api/ChartGateway.js`

### Methods

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `getPatientSummary(patientId)` | `GET /api/mother/patient/:id/summary` | Demographics + state + recent events |
| `getPatientState(patientId)` | `GET /api/mother/patient/:id/state` | Current vitals, meds, dx, orders, allergies |
| `getPatientTimeline(patientId, opts)` | `GET /api/mother/patient/:id/timeline` | Event history with pagination |
| `getAIContext(patientId)` | `GET /api/mother/patient/:id/ai-context` | Optimized context for AI agents |
| `searchDocuments(patientId, query)` | `GET /api/mother/patient/:id/documents?query=` | Full-text document search |
| `getDocuments(patientId)` | `GET /api/mother/patient/:id/documents` | All patient documents |
| `recordVitals(patientId, encounterId, data)` | `POST /api/mother/patient/:id/vitals` | Record new vitals |
| `addMedication(patientId, encounterId, data)` | `POST /api/mother/patient/:id/medications` | Add medication |
| `addDiagnosis(patientId, encounterId, data)` | `POST /api/mother/patient/:id/diagnoses` | Add diagnosis |

---

## Updated Components

### Core Chart Surfaces

| Component | File Path | Mother Endpoint Used | Status |
|-----------|-----------|---------------------|--------|
| **Snapshot** | `client/src/pages/Snapshot.jsx` | `ChartGateway.getPatientSummary()` | ✅ Integrated |
| PatientHeader | `client/src/components/PatientHeader.jsx` | Via Snapshot parent | ✅ Inherited |

### Integration Details

#### Snapshot.jsx

**Import Added**:
```javascript
import ChartGateway from '../api/ChartGateway';
```

**Data Flow**:
1. Component mounts → `refreshPatientData()` called
2. First attempts: `ChartGateway.getPatientSummary(id)`
3. On success: Sets `motherDataStatus = 'ok'`, populates state from `motherSummary.state`
4. On failure: Sets `motherDataStatus = 'error'`, falls back to legacy `patientsAPI.getSnapshot()`
5. Debug banner shows current status

**State Source Mapping**:
| UI State | Mother Source |
|----------|---------------|
| `problems` | `motherSummary.state.problems` |
| `medications` | `motherSummary.state.medications` |
| `allergies` | `motherSummary.state.allergies` |
| `patient` (demographics) | `motherSummary.demographics` |

**Debug Banner** (dev-only):
```jsx
{process.env.NODE_ENV === 'development' && (
    <div className={...}>
        Mother Data: {motherDataStatus.toUpperCase()} | 
        Meds: {medications.length} | 
        Dx: {problems.length} | 
        Allergies: {allergies.length}
    </div>
)}
```

---

## Legacy Endpoint Status

### Patient Data Endpoints

| Endpoint | Status | Action |
|----------|--------|--------|
| `GET /api/patients/:id/snapshot` | ⚠️ Active (fallback) | Keep for transition |
| `GET /api/mother/patient/:id/summary` | ✅ Primary | Used by ChartGateway |
| `GET /api/mother/patient/:id/state` | ✅ Active | Direct state access |
| `GET /api/mother/patient/:id/timeline` | ✅ Active | Event history |

### Write Endpoints Routed Through Mother

| Action | Legacy Route | Mother Method |
|--------|--------------|---------------|
| Add Medication | `POST /api/patients/:id/medications` | `MotherWriteService.addMedication()` |
| Add Diagnosis | `POST /api/patients/:id/problems` | `MotherWriteService.addDiagnosis()` |
| Add Allergy | `POST /api/patients/:id/allergies` | `MotherWriteService.addAllergy()` |
| Record Vitals | Visit sign flow | `MotherWriteService.recordVital()` |
| Create Order | `POST /api/orders` | `MotherWriteService.placeOrder()` |
| Upload Document | `POST /api/documents` | `DocumentStoreService.storeDocument()` |
| Create Appointment | `POST /api/appointments` | `MotherWriteService.scheduleAppointment()` |
| Send Message | `POST /api/messages` | `MotherWriteService.sendMessage()` |
| Create Patient | `POST /api/intake/.../approve` | `MotherWriteService.createPatient()` |
| Update Patient | `POST /api/intake/.../approve` | `MotherWriteService.updatePatient()` |

---

## Verification Steps

### 1. Visual Confirmation (Dev Mode)

When viewing any patient chart in development:
- Look for the debug banner at top of page
- Should show: `Mother Data: OK | Meds: X | Dx: Y | Allergies: Z`

### 2. Network Tab Verification

Open browser DevTools → Network tab:
1. Navigate to patient chart
2. Filter by "mother"
3. Should see: `GET /api/mother/patient/{id}/summary` request
4. Response should contain `{ demographics, state, recentEvents }`

### 3. Console Log Verification

In browser console, look for:
```
[Mother] Summary loaded successfully
```

If you see:
```
[Mother] Failed to fetch summary, falling back to legacy: ...
```
This indicates Mother endpoint issue (investigate).

---

## Rollback Plan

If Mother endpoints fail in production:

1. **Automatic Fallback**: Snapshot already falls back to legacy on error
2. **Manual Disable**: Set environment variable `DISABLE_MOTHER_UI=true`
3. **Quick Fix**: Revert ChartGateway import in Snapshot.jsx

---

## Next Steps for Full Cutover

1. [ ] Add ChartGateway to VitalsPanel
2. [ ] Add ChartGateway to MedicationsPanel
3. [ ] Add ChartGateway to ProblemsPanel
4. [ ] Add ChartGateway to OrdersPanel
5. [ ] Add ChartGateway to DocumentsPanel
6. [ ] Remove legacy fallback after 30-day burn-in
7. [ ] Deprecate `/api/patients/:id/snapshot` endpoint

---

**Last Updated**: 2026-01-17T23:05:00Z
**Status**: Phase 1 UI Cutover Complete (Snapshot)
