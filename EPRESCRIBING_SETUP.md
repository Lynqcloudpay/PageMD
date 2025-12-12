# Electronic Prescription Transmission Setup Guide

## Overview

This guide explains what's needed to enable **actual electronic prescription transmission** to pharmacies. Currently, the system supports prescription creation and management, but **electronic transmission is simulated**. To enable real transmission, you'll need to integrate with an e-prescribing network.

## Current Status

✅ **What's Working:**
- Prescription creation and management
- Medication search (RxNorm)
- Pharmacy search and selection
- Drug interaction checking (basic)
- Allergy checking
- Controlled substance handling
- Prescription storage and tracking
- Transmission status tracking (database)

❌ **What's Missing (for real transmission):**
- Integration with e-prescribing network (Surescripts, etc.)
- NCPDP SCRIPT message generation
- Pharmacy connectivity verification
- Transmission confirmation handling
- Error handling for transmission failures

## Required Components for Electronic Transmission

### 1. E-Prescribing Network Integration

You need to integrate with one of these networks:

#### **Surescripts** (Most Common - 95%+ of pharmacies)
- **Website:** https://surescripts.com
- **Contact:** Business Development team
- **Requirements:**
  - Practice registration
  - Provider credentials (NPI, DEA for controlled substances)
  - Integration certification
  - Monthly fees (varies by practice size)

#### **Alternative Networks:**
- **DrFirst** (Rcopia)
- **Allscripts**
- **Epic MyChart** (if using Epic)
- **Cerner** (if using Cerner)

### 2. Provider Credentials Required

For each prescriber, you need:

1. **NPI (National Provider Identifier)**
   - Get from: https://nppes.cms.hhs.gov
   - Required for all prescriptions

2. **DEA Number** (Drug Enforcement Administration)
   - Required for controlled substances (Schedules II-V)
   - Get from: https://www.deadiversion.usdoj.gov
   - Format: 2 letters + 7 digits (e.g., AB1234567)

3. **State License Number**
   - Required in some states
   - Format varies by state

4. **State Controlled Substance Registration**
   - Required for controlled substances in some states
   - Check your state's requirements

### 3. Pharmacy Requirements

For electronic transmission, pharmacies need:

1. **NCPDP ID** (National Council for Prescription Drug Programs)
   - 7-digit identifier
   - Already stored in your `pharmacies` table

2. **Electronic Connectivity**
   - Pharmacy must be connected to e-prescribing network
   - Check `integration_enabled` flag in pharmacy record

3. **Pharmacy NPI**
   - National Provider Identifier for the pharmacy
   - Used for verification

### 4. Technical Integration

#### **NCPDP SCRIPT Standard**

Electronic prescriptions use the **NCPDP SCRIPT Standard** (currently version 2017071 or newer). This is an XML-based message format that includes:

- Patient information
- Prescriber information
- Medication details (RxNorm codes)
- Sig (instructions)
- Quantity, days supply, refills
- Pharmacy information
- Diagnosis codes (ICD-10)

#### **Message Types:**

1. **NewRx** - New prescription
2. **RxChangeRequest** - Prescription change request
3. **RxRenewalRequest** - Refill request
4. **RxFill** - Fill notification
5. **RxCancel** - Prescription cancellation
6. **Status** - Status updates

#### **Integration Options:**

**Option 1: Direct Surescripts Integration**
- Requires Surescripts certification
- Direct API integration
- Most control, most complex

**Option 2: EMR Integration Partner**
- Use a certified EMR integration partner
- They handle Surescripts connection
- Easier setup, less control

**Option 3: FHIR R4 Prescription API**
- Modern standard (HL7 FHIR)
- Some networks support it
- More standardized approach

### 5. Database Schema Updates Needed

Your current schema already supports most fields. You may want to add:

```sql
-- Add transmission confirmation fields
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS 
  transmission_confirmed_at TIMESTAMP,
  transmission_confirmation_id VARCHAR(100),
  pharmacy_response TEXT,
  transmission_retry_count INTEGER DEFAULT 0;
```

### 6. Implementation Steps

#### Step 1: Choose Integration Method

**Recommended:** Start with Surescripts (most pharmacies support it)

1. Contact Surescripts Business Development
2. Complete registration process
3. Get API credentials and documentation
4. Complete integration certification

#### Step 2: Update Backend Code

You'll need to modify `/server/routes/prescriptions.js`:

```javascript
// Replace the simulated transmission (lines 386-409) with:

async function transmitPrescription(prescription, pharmacy, prescriber) {
  // 1. Build NCPDP SCRIPT message
  const scriptMessage = buildNCPDPScriptMessage(prescription, pharmacy, prescriber);
  
  // 2. Send to Surescripts API
  const response = await surescriptsAPI.sendPrescription(scriptMessage);
  
  // 3. Handle response
  if (response.status === 'accepted') {
    return {
      transmissionStatus: 'sent',
      transmissionId: response.messageId,
      transmissionConfirmedAt: new Date()
    };
  } else {
    throw new Error(response.error || 'Transmission failed');
  }
}

function buildNCPDPScriptMessage(prescription, pharmacy, prescriber) {
  // Build NCPDP SCRIPT XML message
  // This is complex - use a library like 'ncpdp-script' if available
  // Or build XML manually following NCPDP SCRIPT standard
}
```

