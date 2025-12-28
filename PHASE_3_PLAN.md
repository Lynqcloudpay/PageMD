# Phase 3: Governance & Security Enhancements

## 1. Role Governance Hardening
- [x] **Source Template Linkage**: Add `source_template_id` column to the clinic-level `roles` table.
    - **Goal**: Maintain a hard link to the global `platform_role_templates` even if the clinic Admin renames the role (e.g., "Physician" -> "Doctor").
    - **Benefit**: Allows drift detection to work reliably on renamed roles.

## 2. Advanced Compliance
- [ ] **Automated Compliance Checks**: Run periodical tasks to verify `compliance_zones` settings against actual data storage regions.
- [x] **Audit Trail Hashing**: Implement cryptographic hashing (chaining) for `platform_audit_logs` to ensure immutability and tamper-evidence.

## 3. Multi-Tenant Scalability
- [ ] **Schema-per-Tenant Migration**: Evaluate full schema separation if row-level security (RLS) becomes a bottleneck.
- [ ] **Dedicated Impersonation Subdomain**: Move "Break Glass" features to a dedicated `admin.bemypcp.com` subdomain to isolate auth cookies and local storage completely.
