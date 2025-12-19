# DoseSpot ePrescribing Integration Setup Guide

## Overview

This EMR now includes a production-grade ePrescribing module using DoseSpot as the eRx vendor. The integration supports:
- Medication search
- Pharmacy search/selection
- Prescription drafting
- Electronic sending
- Renewals/cancellations (where supported)
- Status tracking
- Full audit logging
- HIPAA-grade security
- Permission-based access control

## Prerequisites

1. **DoseSpot Account**: You must have an active DoseSpot account with API access
2. **BAA (Business Associate Agreement)**: Execute a BAA with DoseSpot
3. **Provider Credentials**: Ensure all prescribers have:
   - Valid NPI (National Provider Identifier)
   - DEA number (for controlled substances)
   - State license numbers

## Configuration

### Environment Variables

Add the following to your `.env` or production environment:

```bash
# E-Prescribing Provider
EPRESCRIBE_PROVIDER=dosespot

# DoseSpot API Configuration
DOSESPOT_BASE_URL=https://api.dosespot.com  # Or your DoseSpot API endpoint
DOSESPOT_CLIENT_ID=your_client_id
DOSESPOT_CLIENT_SECRET=your_client_secret
DOSESPOT_CLINIC_ID=your_clinic_id
DOSESPOT_WEBHOOK_SECRET=your_webhook_secret  # Optional, for webhook verification

# EPCS (Electronic Prescribing of Controlled Substances) - Optional
EPRESCRIBE_EPCS_ENABLED=false  # Set to true when EPCS is configured
```

### Callback URLs

Configure the following callback URLs in your DoseSpot account:
- `https://yourdomain.com/api/eprescribe/webhook` (for webhooks)
- `https://yourdomain.com/patient/:id` (return URL after prescribing)

## Database Migration

Run the migration script to create necessary tables:

```bash
cd server
node scripts/migrate-dosespot-integration.js
```

This creates:
- `eprescribe_id_map` table (vendor entity mapping)
- Extends `prescriptions` table with vendor fields
- Ensures `audit_logs` table structure

## Permissions

The following permissions are required:
- `prescriptions:view` - View prescriptions
- `prescriptions:create` - Create and send prescriptions

Only users with `prescriptions:create` permission (typically clinicians and admins) can send prescriptions.

## Usage

### For Clinicians

1. **Open Patient Chart**: Navigate to a patient's chart
2. **Go to Prescriptions Tab**: Click on the "Prescriptions" tab
3. **Click "New Prescription"**: This opens the embedded DoseSpot prescribing interface
4. **Complete Prescription**: Use the DoseSpot UI to:
   - Search for medications
   - Select pharmacy
   - Enter prescription details
   - Send prescription
5. **View Status**: Check the "Rx Activity" panel for prescription status updates

### API Endpoints

#### Check Status
```
GET /api/eprescribe/status
```

#### Create SSO Session
```
POST /api/eprescribe/session
Body: { patientId, returnUrl? }
```

#### Get Patient Prescriptions
```
GET /api/eprescribe/patient/:id/prescriptions
```

#### Create Prescription Draft
```
POST /api/eprescribe/patient/:id/prescriptions
Body: {
  medicationDisplay,
  sig,
  quantity,
  daysSupply,
  refills,
  pharmacyVendorId?
}
```

#### Send Prescription
```
POST /api/eprescribe/prescriptions/:id/send
```

#### Cancel Prescription
```
POST /api/eprescribe/prescriptions/:id/cancel
Body: { reason? }
```

#### Search Pharmacies
```
GET /api/eprescribe/pharmacies/search?query=...&latitude=...&longitude=...&radius=...
```

#### Search Medications
```
GET /api/eprescribe/medications/search?query=...
```

## EPCS (Electronic Prescribing of Controlled Substances)

EPCS requires additional setup and certification. When ready:

1. Set `EPRESCRIBE_EPCS_ENABLED=true`
2. Ensure all prescribers have completed EPCS enrollment in DoseSpot
3. The system will enforce stronger authentication (MFA) for controlled substances

## Webhooks

DoseSpot can send webhooks for prescription status updates. Configure the webhook URL in your DoseSpot account:

```
https://yourdomain.com/api/eprescribe/webhook
```

The webhook handler automatically updates prescription statuses in the database.

## Audit Logging

All ePrescribing actions are logged to the `audit_logs` table:
- Session creation
- Prescription draft creation
- Prescription sending
- Prescription cancellation
- Status changes

## Troubleshooting

### "E-prescribing service is not enabled"
- Check that `EPRESCRIBE_PROVIDER=dosespot` is set
- Verify all DoseSpot environment variables are configured

### "Authentication failed"
- Verify `DOSESPOT_CLIENT_ID` and `DOSESPOT_CLIENT_SECRET` are correct
- Check that your DoseSpot account is active

### "Patient not found in DoseSpot"
- The system automatically creates patients in DoseSpot when needed
- Ensure patient data (name, DOB, address) is complete

### "Prescriber not found in DoseSpot"
- The system automatically creates prescribers in DoseSpot when needed
- Ensure prescriber has valid NPI and DEA (if prescribing controlled substances)

## Security Notes

- All API requests are rate-limited (50 requests per 15 minutes)
- PHI is never logged in application logs
- Webhook signatures are verified (if `DOSESPOT_WEBHOOK_SECRET` is set)
- All actions require proper permissions
- Audit trail is maintained for HIPAA compliance

## Support

For DoseSpot-specific issues, contact DoseSpot support.
For integration issues, check server logs and audit_logs table.

