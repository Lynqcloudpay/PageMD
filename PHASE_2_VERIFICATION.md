# Phase 2 Verification Checklist (Manual)

Follow these steps to verify the "Role Governance" and "Impersonation" features on the live `bemypcp.com` site.

## 1. Login as Platform Admin
1. Navigate to `https://bemypcp.com/platform-admin/login`.
2. Login with your Platform Admin credentials.
3. You should see the **Platform Admin Dashboard**.

## 2. Verify Clinic Details & Compliance
1. Click on **Manage Clinics** or select a clinic from the "Recent Clinics" list.
2. In the Clinic Details view, look for the **Platform Configuration** section (bottom right sidebar).
3. **Action**: Change the "Compliance Zones" field (e.g., add "GDPR") or update the "Go-Live Date".
4. **Action**: Change "Tenant Type" to "Group".
5. Refresh the page.
6. **Verification**: Confirm that your changes persisted.

## 3. Verify "Break Glass" Impersonation
1. In the same Clinic Details view, look at the **Authorized Personnel** table.
2. Find a user (e.g., a clinician or staff member).
3. Click the **Eye Icon** (Impersonate User) in the Actions column.
4. **Action**: Enter a reason for access (e.g., "Troubleshooting login issue").
5. **Verification**:
   - A new tab/window should open.
   - You should be automatically logged in as that user.
   - You should see the user's dashboard (not the Platform Admin dashboard).
   - **Note**: This proves the secure token exchange passed.

## 4. Verify Audit Trails
1. Close the impersonation tab and return to the **Platform Admin Clinic Details** page.
2. Locate the **Platform Audit Trail** section (main column, below Role Governance).
3. **Verification**:
   - You should see a new entry at the top: `IMPERSONATION INITIATED`.
   - Hover over the details or expand to see the reason you entered ("Troubleshooting login issue").

## 5. Verify Role Governance (Drift)
1. Locate the **Role Governance** section.
2. It should show the status of roles (e.g., "Physician", "Nurse").
3. If all are green, it means they match the global standard.
4. **Optional Test**: 
   - Use the *Impersonated* session (from step 3) to change a permission for a role (if valid).
   - Return to Platform Admin and refresh.
   - You should see a "Drift Detected" warning for that role.
   - Click **Sync** to force it back to standard.

---
**Status**: If all steps pass, Phase 2 is successfully deployed and verified!
