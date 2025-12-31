# Go-Live Checklist for PageMD Billing

## Pre-Requisites (Before Going Live)

### 1. Clearinghouse Setup
- [ ] **Create clearinghouse account** (Availity, Change Healthcare, Waystar, or Office Ally)
- [ ] **Obtain credentials**: Client ID, Client Secret, API keys
- [ ] **Configure sandbox mode** for testing
- [ ] **Store credentials securely** in `clearinghouse_config` table (encrypted)
- [ ] **Verify connectivity** with test eligibility check

### 2. Clinic Configuration
- [ ] **NPI Number**: Set `CLINIC_NPI` in environment
- [ ] **Tax ID (EIN)**: Set `CLINIC_TAX_ID` in environment
- [ ] **Billing Provider Name**: Set `CLINIC_NAME` in environment
- [ ] **Billing Address**: Configure in settings
- [ ] **Payer IDs**: Populate payer ID mappings for major insurers

### 3. Database Setup
- [ ] Run `node server/scripts/init-clearinghouse-db.js`
- [ ] Run `node server/scripts/init-claim-submission-tables.js`
- [ ] Verify all billing tables exist: `claims`, `billing`, `ar_session`, `ar_activity`
- [ ] Verify ERA tables exist: `era_files`, `era_claims`, `era_lines`
- [ ] Verify submission tables exist: `claim_submissions`, `claim_submission_items`

### 4. User Roles & Permissions
- [ ] **Biller role** created with `billing:view`, `billing:edit` permissions
- [ ] **Front Desk role** created with `billing:view` permission
- [ ] **Clinician role** has appropriate access (view only by default)
- [ ] Verify least-privilege principle is enforced

### 5. Security & Compliance
- [ ] **PHI encryption** enabled for production (`ENABLE_PHI_ENCRYPTION=true`)
- [ ] **Audit logging** active for all billing actions
- [ ] **No PHI in error messages** verified
- [ ] **HTTPS enforced** via Caddy/reverse proxy
- [ ] **Session timeout** configured (15-30 min recommended)

---

## Testing Phase

### 6. Eligibility Testing (270/271)
- [ ] Test eligibility check with sandbox patient
- [ ] Verify coverage response displays correctly in UI
- [ ] Verify audit log entry created
- [ ] Test error handling for invalid member ID

### 7. Claim Submission Testing (837P)
- [ ] Create test claim with diagnosis and procedure codes
- [ ] Generate X12 837P and verify format
- [ ] Submit batch to clearinghouse sandbox
- [ ] Verify acknowledgement handling (999/277)
- [ ] Test resubmission workflow

### 8. ERA Posting Testing (835)
- [ ] Upload sample 835 ERA file
- [ ] Verify parsing and claim matching
- [ ] Test manual match for unmatched claims
- [ ] Post ERA and verify AR balances updated
- [ ] Verify adjustment reason codes stored correctly
- [ ] Test void/reversal (if applicable)

### 9. End-to-End Workflow
- [ ] Check eligibility → Create encounter → Bill codes → Generate claim → Submit → Receive ERA → Post payments
- [ ] Verify patient statement reflects correct balance
- [ ] Verify AR aging report accurate

---

## Production Cutover

### 10. Final Configuration
- [ ] Switch clearinghouse to production mode
- [ ] Update credentials for production
- [ ] Disable sandbox/mock responses
- [ ] Configure error monitoring (Sentry or equivalent)

### 11. Backup & Disaster Recovery
- [ ] **Daily automated backups** configured and tested
- [ ] **Backup restoration drill** completed (document results)
- [ ] **Point-in-time recovery** tested
- [ ] Backup retention policy defined (minimum 7 days, recommend 30)

### 12. Monitoring & Alerting
- [ ] Uptime monitoring configured (e.g., UptimeRobot, Pingdom)
- [ ] Error tracking enabled (Sentry, LogRocket, etc.)
- [ ] Database health monitoring active
- [ ] Alert channels configured (email, Slack, etc.)

---

## Post Go-Live

### 13. Training
- [ ] Biller training completed on claim submission workflow
- [ ] Front desk training on eligibility verification
- [ ] Documentation provided to users

### 14. Support
- [ ] Support escalation path defined
- [ ] Known issue documentation created
- [ ] Feedback collection mechanism in place

---

## Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Practice Manager | | | |
| Billing Lead | | | |
| IT/Technical Lead | | | |

---

*This checklist should be completed in order. Do not proceed to production without all items checked.*
