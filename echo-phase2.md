# Project Echo — Phase 2 Implementation Plan

## Phase 2A: Smart Visit Note Drafting + Global Echo + Write Actions

### 1. Global Echo Availability
- [ ] Remove patient-only gate in Layout.jsx
- [ ] Add general-purpose tools (schedule queries, inbox stats, pending notes)
- [ ] Update EchoPanel to work with or without a patientId

### 2. Visit Note Drafting Tools
- [ ] `draft_note_section` — Generate HPI, assessment, or plan from patient context
- [ ] `suggest_diagnoses` — Suggest ICD-10 codes from chief complaint + context
- [ ] Frontend: "Insert into note" action on drafts

### 3. Write Actions (with confirmation)
- [ ] `add_problem` — Add to problem list
- [ ] `add_medication` — Add to medication list
- [ ] `create_order` — Create a lab/imaging/referral order
- [ ] Frontend: Confirmation cards before executing writes

### 4. New General Tools (non-patient)
- [ ] `get_schedule_summary` — Today's appointments overview
- [ ] `get_pending_notes` — Unsigned notes count and list
- [ ] `get_inbox_summary` — Inbox stats and recent items

---

## Implementation Order
1. Backend: New tools in echoService.js
2. Backend: New route endpoints if needed
3. Frontend: Layout.jsx global availability
4. Frontend: EchoPanel.jsx — write confirmations + insert-to-note
5. Deploy & test
