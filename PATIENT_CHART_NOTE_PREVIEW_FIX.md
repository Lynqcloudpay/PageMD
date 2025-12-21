# Patient Chart - Visit History Note Preview Fix

## Problem
- Visit notes show ugly monospace font with raw text
- Hard to read, shows encoded characters
- No clean preview

## Solution
Create clean note preview showing only:
- Chief Complaint (CC)
- History of Present Illness (HPI)  
- Assessment
- Plan

Plus "View Full Note" button to open complete note in VisitNote view.

## Files to Modify
1. `/client/src/components/PatientChartPanel.jsx`
   - Add note parsing function
   - Update note display (lines 329-335)
   - Add "View Full Note" button with navigation

## Implementation
- Parse note_draft to extract sections
- Display in clean, readable format
- Add button to navigate to `/visit/:visitId` for full note view
