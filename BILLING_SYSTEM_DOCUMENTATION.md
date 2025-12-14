# Commercial-Grade Billing System Documentation

## Overview
This billing system has been built to match commercial EMR billing software standards (Epic, Cerner, NextGen). It includes comprehensive claim management, insurance verification, payment processing, and workflow tracking.

## Database Schema

### Core Tables

#### 1. Claims Table
Complete commercial-grade claims table with:
- **Identification**: claim_number (unique), visit_id, patient_id
- **Provider Information**: rendering_provider_id, billing_provider_id, facility_id
- **Insurance Information**: insurance_type, provider, payer_id, member_id, group_number, plan_name
- **Service Information**: service_date_start, service_date_end, place_of_service_code, claim_type
- **Diagnosis Codes**: diagnosis_codes (JSONB array, up to 12), principal_diagnosis_code
- **Procedure Codes**: procedure_codes (JSONB array)
- **Financial Information**: total_charges, amount_paid, patient_responsibility, insurance_allowed, write_off_amount, adjustments
- **Status Tracking**: status (draft, ready_to_submit, queued, submitted, accepted, rejected, pending, paid, partial_paid, denied, appealed, closed, cancelled, voided)
- **Submission Details**: submission_method, submitted_at, payer_claim_control_number
- **Response Tracking**: payer_response_received_at, payer_response_code, payer_response_message
- **Payment Information**: payment_received_at, payment_method, check_number, check_date
- **Denial Information**: denial_code, denial_reason, denial_category
- **Audit Trail**: created_by, created_at, updated_at, updated_by
- **Additional**: notes, attachments, custom_fields

#### 2. Claim Line Items
Detailed procedure-level billing:
- Links to claim
- Service date, place of service
- Procedure code with modifiers
- Diagnosis pointers (which diagnosis codes link to this procedure)
- Units, unit charge, line total
- Allowed amount, paid amount, adjustments, patient responsibility
- Line-level denial tracking

#### 3. Secondary Claims
Coordination of benefits for secondary/tertiary insurance:
- Links to primary claim
- Secondary insurance information
- Amounts from primary (paid, denied)
- Secondary charges and payments
- Status tracking

#### 4. Insurance Eligibility Verifications
Real-time eligibility checking:
- Patient and insurance information
- Eligibility status (active, inactive, terminated)
- Coverage dates
- Plan details (copay, deductible, OOP max)
- Benefits and limitations
- Verification timestamp and method
- Expiration tracking

#### 5. Prior Authorizations
Authorization management:
- Authorization number
- Procedure and diagnosis codes
- Requested vs approved units
- Status tracking (pending, approved, denied, expired)
- Request and response dates
- Approval details

#### 6. Payment Postings
Payment processing:
- Payment date, amount, method
- Payment type (insurance, patient, adjustment, refund)
- Check/reference information
- Allocation to claims
- EOB linking

#### 7. Payment Allocations
Line-item payment allocation:
- Links payment to specific line items
- Allocated amounts
- Adjustments
- Patient responsibility

#### 8. Claim Denials
Denial management:
- Denial codes and reasons
- Category tracking
- Appeal status and workflow
- Resolution tracking

#### 9. Claim Workflow History
Complete audit trail:
- All status changes
- Who performed actions
- Timestamps
- Notes and metadata

#### 10. Claim Attachments
Document management:
- EOBs, remittance advice
- Medical records
- Authorizations
- Appeal letters
- Supporting documentation

## API Endpoints

### Claim Management

#### POST /api/billing/claims
Create a new claim with comprehensive validation and automatic line item creation.

**Request Body:**
```json
{
  "visitId": "uuid",
  "diagnosisCodes": [
    {
      "code": "E11.9",
      "description": "Type 2 diabetes"
    }
  ],
  "procedureCodes": [
    {
      "code": "99213",
      "description": "Office visit",
      "amount": 80.67,
      "units": 1
    }
  ],
  "insuranceProvider": "Blue Cross",
  "insurancePayerId": "12345",
  "insuranceMemberId": "MEM123",
  "placeOfServiceCode": "11",
  "serviceDateStart": "2024-01-15",
  "renderingProviderId": "uuid",
  "notes": "Notes here"
}
```

**Response:**
Returns complete claim with line items and workflow history.

### Status Updates

#### PUT /api/billing/claims/:id/status
Update claim status with automatic workflow history tracking.

**Request Body:**
```json
{
  "status": "submitted",
  "notes": "Ready for submission"
}
```

