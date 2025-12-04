# HIPAA Access Control Matrix

This document maps roles to permissions as implemented in the EMR system for HIPAA compliance.

**Last Updated:** 2024

## Roles

- **SuperAdmin**: System super administrator with all privileges including system-level operations
- **Admin**: Administrator with full access except system-level operations
- **Physician**: Licensed physician with full clinical privileges
- **Nurse**: Registered nurse or licensed practical nurse with clinical support access
- **MedicalAssistant**: Medical assistant with limited clinical access
- **Billing**: Billing staff with financial and coding access
- **ReadOnly**: Read-only access to patient data without identifiers

## Permission Categories

### Patient Permissions
- `patient:view` - View patient records
- `patient:edit` - Edit patient information
- `patient:create` - Create new patient records
- `patient:delete` - Delete patient records
- `patient:view_identifiers` - View patient identifiers (MRN, SSN)

### Encounter Permissions
- `encounter:view` - View patient encounters
- `encounter:create` - Create new encounters
- `encounter:edit` - Edit encounters
- `encounter:delete` - Delete encounters

### Orders Permissions
- `orders:view` - View orders
- `orders:prescribe` - Prescribe medications
- `orders:create` - Create orders
- `orders:administer` - Administer orders

### Notes Permissions
- `notes:view` - View clinical notes
- `notes:create` - Create clinical notes
- `notes:edit` - Edit clinical notes
- `notes:sign` - Sign and finalize notes
- `notes:delete` - Delete notes

### Billing Permissions
- `billing:read` - Read billing information
- `billing:write` - Write billing information
- `billing:manage_claims` - Manage insurance claims

### Admin Permissions
- `admin:manage_roles` - Manage roles and permissions
- `admin:manage_users` - Manage user accounts
- `admin:view_audit` - View audit logs
- `admin:export_audit` - Export audit logs
- `admin:manage_baa` - Manage Business Associate Agreements
- `admin:system_settings` - Modify system settings

### System Permissions (SuperAdmin only)
- `system:backup_restore` - Perform backup and restore operations
- `system:key_rotation` - Rotate encryption keys
- `system:revert_records` - Revert records to previous versions

## Access Control Matrix

| Permission | SuperAdmin | Admin | Physician | Nurse | MedicalAssistant | Billing | ReadOnly |
|------------|-----------|-------|-----------|-------|------------------|---------|----------|
| **Patient** |
| patient:view | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| patient:edit | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| patient:create | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| patient:delete | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| patient:view_identifiers | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| **Encounter** |
| encounter:view | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| encounter:create | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| encounter:edit | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| encounter:delete | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Orders** |
| orders:view | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| orders:prescribe | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| orders:create | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| orders:administer | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Notes** |
| notes:view | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| notes:create | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| notes:edit | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| notes:sign | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| notes:delete | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Billing** |
| billing:read | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| billing:write | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| billing:manage_claims | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| **Admin** |
| admin:manage_roles | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| admin:manage_users | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| admin:view_audit | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| admin:export_audit | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| admin:manage_baa | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| admin:system_settings | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **System** |
| system:backup_restore | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| system:key_rotation | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| system:revert_records | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

## Notes

1. **Deny-by-Default**: All permissions are denied by default. Only explicitly granted permissions are allowed.

2. **SuperAdmin Bypass**: SuperAdmin role bypasses all permission checks but all actions are still logged in audit logs.

3. **Admin Bypass**: Admin role bypasses all permission checks except system-level operations.

4. **ReadOnly Restrictions**: ReadOnly role cannot view patient identifiers (MRN, SSN) to minimize PHI exposure.

5. **Billing Access**: Billing role can view patient records for billing context but cannot edit clinical content.

6. **Multi-Tenancy**: If multi-tenancy is implemented, all permissions are scoped to the user's tenant.

## Implementation

This matrix is implemented in:
- Database: `roles`, `privileges`, `role_privileges` tables
- Middleware: `server/middleware/authorization.js`
- Migration: `server/scripts/migrate-hipaa-security.js`

## Updates

To modify permissions:
1. Update the database via `role_privileges` table
2. Update this document
3. Test permission changes
4. Document changes in audit log





