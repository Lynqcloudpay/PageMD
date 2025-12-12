# OpenEMR Integration & Compliance Guide

This document outlines the OpenEMR-inspired features and best practices implemented in the PageMD system.

## Implemented Features

### 1. FHIR R4 API Support
- **Endpoint**: `/fhir/*`
- **Resources**: Patient, Observation, DiagnosticReport
- **Standards**: FHIR R4 compliant
- **Usage**: Enables interoperability with other healthcare systems

### 2. Enhanced Security
- **Rate Limiting**: API and authentication rate limits
- **Input Sanitization**: All user inputs are sanitized
- **Password Policy**: Strong password requirements (8+ chars, uppercase, lowercase, number, special char)
- **Helmet.js**: Security headers for XSS, clickjacking, etc.
- **Session Management**: Session tracking and timeout

### 3. Clinical Decision Support
- **Drug Interaction Checking**: Checks for known drug interactions
- **Allergy Checking**: Validates medications against patient allergies
- **Duplicate Medication Detection**: Prevents duplicate prescriptions
- **Location**: `server/middleware/clinical.js`

### 4. Code Management
- **ICD-10 Lookup**: `/api/codes/icd10`
- **CPT Lookup**: `/api/codes/cpt`
- Supports search functionality

### 5. Enhanced Audit Logging
- **Comprehensive Tracking**: User actions, IP addresses, user agents
- **HIPAA Compliance**: All PHI access is logged
- **Queryable**: Indexed for fast retrieval

### 6. Session Management
- **Session Table**: Tracks active sessions
- **Auto-expiry**: Sessions expire after inactivity
- **Security**: Token hashing and IP tracking

## Security Best Practices

### Password Requirements
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

### Rate Limiting
- **API**: 100 requests per 15 minutes per IP
- **Authentication**: 5 login attempts per 15 minutes per IP

### Input Validation
- All inputs are sanitized using validator.js
- SQL injection prevention via parameterized queries
- XSS prevention via input escaping

## FHIR API Usage

### Get Patient
```bash
GET /fhir/Patient/{id}
Authorization: Bearer {token}
```

### Search Observations (Labs)
```bash
GET /fhir/Observation?patient={patientId}&code={loincCode}
Authorization: Bearer {token}
```

### Search Diagnostic Reports
```bash
GET /fhir/DiagnosticReport?patient={patientId}
Authorization: Bearer {token}
```

## Clinical Decision Support

When adding medications, the system automatically checks:
1. **Allergies**: Matches medication against patient allergies
2. **Drug Interactions**: Checks for known interactions with current medications
3. **Duplicates**: Prevents duplicate prescriptions

Warnings are returned to the clinician for review before finalizing.

## Next Steps for Full OpenEMR Compliance

1. **OAuth2/OpenID Connect**: Implement full OAuth2 flow
2. **HL7 Integration**: Add HL7 message processing
3. **SMART on FHIR**: Implement SMART app launch
4. **Advanced CDS**: Integrate with drug interaction databases
5. **Billing Integration**: Add ICD-10/CPT code billing
6. **Reporting**: Add clinical and administrative reports
7. **Backup/Recovery**: Automated backup system
8. **Encryption**: AES-256 encryption at rest for all PHI

## HIPAA Compliance Checklist

- ✅ Audit logging of all PHI access
- ✅ Role-based access control
- ✅ Password policies
- ✅ Session management
- ✅ Input sanitization
- ✅ Rate limiting
- ✅ Security headers
- ⏳ Encryption at rest (configure in production)
- ⏳ Business Associate Agreements (BAA) with vendors
- ⏳ Regular security audits
- ⏳ Data retention policies

## Installation

1. Install new dependencies:
```bash
cd server && npm install
```

2. Run migrations:
```bash
npm run migrate
```

3. Configure environment variables:
```bash
# Add to server/.env
FRONTEND_URL=http://localhost:5173
SESSION_TIMEOUT=1800000  # 30 minutes in milliseconds
```

## Testing

Test FHIR endpoints:
```bash
# Get patient
curl -H "Authorization: Bearer {token}" http://localhost:3000/fhir/Patient/{id}

# Search labs
curl -H "Authorization: Bearer {token}" http://localhost:3000/fhir/Observation?patient={id}
```

Test clinical decision support:
```bash
# Add medication (will check for allergies/interactions)
POST /api/patients/{id}/medications
{
  "medicationName": "Penicillin",
  "dosage": "500mg",
  "frequency": "BID"
}
```








