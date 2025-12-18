# Visit Status System Implementation

## Summary

Implemented a comprehensive visit/note status system that fixes the bug where signed notes were being opened instead of creating new drafts, and adds proper today-draft logic.

## Changes Made

### 1. Database Migration (`server/scripts/migrate-visit-status-system.js`)

- Added `status` ENUM: `draft`, `signed`, `amended`, `void`
- Added `note_type` ENUM: `office_visit`, `telephone`, `portal`, `refill`, `lab_only`, `nurse_visit`
- Added `encounter_date` DATE column (clinic-local date)
- Migrated existing data:
  - Set `status` based on `note_signed_at` (signed if exists, otherwise draft)
  - Set `encounter_date` from `visit_date`
  - Set `note_type` from `visit_type` with intelligent mapping
- Created indexes:
  - `idx_visits_patient_encounter_status` - for today-draft queries
  - `idx_visits_patient_provider_encounter_status` - for provider-specific queries
  - `idx_visits_unique_today_draft` - unique partial index to prevent duplicate today drafts
  - `idx_visits_encounter_date` - for date-based queries

### 2. Backend API Updates

#### New Utility (`server/utils/timezone.js`)
- `getTodayInClinicTimezone()` - Gets today's date in America/New_York timezone
- `getTodayDateString()` - Returns YYYY-MM-DD string in clinic timezone
- `toClinicDateString()` - Converts any date to clinic timezone date string

#### Updated Endpoints (`server/routes/visits.js`)

**GET `/api/visits/today-draft/:patientId?providerId=...`**
- Returns `{ note: {...} }` or `{ note: null }`
- Uses `encounter_date` and `status='draft'` (not `visit_date` and `note_signed_at`)
- Computes "today" in America/New_York timezone
- Optional provider filter

**POST `/api/visits/open-today/:patientId`**
- Idempotent: returns existing today draft or creates new one
- Body: `{ noteType: 'office_visit' | 'telephone' | ..., providerId?: ... }`
- Returns `{ note: {...} }`
- Uses transaction + unique index to prevent race conditions
- Automatically sets `encounter_date` to today in clinic timezone

### 3. Frontend Updates

#### API Service (`client/src/services/api.js`)
- Updated `getTodayDraft(patientId, providerId?)` to use new endpoint format
- Added `openToday(patientId, noteType, providerId?)` method

#### Snapshot Component (`client/src/pages/Snapshot.jsx`)
- Updated to use new API response format: `response.data?.note`
- Button logic:
  - **"Open Today's Note"** - shown when `todayDraftVisit` exists, navigates to that draft
  - **"New Visit"** - always available, calls `openToday()` then navigates to the note
- Removed fallback to "latest note" (this was causing signed notes to be opened)
- All "New Visit" clicks now use `openToday()` endpoint (idempotent)

## How It Works

### Core Rules (Implemented)

1. **If draft exists for TODAY** → Show "Open Today's Note" button
   - Opens that specific draft note
   - Also shows "New Visit" button (for telephone encounters, etc.)

2. **If NO draft for TODAY** → Show "New Visit" button
   - Calls `POST /api/visits/open-today`
   - Creates new draft with `encounter_date = today` (clinic timezone)
   - Navigates to the new note

3. **Old drafts don't affect today**
   - Only checks `encounter_date = today` and `status = 'draft'`
   - Prior dates are ignored

### Timezone Handling

- "Today" is computed server-side in `America/New_York` timezone
- Uses `encounter_date` DATE column (not TIMESTAMP)
- Frontend doesn't need to know timezone - server handles it

## Migration Instructions

1. **Run the migration:**
   ```bash
   cd server
   node scripts/migrate-visit-status-system.js
   ```

2. **Verify migration:**
   ```sql
   SELECT status, note_type, encounter_date, COUNT(*) 
   FROM visits 
   GROUP BY status, note_type, encounter_date;
   ```

3. **Test the endpoints:**
   ```bash
   # Get today's draft
   curl -H "Authorization: Bearer $TOKEN" \
     https://bemypcp.com/api/visits/today-draft/$PATIENT_ID
   
   # Open/create today's draft
   curl -X POST -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"noteType":"office_visit"}' \
     https://bemypcp.com/api/visits/open-today/$PATIENT_ID
   ```

## Remaining Work

### Quick Orders Feature (Not Yet Implemented)
- Create `QuickOrders` component for telephone encounters
- Add lightweight order placement UI (labs, Rx, imaging, referrals)
- Create `POST /api/encounters/quick` endpoint
- Create order endpoints that attach to encounter ID

### Future Enhancements
- Support multiple note types in UI
- Add "Amend" functionality for signed notes
- Add "Void" functionality
- Provider-specific draft filtering in UI

## Testing Checklist

- [x] Migration runs successfully
- [x] Today-draft endpoint returns correct format
- [x] Open-today endpoint creates new draft
- [x] Open-today endpoint returns existing draft (idempotent)
- [x] Frontend shows "Open Today's Note" when draft exists
- [x] Frontend shows "New Visit" when no draft exists
- [x] "New Visit" creates and opens new draft
- [x] Old drafts don't affect today's logic
- [x] Timezone is computed correctly (America/New_York)
- [ ] Quick Orders component (pending)
- [ ] Quick Orders endpoints (pending)

## Breaking Changes

- **API Response Format**: `GET /today-draft/:patientId` now returns `{ note: ... }` instead of the note directly
- **Database Schema**: New required columns (`status`, `note_type`, `encounter_date`)
- **Old Endpoints**: `/find-or-create` still works but should be migrated to `/open-today`

## Notes

- The unique partial index prevents duplicate today drafts even with race conditions
- All date comparisons use `encounter_date` (DATE) not `visit_date` (TIMESTAMP)
- Server computes "today" in clinic timezone, frontend doesn't need timezone logic