#### POST /api/billing/claims/:id/submit
Submit claim for processing with validation.

**Request Body:**
```json
{
  "submissionMethod": "electronic"
}
```

### Retrieval

#### GET /api/billing/claims/:id
Get complete claim with:
- All line items
- Payment history
- Denials
- Workflow history
- Attachments

#### GET /api/billing/claims
Get all claims with filtering options.

#### GET /api/billing/claims/patient/:patientId
Get all claims for a specific patient.

## Features Implemented

### 1. Claim Creation
- ✅ Automatic claim number generation
- ✅ Comprehensive data validation
- ✅ Line item creation
- ✅ Workflow history tracking
- ✅ Support for both enhanced and basic schemas
- ✅ Normalized data format handling

### 2. Status Management
- ✅ Complete status workflow (draft → submitted → paid/denied)
- ✅ Automatic workflow history
- ✅ Status change tracking
- ✅ Audit logging

### 3. Financial Tracking
- ✅ Total charges calculation
- ✅ Line-item level tracking
- ✅ Payment allocation
- ✅ Adjustments and write-offs
- ✅ Patient responsibility tracking

### 4. Data Validation
- ✅ Diagnosis code validation (at least one required)
- ✅ Procedure code validation (at least one required)
- ✅ Visit validation
- ✅ Insurance information validation

## Features To Be Implemented

### 1. Insurance Verification
- [ ] Real-time eligibility checking API integration
- [ ] Eligibility caching with expiration
- [ ] Coverage verification
- [ ] Benefits inquiry

### 2. Claim Submission
- [ ] Electronic submission (837P format)
- [ ] Submission queue management
- [ ] Batch submission
- [ ] Acknowledgment tracking
- [ ] Resubmission workflow

### 3. Payment Processing
- [ ] EOB import and parsing
- [ ] Automatic payment posting
- [ ] Payment allocation rules
- [ ] Refund processing
- [ ] Payment adjustment workflow

### 4. Denial Management
- [ ] Denial code library
- [ ] Automatic denial categorization
- [ ] Appeal letter generation
- [ ] Appeal tracking
- [ ] Resolution workflow

### 5. Secondary Insurance
- [ ] Automatic secondary claim generation
- [ ] Coordination of benefits calculation
- [ ] Secondary submission workflow
- [ ] Payment tracking

### 6. Prior Authorizations
- [ ] Authorization request workflow
- [ ] Authorization tracking
- [ ] Expiration alerts
- [ ] Integration with claim creation

### 7. Reporting
- [ ] Claims aging report
- [ ] Payment posting report
- [ ] Denial analysis report
- [ ] Provider productivity
- [ ] Revenue analysis
- [ ] Collection efficiency

### 8. Workflow Automation
- [ ] Auto-submission rules
- [ ] Auto-posting rules
- [ ] Auto-denial handling
- [ ] Reminder notifications

## Commercial Standards Compliance

### HIPAA Compliance
- ✅ Audit logging for all actions
- ✅ User authentication required
- ✅ Role-based access control
- ✅ Secure data transmission

### ANSI X12 Standards
- Schema supports standard claim formats
- Ready for 837P (Professional Claims) integration
- Supports standard denial codes (CO, OA, PI, etc.)

### Commercial EMR Features
- ✅ Complete workflow tracking
- ✅ Line-item level detail
- ✅ Multiple insurance levels
- ✅ Comprehensive audit trail
- ✅ Status management
- ✅ Financial tracking

## Error Handling

The system includes comprehensive error handling:
- Transaction rollback on errors
- Detailed error messages
- Validation at multiple levels
- Database constraint enforcement
- Foreign key relationships

## Testing Recommendations

1. **Claim Creation**: Test with various data formats
2. **Status Transitions**: Test all status changes
3. **Line Items**: Test multiple procedures
4. **Financial Calculations**: Verify totals and allocations
5. **Error Cases**: Test validation failures
6. **Concurrent Access**: Test transaction isolation

## Future Enhancements

1. Real-time insurance verification integration
2. Electronic claim submission (EDI)
3. EOB parsing automation
4. AI-powered denial prevention
5. Predictive analytics for collections
6. Automated appeals workflow
7. Integration with clearinghouses
8. Batch processing capabilities
9. Advanced reporting dashboard
10. Mobile billing app

## Support

For issues or questions about the billing system, refer to:
- Database schema: `/server/scripts/migrate-billing-enhanced.js`
- API routes: `/server/routes/billing.js`
- Frontend components: `/client/src/pages/Billing.jsx`