#### Step 3: Add Surescripts SDK/API Client

Install a Surescripts SDK or build your own client:

```bash
npm install surescripts-api  # If available
# OR build custom client using Surescripts API documentation
```

#### Step 4: Handle Responses

You'll need to handle:
- **Success:** Prescription accepted by pharmacy
- **Rejected:** Pharmacy rejected (wrong info, etc.)
- **Pending:** Pharmacy hasn't responded yet
- **Error:** Network/technical error

#### Step 5: Add Retry Logic

For failed transmissions:
- Retry up to 3 times
- Log all attempts
- Notify prescriber if all retries fail

### 7. Testing

Before going live:

1. **Test Environment:**
   - Use Surescripts test environment
   - Test with test pharmacies
   - Verify all message types

2. **Test Scenarios:**
   - Regular prescription
   - Controlled substance
   - Refill request
   - Prescription change
   - Prescription cancellation

3. **Error Handling:**
   - Network failures
   - Invalid pharmacy ID
   - Missing prescriber credentials
   - Invalid medication codes

### 8. Compliance Requirements

#### **HIPAA:**
- Encrypt all transmissions (TLS 1.2+)
- Audit log all prescription activities
- Secure storage of prescription data

#### **State Requirements:**
- Some states require e-prescribing for all prescriptions
- Check your state's e-prescribing laws
- Some states have specific format requirements

#### **DEA Requirements (Controlled Substances):**
- Two-factor authentication for controlled substances
- DEA number validation
- Schedule verification
- State CS registration verification

### 9. Cost Considerations

**Surescripts Fees:**
- Setup fee: $500-$2,000 (one-time)
- Monthly fee: $50-$200 per prescriber
- Transaction fees: $0.10-$0.50 per prescription (sometimes included)

**Alternative Costs:**
- EMR integration partner: May charge per transaction or monthly fee
- Development time: 2-4 weeks for integration
- Testing and certification: 1-2 weeks

### 10. Recommended Libraries/Tools

**JavaScript/Node.js:**
- No official Surescripts SDK for Node.js (build custom client)
- Use `axios` for HTTP requests
- Use `xml2js` or `fast-xml-parser` for XML handling
- Use `crypto` for encryption

**Example Structure:**
```javascript
// server/services/surescripts.js
const axios = require('axios');
const crypto = require('crypto');

class SurescriptsClient {
  constructor(apiKey, apiSecret, environment = 'test') {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.baseURL = environment === 'production' 
      ? 'https://api.surescripts.com'
      : 'https://api-test.surescripts.com';
  }

  async sendPrescription(scriptMessage) {
    // Build request with authentication
    // Send to Surescripts API
    // Return response
  }
}
```

### 11. Current Implementation Notes

**What to Update:**

1. **`/server/routes/prescriptions.js`** (line 386-409):
   - Replace simulation with actual API call
   - Add proper error handling
   - Add retry logic

2. **Add new service file:**
   - `/server/services/surescripts.js` - Surescripts API client
   - `/server/services/ncpdp-script.js` - NCPDP message builder

3. **Environment variables:**
   ```env
   SURESCRIPTS_API_KEY=your_api_key
   SURESCRIPTS_API_SECRET=your_api_secret
   SURESCRIPTS_ENVIRONMENT=test  # or 'production'
   ```

### 12. Next Steps

1. **Immediate (Can do now):**
   - ✅ Use the redesigned e-prescription interface
   - ✅ Save prescriptions as drafts
   - ✅ Print prescriptions for manual transmission
   - ✅ Track prescription status

2. **Short-term (1-2 weeks):**
   - Contact Surescripts for registration
   - Set up test environment
   - Begin integration development

3. **Medium-term (1-2 months):**
   - Complete Surescripts integration
   - Test thoroughly
   - Get certification
   - Go live with test pharmacies

4. **Long-term:**
   - Expand to all pharmacies
   - Add advanced features (prior auth, formulary checking)
   - Integrate with pharmacy benefit managers (PBMs)

## Support Resources

- **Surescripts:** https://surescripts.com/support
- **NCPDP:** https://www.ncpdp.org
- **DEA:** https://www.deadiversion.usdoj.gov
- **NPI Registry:** https://nppes.cms.hhs.gov

## Summary

Your e-prescription system is **fully functional for prescription management**. To enable **actual electronic transmission**, you need to:

1. ✅ Register with Surescripts (or alternative network)
2. ✅ Get provider credentials (NPI, DEA)
3. ✅ Integrate Surescripts API
4. ✅ Build NCPDP SCRIPT messages
5. ✅ Handle transmission responses
6. ✅ Test thoroughly
7. ✅ Go live

The current system provides an excellent foundation - you just need to replace the simulation code with actual API calls once you have Surescripts credentials.

---

**Questions?** Contact your Surescripts representative or review their developer documentation.












