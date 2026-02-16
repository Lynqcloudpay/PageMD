# Task: Echo Staged Action Queue (Phase 3 Foundation)

## Objective
Convert immediate AI write actions (adding problems, medications, orders) into a "Staged" workflow where actions are queued for provider approval before hitting the database.

## Architecture & Design
1. **Action Payload**: Echo tools will now return a `staged_action` object containing the intended database change.
2. **Approval UI**: EchoPanel will render a new "Staging Sidebar" or "Action Cards" with Approve/Reject buttons.
3. **Commit Workflow**: Approved actions will be sent to a dedicated `/api/echo/commit` endpoint for final execution.

## Proposed Changes

### Backend
- **echoService.js**:
    - Update `add_problem`, `add_medication`, and `create_order` tools to return `type: 'staged_action'` instead of performing `pool.query`.
    - Include a unique `action_id` (ephemeral for session) and the full `payload`.
- **echo.js (Routes)**:
    - Add `router.post('/commit')` endpoint.
    - This endpoint will perform the actual database inserts previously handled in the service.

### Frontend
- **EchoPanel.jsx**:
    - Update `WriteActionCard` to `StagedActionCard`.
    - Add state to track `pendingActions` in the UI.
    - Implement `handleApproveAction` and `handleRejectAction`.
    - Ensure approved actions trigger relevant chart refreshes (via existing event patterns).

## Verification Plan
1. Send request: "Add Hypertension to the problem list".
2. Verify Echo says: "I've staged adding Hypertension. Would you like to approve?"
3. Verify a UI button appears with "Approve Hypertension".
4. Click "Approve" and verify the `problems` table is updated.
