# PLAN: Echo Phase 3 — Operational Autonomy & Multi-Agent Orchestration

## 🎯 Objective
Evolve Eko from a monolithic assistant into a high-performance **Multi-Agent Orchestration System**. This reduces "prompt pollution," improves accuracy by using specialist personas, and implements the final automation features for operational autonomy.

---

## 🏗️ Architecture: The Specialist Router
We will implement an internal routing layer that detects intent and loads a specialized sub-prompt for the query.

| Specialist | Domain | Trigger Keywords |
| :--- | :--- | :--- |
| **Scribe-Agent** | Clinical Documentation | HPI, assessment, plan, SOAP, draft |
| **Data-Analyst** | Labs & Trends | Labs, trends, vitals, analysis, review |
| **Order-Manager** | Clinical Actions | Add, stage, med, problem, lab order |
| **Global-Navigator** | EMR Operations | Schedule, inbox, navigate, where is |

---

## 🛠️ Phase 3: Action Items

### 1. Intelligence Redesign (The "Brain" Upgrade)
- **Refactor `echoService.js`**: Replace the monolithic `SYSTEM_PROMPT` with a dynamic `getSystemPrompt(intent)` function.
- **Implement Intent Detection**: A lightweight pre-check (or top-level LLM branch) to determine the specialist needed.
- **Agent Handover**: Allow the Orchestrator to "call" a specialist while maintaining the lean context baseline.

### 2. Operational Autonomy (Batch Processing)
- **Batch Processing API**: Update `echoCommitAPI` (or create new endpoint) to accept a list of `action_ids` for one-click commit.
- **StagedActionCard Update**: Add "Select All" and "Commit Selected" to the staged actions queue in `EchoPanel.jsx`.

### 3. Real-time Awareness (Navigation Triggers)
- **Observer Logic**: Add a `useEffect` in `EchoPanel.jsx` that watches the current route and `patientId`.
- **Navigation Context Injection**: When Eko is opened, it automatically knows what page the provider is on (e.g., "Provider is looking at the Lab Results page") without being told.

### 4. Advanced Clinical Memory (Caching layer)
- **Intent Caching**: Skip re-analysis if the user asks for the same data within the same session.

---

## 🏁 Verification Criteria
1. **Efficiency Test**: Verify that a "Scribe" request doesn't send "Lab interpretation" instructions to OpenAI (saving tokens).
2. **Speed Test**: Navigation awareness makes Eko faster at answering "What am I looking at?"
3. **Usability**: Single-click "Approve All" works for 3+ staged medications/problems.

---

## 📅 Execution Roadmap
1. [ ] Create specialist prompt definitions.
2. [ ] Refactor `echoService.js` routing logic.
3. [ ] Implement Batch Review UI.
4. [ ] Implement Navigation Observer.
