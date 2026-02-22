# Echo Phase 4 — Predictive Intelligence & Document Analysis

## Goal
Expand Eko from reactive tool-calling into a **proactive intelligence engine** with document analysis (Vision API), clinical guideline citations (Evidence Cards), and proactive risk alerts visible outside the chat panel.

## What Already Exists (Do Not Rebuild)
- `echoScoreEngine.js` — ASCVD, CHA2DS2-VASc, MELD calculators
- `RiskAssessmentCard` — Frontend visualization with progress bars
- `get_risk_scores` tool — Wired in TOOL_CATALOG + executeTool
- File upload UI — Paperclip button + attachments state (but files are NOT processed)

---

## Tasks

### Phase 4A: Document Analysis (Vision API)

- [x] **Task 1**: Wire file upload to backend — send base64 files in `/echo/chat` payload → Verify: `req.body.attachments` contains Base64 strings in the chat route
- [x] **Task 2**: Add `analyze_document` tool to `echoService.js` TOOL_CATALOG — passes base64 image to GPT-4o Vision → Verify: tool appears in TOOL_CATALOG, executeTool handles it
- [x] **Task 3**: Create `DocumentAnalysisCard` in `EchoPanel.jsx` — renders extracted findings with structured display → Verify: upload a test image, see card render

### Phase 4B: Evidence-Based Citations (Guideline Engine)

- [x] **Task 4**: Create `echoGuidelineEngine.js` — 20+ clinical guideline snippets (ADA 2024 Diabetes, AHA BP, USPSTF Screening) with keyword matching → Verify: `searchGuidelines('diabetes a1c')` returns ADA recommendation
- [x] **Task 5**: Add `search_guidelines` tool to `echoService.js` — LLM can cite specific guidelines → Verify: ask "What does ADA say about A1c targets?" and get a guideline card
- [x] **Task 6**: Create `EvidenceCard` in `EchoPanel.jsx` — shows guideline citation with source, year, grade → Verify: card renders with proper formatting

### Phase 4C: Proactive Risk Alerts (Chart Integration)

- [x] **Task 7**: Add `EkoRiskBadge` component — small pill rendered in patient chart header showing count of elevated risk scores → Verify: badge appears next to patient name on snapshot page
- [x] **Task 8**: Create `/api/echo/risk-summary/:patientId` endpoint — lightweight endpoint returning pre-computed risk score summary → Verify: `GET /api/echo/risk-summary/:id` returns JSON with scores

### Phase 4D: Verification

- [x] **Task 9**: Build compiles cleanly (exit code 0)
- [x] **Task 10**: All engines imported, tools wired, routes registered

## Done When
- [x] User can upload a document image and Eko analyzes it
- [x] Eko cites specific clinical guidelines when answering evidence questions
- [x] Patient chart header shows a proactive risk badge (if scores are elevated)
