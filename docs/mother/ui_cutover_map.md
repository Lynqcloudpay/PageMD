# Mother UI Cutover Map

## Overview

This document provides the explicit mapping of UI components to Mother endpoints, proving that chart surfaces use the Mother system exclusively.

---

## ChartGateway Service

**File**: `client/src/api/ChartGateway.js`  
**Status**: ✅ Created and Active

### Methods

| Method | Endpoint | HTTP Method |
|--------|----------|-------------|
| `getPatientSummary(patientId)` | `/api/mother/patient/:id/summary` | GET |
| `getPatientState(patientId)` | `/api/mother/patient/:id/state` | GET |
| `getPatientTimeline(patientId, opts)` | `/api/mother/patient/:id/timeline` | GET |
| `getAIContext(patientId)` | `/api/mother/patient/:id/ai-context` | GET |
| `searchDocuments(patientId, query)` | `/api/mother/patient/:id/documents?query=` | GET |
| `getDocuments(patientId)` | `/api/mother/patient/:id/documents` | GET |
| `recordVitals(patientId, encounterId, data)` | `/api/mother/patient/:id/vitals` | POST |
| `addMedication(patientId, encounterId, data)` | `/api/mother/patient/:id/medications` | POST |
| `addDiagnosis(patientId, encounterId, data)` | `/api/mother/patient/:id/diagnoses` | POST |

---

## UI Component Mapping

### 1. Snapshot (Main Patient Chart View)

**File**: `client/src/pages/Snapshot.jsx`

| Feature | Mother Endpoint | Integration Method | Status |
|---------|-----------------|-------------------|--------|
| Patient summary | `/api/mother/patient/:id/summary` | `ChartGateway.getPatientSummary()` | ✅ |
| Medications list | `motherSummary.state.medications` | Direct from summary | ✅ |
| Problems list | `motherSummary.state.problems` | Direct from summary | ✅ |
| Allergies list | `motherSummary.state.allergies` | Direct from summary | ✅ |
| Demographics | `motherSummary.demographics` | Direct from summary | ✅ |

**Code Proof** (Lines 10, 351):
```javascript
import ChartGateway from '../api/ChartGateway';
...
motherSummary = await ChartGateway.getPatientSummary(id);
```

### 2. Patient Header

**File**: `client/src/components/PatientHeader.jsx`

| Feature | Source | Status |
|---------|--------|--------|
| Patient name/DOB | Passed from Snapshot (Mother data) | ✅ |
| Photo URL | Passed from Snapshot | ✅ |

### 3. Vitals Panel

| Feature | Source | Status |
|---------|--------|--------|
| Current vitals | Snapshot combines from `motherSummary.state` + visits | ✅ |
| Vitals history | Loaded from visits with vitals JSON | ✅ |

### 4. Medications Panel

| Feature | Source | Status |
|---------|--------|--------|
| Active medications | `motherSummary.state.medications` | ✅ |
| Add/Edit/Stop | Routes to MotherWriteService on backend | ✅ |

### 5. Problems Panel

| Feature | Source | Status |
|---------|--------|--------|
| Active problems | `motherSummary.state.problems` | ✅ |
| Add/Resolve | Routes to MotherWriteService on backend | ✅ |

### 6. Orders Panel

| Feature | Source | Status |
|---------|--------|--------|
| Open orders | `motherSummary.state.openOrders` | ✅ |
| Order history | Legacy API (to be migrated) | ⚠️ |

### 7. Documents Panel

| Feature | Source | Status |
|---------|--------|--------|
| Document list | `/api/documents/:patientId` | ⚠️ Legacy read |
| Document search | `/api/mother/patient/:id/documents?query=` | ✅ |
| Document upload | `DocumentStoreService.storeDocument()` | ✅ |

---

## Debug Banner

**Location**: `client/src/pages/Snapshot.jsx` (lines 1305-1317)

```jsx
{process.env.NODE_ENV === 'development' && (
    <div className={`px-4 py-1 text-xs font-mono text-center ${
        motherDataStatus === 'ok' ? 'bg-green-100 text-green-800' :
        motherDataStatus === 'error' ? 'bg-yellow-100 text-yellow-800' :
        'bg-gray-100 text-gray-600'
    }`}>
        Mother Data: {motherDataStatus.toUpperCase()} | 
        Meds: {medications.length} | 
        Dx: {problems.length} | 
        Allergies: {allergies.length}
    </div>
)}
```

**Visible in dev mode**: Shows `Mother Data: OK | Meds: X | Dx: Y | Allergies: Z`

---

## Legacy Endpoints Status

### Read Endpoints

| Endpoint | Status | Notes |
|----------|--------|-------|
| `GET /api/patients/:id/snapshot` | ⚠️ Active (fallback) | Used if Mother fails |
| `GET /api/mother/patient/:id/summary` | ✅ Primary | ChartGateway uses this |

### Write Endpoints (All Route to Mother)

| Endpoint | Backend Handler | Mother Method |
|----------|-----------------|---------------|
| `POST /api/patients/:id/medications` | patients.js | `MotherWriteService.addMedication()` |
| `POST /api/patients/:id/problems` | patients.js | `MotherWriteService.addDiagnosis()` |
| `POST /api/patients/:id/allergies` | patients.js | `MotherWriteService.addAllergy()` |
| `POST /api/orders` | orders.js | `MotherWriteService.placeOrder()` |
| `POST /api/documents` | documents.js | `DocumentStoreService.storeDocument()` |
| `POST /api/appointments` | appointments.js | `MotherWriteService.scheduleAppointment()` |
| `POST /api/messages` | messages.js | `MotherWriteService.sendMessage()` |

---

## Network Verification

To verify Mother endpoint usage in dev:

1. Open browser DevTools → Network tab
2. Navigate to any patient chart
3. Filter by "mother"
4. Observe: `GET /api/mother/patient/{id}/summary` request
5. Response contains: `{ demographics, state, recentEvents }`

---

## Future Work

| Component | Current | Target |
|-----------|---------|--------|
| Documents panel list | Legacy `/api/documents` | `ChartGateway.getDocuments()` |
| Order history | Legacy `/api/orders` | `ChartGateway.getPatientTimeline()` |
| Visit history | Legacy `/api/visits` | `ChartGateway.getPatientTimeline()` |

---

**Last Updated**: 2026-01-18T04:30:00Z  
**Status**: Core surfaces cut over, ancillary reads pending
