# UAT Test Plan - PageMD Billing Module

## Overview
This document outlines the User Acceptance Testing (UAT) scenarios for the billing module. Each scenario should be executed by a tester with appropriate credentials.

---

## Test Environment Setup

### Prerequisites
- Test user accounts: `biller@test.com`, `frontdesk@test.com`, `clinician@test.com`
- Test patient with insurance info populated
- Test payer ID configured in system
- Clearinghouse in sandbox mode

---

## Scenario 1: Eligibility Verification

### 1.1 Successful Eligibility Check
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to patient chart | Patient chart opens |
| 2 | Click "Verify Eligibility" button | Eligibility modal opens |
| 3 | Confirm payer ID and member ID | Pre-populated from patient record |
| 4 | Click "Verify" | Loading indicator shows |
| 5 | View result | Coverage status, copay, deductible displayed |
| 6 | Check audit log | Eligibility check logged with timestamp |

### 1.2 Failed Eligibility Check (Invalid Member ID)
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Enter invalid member ID | Field accepts input |
| 2 | Click "Verify" | Error message: "Member not found" or similar |
| 3 | No PHI in error | Error message does not contain member ID |

---

## Scenario 2: Fee Sheet / Superbill Entry

### 2.1 Create Fee Sheet
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open patient visit | Visit note opens |
| 2 | Navigate to Fee Sheet tab | Fee sheet interface loads |
| 3 | Add diagnosis code (e.g., I10) | Code added with description |
| 4 | Add procedure code (e.g., 99213) | Code added with fee amount |
| 5 | Save fee sheet | Fee sheet saved, confirmation shown |
| 6 | Verify on Billing page | Visit appears with "unbilled" status |

---

## Scenario 3: Claim Generation (837P)

### 3.1 Generate Single Claim
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to Billing → Claims | Claims list displayed |
| 2 | Select unbilled visit | Visit details shown |
| 3 | Click "Generate Claim" | Claim created with claim number |
| 4 | Verify claim data | Diagnosis, procedures, amounts correct |

### 3.2 Batch Claim Submission
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to Billing → Submissions | Submissions list displayed |
| 2 | Select multiple claims | Checkboxes selected |
| 3 | Click "Create Batch" | Batch created, status "pending" |
| 4 | Click "Generate X12" | X12 content generated, downloadable |
| 5 | Click "Submit Batch" | Batch submitted to clearinghouse |
| 6 | Verify status | Status changes to "submitted" |

### 3.3 View X12 Content
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open submission details | Details modal opens |
| 2 | Click "Download X12" | .837 file downloads |
| 3 | Open file in text editor | Valid X12 format with ISA/GS/ST headers |

---

## Scenario 4: Acknowledgement Processing (999/277)

### 4.1 Acceptance Acknowledgement
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Clearinghouse returns 999 accepted | (Simulated in sandbox) |
| 2 | System polls for acknowledgements | Acknowledgement retrieved |
| 3 | Submission status updated | Status shows "accepted" |

### 4.2 Rejection Handling
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Claim rejected due to error | Rejection reason stored |
| 2 | View rejection details | Error code and description displayed |
| 3 | Fix claim data | Claim editing enabled |
| 4 | Resubmit claim | New version created and submitted |

---

## Scenario 5: ERA Upload and Parsing (835)

### 5.1 Upload ERA File
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to Billing → ERA | ERA list displayed |
| 2 | Click "Upload ERA" | File picker opens |
| 3 | Select .835 file | File uploads |
| 4 | View parsed content | Check number, date, total displayed |
| 5 | View claims list | Claims extracted from ERA shown |

### 5.2 Claim Matching
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Review matched claims | Match confidence shown |
| 2 | Identify unmatched claims | "Unmatched" status displayed |
| 3 | Click "Match" on unmatched | Claim search modal opens |
| 4 | Select correct claim | Manual match applied |

### 5.3 Post ERA Payments
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "Post ERA" | Confirmation modal |
| 2 | Confirm posting | Loading indicator |
| 3 | View result | "X claims posted" message |
| 4 | Check claim statuses | Updated to "paid" or "partial_paid" |
| 5 | Check patient balances | Balances reflect payments |

### 5.4 Adjustment Handling
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | View ERA with adjustments | Adjustment codes displayed |
| 2 | Post ERA | Adjustments applied |
| 3 | View AR activity | CO/PR adjustments recorded |
| 4 | View patient responsibility | Patient balance updated |

---

## Scenario 6: Patient Statement Reconciliation

### 6.1 Generate Statement
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to patient billing | Billing tab opens |
| 2 | Click "Generate Statement" | Statement preview shown |
| 3 | Verify charges | All billable items listed |
| 4 | Verify payments | Insurance payments shown |
| 5 | Verify balance due | Correct patient responsibility |

---

## Scenario 7: AR Aging Report

### 7.1 View AR Aging
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to Billing → Reports | Reports page opens |
| 2 | Select "AR Aging" | AR Aging report loads |
| 3 | Verify patient names | Names decrypted and readable |
| 4 | Verify aging buckets | 0-30, 31-60, 61-90, 90+ correct |
| 5 | Export to CSV | CSV downloads with correct data |

---

## Scenario 8: Role-Based Access Control

### 8.1 Biller Access
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login as biller | Dashboard loads |
| 2 | Access Billing page | Full access to all billing functions |
| 3 | Post payment | Payment posts successfully |

### 8.2 Front Desk Limited Access
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login as front desk | Dashboard loads |
| 2 | Access Billing page | View-only access |
| 3 | Try to post payment | Permission denied message |

### 8.3 Clinician Access
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login as clinician | Dashboard loads |
| 2 | Access Fee Sheet | Can add diagnosis/procedure codes |
| 3 | Access claim submission | No access or view-only |

---

## Scenario 9: Audit Trail

### 9.1 Verify Audit Logging
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Perform billing action | Any: eligibility, payment, claim |
| 2 | Query `billing_event_log` | Entry exists with correct details |
| 3 | Verify actor_id | Correct user ID logged |
| 4 | Verify timestamp | Accurate timestamp |
| 5 | Verify no PHI | Event details do not contain SSN, DOB raw |

---

## Scenario 10: Multi-Tenant Isolation

### 10.1 Tenant Data Separation
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login as tenant A user | View only tenant A data |
| 2 | Query billing data | Only tenant A claims returned |
| 3 | Attempt cross-tenant access | Access denied or 404 |

---

## Sign-Off

| Tester | Date | Pass/Fail | Notes |
|--------|------|-----------|-------|
| | | | |
| | | | |

---

*All scenarios must pass before production deployment.*
