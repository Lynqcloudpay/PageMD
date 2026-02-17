# PLAN: Eko Phase 4 - Predictive Intelligence & Clinical RAG

## 🎯 Goal
Transition Eko from a reactive assistant to a proactive clinical intelligence engine that predicts risks, retrieves evidence-based guidelines, and processes multi-modal data.

## 🏗️ Architecture Expansion
1. **Clinical RAG Engine**: Vector database (or pgvector) integration to store and query clinical guidelines (ADA, AHA, USPSTF).
2. **Predictive Scoring Logic**: Background computation of standardized clinical risk scores (ASCVD, CHADS2-Vasc, CHA2DS2-VASc, MELD).
3. **Multi-Modal Pipeline**: Support for file uploads (PDF/Images) with OCR/Vision for document analysis.

---

## 📅 implementation Roadmap

### Step 1: Foundation (Backend-Specialist)
- [ ] **Vector Support**: Enable `pgvector` in Postgres or implement a similarity search service.
- [ ] **Predictive Orchestrator**: Create a service that listens for vital/lab changes and auto-calculates relevant scores.
- [ ] **Guidelines Index**: Ingest 3-5 core clinical guidelines into the vector store.

### Step 2: Multi-Modal (Backend-Specialist + Frontend-Specialist)
- [ ] **Upload Handler**: Enhance `EchoPanel.jsx` to support file attachments.
- [ ] **Vision Integration**: Pass document images to GPT-4o-vision for clinical extraction (Labs, Imaging Repots).

### Step 3: Proactive UI (Frontend-Specialist)
- [ ] **Risk Alert Pills**: New UI components in the chart to show "Eko Predicted Risks."
- [ ] **Evidence Cards**: UI cards that display "Source Material" when Eko answers based on guidelines.
- [ ] **Score Breakdown View**: Expandable cards showing how a score (e.g., ASCVD) was calculated.

### Step 4: Verification (Test-Engineer)
- [ ] **Accuracy Audit**: Validate Eko's risk score calculations against manual gold standards.
- [ ] **E2E Testing**: Scenario testing for "File Upload -> Analysis -> Note Drafting."

---

## ✅ Verification Criteria
1. Eko correctly calculates an ASCVD score when a Lipid Panel is recorded.
2. Eko can cite a specific guideline (e.g., ADA 2024) when asked about diabetes management.
3. Users can upload a PDF and ask Eko to summarize clinical findngs.

---

## ⏸️ ACTION REQUIRED: Confirm Phase 4 Scope
Please review the plan in `docs/PLAN_ECHO_PHASE4.md`. 

**Onaylıyor musunuz? (Y/N)**
- **Y**: Implementation (Phase 2) başlatılır.
- **N**: Planı düzeltirim.
