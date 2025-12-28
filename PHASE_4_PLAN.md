# Phase 4: Multi-Tenant Scalability & Release Hardening

## 1. Automated Compliance & Governance Checks
- [ ] **Data Residency Verification**: Implement a background task that verifies `clinics.compliance_zones` (e.g., "GDPR", "HIPAA") matches the clinic's `region` (e.g., "EU-West", "US-East").
    - **Goal**: Auto-flag configuration errors where a UK clinic is hosted in US region.
- [ ] **Encryption Enforcement**: Programmatically verify that `ENABLE_PHI_ENCRYPTION` is true and `BACKUP_ENCRYPTION_KEY` is set in production.
    - **Goal**: Prevent silent misconfiguration of security criticals.

## 2. Security Hardening (HIPAA Audit "Medium" Findings)
- [ ] **Backup Hardening**: refactor `backup-database.js` to strictly strict-fail if `BACKUP_ENCRYPTION_KEY` is missing in production (currently falls back to weak key).
- [ ] **Rate Limiting Tuning**: Update `security.js` middleware to enforce stricter rate limits in production (currently 100/15min) and sensible limits in dev (e.g., 1000/15min instead of 10000).

## 3. Dedicated Impersonation Subdomain (Architecture)
- [ ] **Subdomain Isolation**: (Evaluation/Design) Plan moving "Break Glass" features to `admin.bemypcp.com` to prevent cookie leakage between Tenant and Platform Admin sessions.
- [ ] **Cookie Security**: Ensure `x-platform-token` is never accessible to client-side scripts (HttpOnly) and scoped strictly.

## 4. Multi-Tenant Schema Validation
- [ ] **Schema Drift Check**: A script to verify that ALL `tenant_*` schemas have identical structures for core tables (`patients`, `visits`) to prevent migration skew.
