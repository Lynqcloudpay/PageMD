# E-Prescribing & ICD-10/CPT Integration - Quick Start Guide

## Overview

This guide walks you through implementing and using the e-prescribing and enhanced code search features in your Paper EMR system.

## Prerequisites

- Node.js 18+ installed
- PostgreSQL database running
- Existing Paper EMR installation

## Installation Steps

### 1. Install Required Dependencies

```bash
cd server
npm install axios
```

### 2. Run Database Migration

Create the e-prescribing and enhanced code tables:

```bash
cd server
node scripts/migrate-eprescribing.js
```

This creates:
- `prescriptions` table
- `pharmacies` table  
- `medication_database` table
- `icd10_codes` table
- `cpt_codes` table
- Supporting tables (interactions, etc.)

### 3. Register API Routes

Add the prescription routes to your server. In `server/index.js`, add:

```javascript
const prescriptionRoutes = require('./routes/prescriptions');
const pharmacyRoutes = require('./routes/pharmacies');
app.use('/api/prescriptions', prescriptionRoutes);
app.use('/api/pharmacies', pharmacyRoutes);
```

Also ensure the codes routes are enhanced (already done in `server/routes/codes.js`).

### 4. Create Pharmacy Routes File

Create `server/routes/pharmacies.js`:

```javascript
const express = require('express');
const pharmacyService = require('../services/pharmacy');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/search', requireRole('clinician'), async (req, res) => {
  try {
    const results = await pharmacyService.searchPharmacies(req.query);
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
```

## Usage Examples

### Medication Search

**API Endpoint:** `GET /api/medications/search?q=lisinopril`

```javascript
// Frontend example
const response = await fetch('/api/medications/search?q=lisinopril', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
const medications = await response.json();
```

### Create Prescription

**API Endpoint:** `POST /api/prescriptions/create`

```javascript
const prescription = {
  patientId: 'uuid-here',
  visitId: 'uuid-here',
  medicationRxcui: '314076',
  medicationName: 'Lisinopril 10 MG Oral Tablet',
  strength: '10 MG',
  quantity: 30,
  sigStructured: {
    dose: '10 MG',
    route: 'ORAL',
    frequency: 'Once daily',
    duration: '30 days'
  },
  refills: 3,
  substitutionAllowed: true,
  pharmacyId: 'uuid-here'
};

await fetch('/api/prescriptions/create', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify(prescription)
});
```

### Search ICD-10 Codes

**API Endpoint:** `GET /api/codes/icd10?search=diabetes`

The enhanced route will:
1. First try the database (if populated)
2. Fall back to hardcoded common codes

### Search CPT Codes

**API Endpoint:** `GET /api/codes/cpt?search=99213`

Same behavior as ICD-10 - uses database if available, otherwise hardcoded.

## Populating Code Databases

### ICD-10 Codes

ICD-10 codes can be imported from CMS public datasets:

```bash
# Download ICD-10 CSV from CMS
# Then run import script (create this script)
node server/scripts/import-icd10.js /path/to/icd10-codes.csv
```

### CPT Codes

CPT codes require a license from AMA. For development/testing:

1. Purchase CPT code set from AMA
2. Create import script similar to ICD-10
3. Import into `cpt_codes` table

**Note:** For production, you must have a valid CPT license from AMA.

## External API Integration

### RxNorm API

RxNorm API is free and open. No API key required for basic use.

- Base URL: `https://rxnav.nlm.nih.gov/REST`
- Rate limits apply
- Consider caching results in `medication_database` table

### NPI Registry

NPI Registry is free and public:

- Base URL: `https://npiregistry.cms.hhs.gov/api`
- No authentication required
- Rate limits apply

### Surescripts Integration (Production)

For production e-prescribing, you'll need:

1. **Surescripts Certification** - Complete certification process
2. **NCPDP Provider ID** - Obtain from NCPDP
3. **DEA Registration** - Required for controlled substances
4. **State Licensing** - Comply with state e-prescribing regulations

The current implementation provides a foundation but needs:
- Surescripts API integration
- SCRIPT standard message formatting
- Two-way communication with pharmacies

## Frontend Integration

See the comprehensive frontend components in:
- `client/src/components/EPrescribeEnhanced.jsx` (to be created)
- `client/src/components/CodeSearchModal.jsx` (to be created)

These will integrate with the API endpoints.

## Testing

### Test Prescription Creation

```bash
curl -X POST http://localhost:3000/api/prescriptions/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "patientId": "uuid",
    "medicationName": "Lisinopril 10 MG",
    "quantity": 30,
    "sigStructured": {
      "dose": "10 MG",
      "route": "ORAL",
      "frequency": "Once daily"
    }
  }'
```

### Test Medication Search

```bash
curl "http://localhost:3000/api/medications/search?q=aspirin" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Security & Compliance Notes

1. **HIPAA Compliance**
   - All prescription actions are logged in `audit_logs`
   - Prescription data encrypted at rest
   - Secure transmission required (TLS 1.2+)

2. **DEA Requirements**
   - Controlled substances require valid DEA number
   - Schedule II prescriptions cannot have refills
   - All controlled substance prescriptions logged

3. **State Regulations**
   - Check state-specific e-prescribing requirements
   - Some states require e-prescribing for all prescriptions
   - Maintain prescription records per state retention requirements

## Next Steps

1. **Complete Frontend Components** - Build React components for prescription workflow
2. **Import Code Sets** - Populate ICD-10 and CPT databases
3. **Pharmacy Directory** - Import pharmacy directory or integrate with NCPDP
4. **Surescripts Integration** - Begin certification process for production
5. **Testing** - Comprehensive testing of prescription workflow

## Support & Documentation

- RxNorm API: https://www.nlm.nih.gov/research/umls/rxnorm/docs/
- NPI Registry: https://npiregistry.cms.hhs.gov/
- NCPDP: https://www.ncpdp.org/
- Surescripts: https://surescripts.com/

## File Structure

```
server/
  services/
    rxnorm.js          # RxNorm API integration
    pharmacy.js        # Pharmacy search service
    validation.js      # NPI/DEA validation
  routes/
    prescriptions.js   # Prescription API routes
    pharmacies.js      # Pharmacy API routes
    codes.js           # Enhanced ICD-10/CPT routes
  scripts/
    migrate-eprescribing.js  # Database migration
```

## Troubleshooting

### Database Connection Errors

Ensure PostgreSQL is running and credentials are correct in `.env`:
```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=paper_emr
DB_USER=postgres
DB_PASSWORD=your_password
```

### RxNorm API Errors

- Check internet connectivity
- Verify RxNorm API is accessible
- Check rate limiting (implement caching if needed)

### Prescription Creation Fails

- Verify all required fields are provided
- Check NPI/DEA validation
- Ensure patient and prescriber exist in database
- Review server logs for detailed error messages

---

**Status:** Foundation implementation complete. Frontend components and production integrations pending.






















