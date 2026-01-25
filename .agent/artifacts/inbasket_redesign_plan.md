# InBasket Redesign - Implementation Plan

## Overview
Complete redesign of the InBasket feature to function as a unified clinical inbox similar to eClinicalWorks. The new system will centralize all incoming clinical items (labs, documents, referrals, images, consult notes) and provide a streamlined workflow for physician review, task assignment, and quality metric tracking.

---

## Core Features

### 1. **Document Inbox (Primary Focus)**
- Receive and organize incoming clinical documents:
  - Lab Results (from HL7/FHIR interfaces)
  - Imaging Reports (Radiology, Cardiology)
  - Consult Notes from referring physicians
  - Scanned documents (faxes, external reports)
  - Patient-uploaded health records
- **All documents MUST be linked to a patient profile**
- Visual previews for images and PDFs
- Metadata extraction (document type, source, date)

### 2. **Physician Review Workflow**
- Items arrive in "Pending Review" status
- Physician can:
  - **Document Findings**: Add clinical interpretation/notes
  - **Create Follow-up Plan**: Define next steps (order tests, schedule visit, etc.)
  - **Approve/Sign Off**: Mark as reviewed with e-signature
  - **Assign to Staff**: Delegate follow-up tasks to team members
  - **Link to Metrics**: Tag for quality tracking (colonoscopy, mammogram, A1C, etc.)
- Review history with timestamps and user attribution

### 3. **Task Management System**
- Dedicated Tasks section with:
  - Tasks assigned TO the current user
  - Tasks assigned BY the current user
  - Overdue task highlighting
  - Task categories (Follow-up, Call Patient, Schedule, Documentation, Lab Review)
- Quick task creation from any inbox item
- Task status workflow: Open → In Progress → Completed
- Due dates and priority levels (Routine, Urgent, STAT)

### 4. **Messaging Hub**
- **Patient Portal Messages**: Two-way communication with patients
- **Internal Staff Messages**: Secure internal messaging between team members
- Thread-based conversation view
- Message drafts and templates
- Read receipts and notification badges

### 5. **Quality Metrics Tracking**
- Tag documents for preventive care metrics:
  - Colonoscopy
  - Mammography
  - Bone Density
  - A1C values
  - Lipid Panels
  - Immunizations
- Dashboard showing care gap closure rates
- Integration with Health Maintenance module

---

## UI/UX Design

### Navigation Structure
```
┌─────────────────────────────────────────────────────────────────┐
│  SIDEBAR            │  ITEM LIST           │  DETAIL PANEL      │
├─────────────────────┼──────────────────────┼────────────────────┤
│  📥 All Inbox (25)  │  List of items with  │  Full item details │
│  📋 Results (8)     │  search/filter       │  • Document preview│
│  📄 Documents (5)   │                      │  • Review actions  │
│  📬 Messages (3)    │                      │  • Notes/findings  │
│  ✅ Tasks (4)       │                      │  • Task creation   │
│  📤 Sent            │                      │  • Assignment      │
│  ───────────────    │                      │                    │
│  Filters:           │                      │                    │
│  • Pending Review   │                      │                    │
│  • Reviewed         │                      │                    │
│  • My Items         │                      │                    │
│  • All Items        │                      │                    │
└─────────────────────┴──────────────────────┴────────────────────┘
```

### Category Tabs (Updated)
1. **Results** - Lab and imaging results requiring review
2. **Documents** - Incoming clinical documents (consults, reports, scans)
3. **Messages** - Patient portal messages + Internal staff messages
4. **Tasks** - Assigned tasks and follow-ups
5. **Referrals** - Incoming/Outgoing referral tracking
6. **Rx Requests** - Medication refill requests

### Detail Panel Features
- Document/Image preview with zoom
- Patient context ribbon (name, DOB, MRN, allergies, problems)
- Action toolbar:
  - ✓ Approve/Sign Off
  - 📝 Add Findings
  - 👤 Assign to User
  - 📊 Track Metric
  - 📅 Schedule Follow-up
  - 🗑️ Archive
- Threaded conversation history for messages
- Related documents section

---

## Database Schema Updates

### New Tables

