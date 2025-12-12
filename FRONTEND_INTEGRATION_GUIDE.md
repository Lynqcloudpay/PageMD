# Frontend Integration Guide - E-Prescribing & Code Search

## Overview

This guide explains how to integrate the new enhanced e-prescribing and code search components into your existing application.

## Components Available

### 1. EPrescribeEnhanced Component
**Location:** `client/src/components/EPrescribeEnhanced.jsx`

**Features:**
- RxNorm medication search
- Structured sig builder
- Pharmacy directory search
- Drug interaction checking
- Controlled substance handling
- Electronic transmission

### 2. CodeSearchModal Component
**Location:** `client/src/components/CodeSearchModal.jsx`

**Features:**
- Universal code search (ICD-10 or CPT)
- Real-time search with debouncing
- Multi-select support
- Database-backed search with fallback

## Integration Examples

### Option 1: Replace Existing PrescriptionModal

Update `client/src/components/ActionModals.jsx`:

```javascript
import EPrescribeEnhanced from './EPrescribeEnhanced';

export const PrescriptionModal = ({ isOpen, onClose, onSuccess, patientId, visitId, diagnoses = [] }) => {
  return (
    <EPrescribeEnhanced
      isOpen={isOpen}
      onClose={onClose}
      onSuccess={onSuccess}
      patientId={patientId}
      visitId={visitId}
    />
  );
};
```

### Option 2: Use Enhanced Version Alongside Existing

In `client/src/pages/VisitNote.jsx`, you can add both options:

```javascript
import EPrescribeEnhanced from '../components/EPrescribeEnhanced';
import CodeSearchModal from '../components/CodeSearchModal';

// In component state
const [showEnhancedPrescribe, setShowEnhancedPrescribe] = useState(false);
const [showICD10Modal, setShowICD10Modal] = useState(false);
const [showCPTModal, setShowCPTModal] = useState(false);

// In JSX
<EPrescribeEnhanced
  isOpen={showEnhancedPrescribe}
  onClose={() => setShowEnhancedPrescribe(false)}
  onSuccess={() => {
    // Refresh prescriptions
    setShowEnhancedPrescribe(false);
  }}
  patientId={id}
  visitId={currentVisitId}
/>

<CodeSearchModal
  isOpen={showICD10Modal}
  onClose={() => setShowICD10Modal(false)}
  onSelect={(code) => {
    // Add code to assessment/plan
    handleAddICD10(code);
    setShowICD10Modal(false);
  }}
  codeType="ICD10"
  multiSelect={false}
/>
```

### Option 3: Add to Snapshot Page

In `client/src/pages/Snapshot.jsx`:

```javascript
import EPrescribeEnhanced from '../components/EPrescribeEnhanced';

// Add button in Quick Navigation
<button
  onClick={() => setShowEPrescribe(true)}
  className="px-3 py-1.5 text-xs font-medium bg-primary-600 hover:bg-primary-700 text-white rounded-md"
>
  <Pill className="w-3.5 h-3.5 inline mr-1" />
  e-Prescribe
</button>

// Add modal
<EPrescribeEnhanced
  isOpen={showEPrescribe}
  onClose={() => setShowEPrescribe(false)}
  onSuccess={() => {
    refreshPatientData();
    setShowEPrescribe(false);
  }}
  patientId={id}
/>
```

## Code Search Integration

### ICD-10 Code Search in VisitNote

Replace the inline ICD-10 search with the modal:

```javascript
import CodeSearchModal from '../components/CodeSearchModal';

// Replace existing ICD-10 search input with button
<button
  onClick={() => setShowICD10Modal(true)}
  className="text-xs text-primary-600 hover:text-primary-700"
>
  Search ICD-10 Codes
</button>

<CodeSearchModal
  isOpen={showICD10Modal}
  onClose={() => setShowICD10Modal(false)}
  onSelect={(code) => {
    // Add to assessment section or problem list
    handleAddICD10(code);
  }}
  codeType="ICD10"
  multiSelect={false}
/>
```

### CPT Code Search for Billing

In billing/superbill components:

```javascript
import CodeSearchModal from '../components/CodeSearchModal';

<button onClick={() => setShowCPTModal(true)}>
  Add CPT Code
</button>

<CodeSearchModal
  isOpen={showCPTModal}
  onClose={() => setShowCPTModal(false)}
  onSelect={(code) => {
    // Add to procedure codes
    setProcedureCodes([...procedureCodes, code]);
  }}
  codeType="CPT"
  multiSelect={true}
/>
```

## API Integration

All components use the new API endpoints:

```javascript
// Already added to client/src/services/api.js
import { medicationsAPI, prescriptionsAPI, pharmaciesAPI, codesAPI } from '../services/api';

// Examples:
const meds = await medicationsAPI.search('aspirin');
const prescription = await prescriptionsAPI.create(data);
const pharmacies = await pharmaciesAPI.search({ query: 'CVS' });
const codes = await codesAPI.searchICD10('diabetes');
```

## Prescription History

To show prescription history, create a component:

```javascript
import { prescriptionsAPI } from '../services/api';

const PrescriptionHistory = ({ patientId }) => {
  const [prescriptions, setPrescriptions] = useState([]);
  
  useEffect(() => {
    prescriptionsAPI.getByPatient(patientId)
      .then(response => setPrescriptions(response.data || []));
  }, [patientId]);
  
  return (
    <div>
      {prescriptions.map(prescription => (
        <div key={prescription.id}>
          {prescription.medication_name} - {prescription.sig}
        </div>
      ))}
    </div>
  );
};
```

## Styling Notes

All components use Tailwind CSS and match your existing design system:
- Primary colors: `primary-600`, `primary-700`
- Gray scale: `gray-50` to `gray-900`
- Consistent spacing and border radius

## Next Steps

1. **Test the components** in isolation first
2. **Integrate gradually** - replace one modal at a time
3. **Update PrescriptionLogModal** to show prescriptions from the new API
4. **Add prescription history** to patient chart

## Example: Complete Integration

See `INTEGRATION_EXAMPLE.jsx` for a complete example showing all components working together.






















