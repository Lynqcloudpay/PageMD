# PLAN: Platform Admin Commercial-Grade Overhaul

## 🎯 Goal
Transform the current expanded and disorganized Clinic Details page into a professional, high-density, commercial-grade admin dashboard with granular controls and "takeover" capabilities.

## 🏗️ Phase 1: Planning & Design (Orchestration Start)
- [ ] Research missing properties in `server/routes/superAdmin.js`.
- [ ] Define the "Commercial Grade" layout:
    - **Header**: Critical status and primary actions (Takeover, Delete).
    - **Sidebar/Tabs**: Quick navigation between sections (Users, Billing, Features, Logs).
    - **Collapsible Content**: Modular management cards.
- [ ] Define the "Takeover" (Impersonation) mechanism.

## 🛠️ Phase 2: Implementation (Foundation & Backend)
- **Agent: `backend-specialist`**
    - [ ] **Fix `tenant.js` Middleware**: Ensure `billing_manual_override` allows true manual control of columns (`is_read_only`, `billing_locked`) instead of forcing them to false.
    - [ ] **Add Impersonation Route**: `/api/super/clinics/:id/impersonate` which generates a session token for a clinic admin.
    - [ ] **Granular Features**: Ensure `/api/super/clinics/:id/features` and `/controls` expose ALL potential clinical toggles.

## 🎨 Phase 3: Frontend Implementation (Orchestrator Coordination)
- **Agent: `frontend-specialist`**
    - [ ] **Layout Refactor**: Implement a cleaner, high-density dashboard with a scrollable sidebar/main content setup.
    - [ ] **Collapsible Section Components**: Create modular, collapsible cards for:
        - Clinic Identity & Config
        - Personnel & Role Management
        - Security Kill-Switches
        - Billing History & Dunning Logic
        - Platform Audit Log
    - [ ] **Takeover Flow**: Add a "Login as Super Admin" takeover button.
    - [ ] **Granular Feature Grid**: A visual grid for toggling sub-features.

## 🧪 Phase 4: Polish & Verification
- **Agent: `test-engineer`**
    - [ ] Verify manual controls stick when override is ON.
    - [ ] Verify automated logic resumes properly when override is OFF.
    - [ ] Audit CSS for "expanded" bloat and ensure high-density responsiveness.

---
## 🎼 Orchestration Details
- **Agents Involved (3+)**: `project-planner`, `backend-specialist`, `frontend-specialist`, `test-engineer`.
- **Primary Skill**: `frontend-design` (ui-ux-pro-max guidelines).