```sql
-- Enhanced inbox_items table
ALTER TABLE inbox_items ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE inbox_items ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id);
ALTER TABLE inbox_items ADD COLUMN IF NOT EXISTS findings TEXT;
ALTER TABLE inbox_items ADD COLUMN IF NOT EXISTS plan TEXT;
ALTER TABLE inbox_items ADD COLUMN IF NOT EXISTS metric_tags TEXT[]; -- ['colonoscopy', 'mammogram']
ALTER TABLE inbox_items ADD COLUMN IF NOT EXISTS document_type VARCHAR(100); -- 'lab_result', 'consult_note', 'imaging', 'external_report'
ALTER TABLE inbox_items ADD COLUMN IF NOT EXISTS source_facility VARCHAR(255);
ALTER TABLE inbox_items ADD COLUMN IF NOT EXISTS source_provider VARCHAR(255);
ALTER TABLE inbox_items ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ;
ALTER TABLE inbox_items ADD COLUMN IF NOT EXISTS is_urgent BOOLEAN DEFAULT FALSE;

-- Tasks table (dedicated)
CREATE TABLE IF NOT EXISTS clinical_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(500) NOT NULL,
  description TEXT,
  patient_id UUID REFERENCES patients(id),
  assigned_to UUID REFERENCES users(id) NOT NULL,
  assigned_by UUID REFERENCES users(id) NOT NULL,
  category VARCHAR(50), -- 'follow_up', 'call_patient', 'schedule', 'documentation', 'lab_review'
  priority VARCHAR(20) DEFAULT 'routine', -- 'routine', 'urgent', 'stat'
  status VARCHAR(20) DEFAULT 'open', -- 'open', 'in_progress', 'completed', 'cancelled'
  due_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES users(id),
  source_inbox_item_id UUID REFERENCES inbox_items(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Metric tracking table
CREATE TABLE IF NOT EXISTS quality_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) NOT NULL,
  metric_type VARCHAR(100) NOT NULL, -- 'colonoscopy', 'mammogram', 'a1c', 'lipid_panel', 'bone_density'
  result_date DATE,
  result_value VARCHAR(255),
  next_due_date DATE,
  inbox_item_id UUID REFERENCES inbox_items(id),
  document_id UUID REFERENCES documents(id),
  reviewed_by UUID REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

---

## API Endpoints

### New/Updated Endpoints

```
# Inbox Items
GET    /api/inbox                        # List with enhanced filters
GET    /api/inbox/:id                    # Get item with full details
PUT    /api/inbox/:id/review             # Submit physician review (findings, plan, sign-off)
POST   /api/inbox/:id/assign             # Assign to user with optional task creation
POST   /api/inbox/:id/track-metric       # Tag for quality metric tracking
GET    /api/inbox/stats                  # Enhanced statistics

# Tasks
GET    /api/tasks                        # List tasks (filters: assigned_to, assigned_by, status, category)
POST   /api/tasks                        # Create new task
PUT    /api/tasks/:id                    # Update task
PUT    /api/tasks/:id/complete           # Mark task complete
DELETE /api/tasks/:id                    # Archive task

# Quality Metrics
GET    /api/metrics                      # List metrics by patient or type
POST   /api/metrics                      # Create metric entry
GET    /api/metrics/dashboard            # Aggregate metrics for dashboard
```

---

## Implementation Phases

### Phase 1: Database & Backend (2-3 hours)
1. Create migration for schema updates
2. Add new API endpoints for tasks and metrics
3. Enhance inbox item detail endpoint with review fields
4. Add review workflow endpoints

### Phase 2: Frontend - Core Structure (3-4 hours)
1. Redesign InBasket component with new layout
2. Implement category tabs with counts
3. Build enhanced detail panel with document preview
4. Add physician review modal with findings/plan inputs

### Phase 3: Task Management (2-3 hours)
1. Create Tasks tab UI
2. Implement task list with filters
3. Build task creation modal
4. Add task-from-inbox-item functionality
5. Implement task status workflow

### Phase 4: Messaging Integration (1-2 hours)
1. Consolidate patient and staff messaging
2. Add threaded conversation view
3. Implement new message composition
4. Add notification badges

### Phase 5: Quality Metrics (1-2 hours)
1. Build metric tagging UI
2. Create metric tracking modal
3. Add metrics summary to patient chart
4. Build metrics dashboard widget

### Phase 6: Polish & Testing (1-2 hours)
1. Performance optimization
2. Mobile responsiveness
3. Keyboard shortcuts
4. Error handling
5. End-to-end testing

---

## Design Tokens

### Colors
- Primary Action: `#3B82F6` (Blue 500)
- Pending Review: `#F59E0B` (Amber 500)
- Reviewed/Complete: `#10B981` (Emerald 500)
- Urgent: `#EF4444` (Red 500)
- STAT: `#DC2626` (Red 600)

### Typography
- Category Headers: 11px, Bold, Uppercase, Letter-spacing 0.1em
- Item Title: 14px, Semibold
- Item Preview: 13px, Regular
- Timestamp: 11px, Regular, Gray-500
- Badge: 10px, Bold

### Spacing
- Sidebar Width: 260px
- List Width: Flex-1 (min 300px)
- Detail Panel Width: 480px
- Item Padding: 16px horizontal, 14px vertical

---

## Success Criteria

1. ✅ All incoming documents linked to patient profiles
2. ✅ Physicians can document findings and create plans
3. ✅ Tasks can be assigned and tracked
4. ✅ Quality metrics are captured and visible
5. ✅ Messages consolidated in single hub
6. ✅ < 3 clicks to complete common actions
7. ✅ Real-time updates (polling or WebSocket)
8. ✅ Mobile-friendly responsive design

---

## Estimated Total Time: 12-16 hours

**Priority Order:**
1. Phase 1 (Backend) - Critical foundation
2. Phase 2 (Core UI) - User-facing value
3. Phase 3 (Tasks) - Key workflow
4. Phase 4 (Messaging) - Communication
5. Phase 5 (Metrics) - Quality tracking
6. Phase 6 (Polish) - Production readiness
