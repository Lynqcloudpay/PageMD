# PLAN: Schedule High-Density UI & Provider Differentiation

## 🎼 Orchestration Report

### Task
Refactor the schedule layout to a high-density single row that fits perfectly within the 24px appointment slot. Implement unique, diverse provider coloring in the schedule and legend to avoid visual confusion.

### Mode
edit

### Agents Invoked (MINIMUM 3)
| # | Agent | Focus Area | Status |
|---|-------|------------|--------|
| 1 | project-planner | Task breakdown & planning | ✅ |
| 2 | frontend-specialist | UI & Style implementation | 🔄 |
| 3 | performance-optimizer | Density & Layout audit | 🔄 |

---

## 🏗️ Technical Plan

### Phase 1: Provider Color System
1. **Refresh Color Palette**: Expand `getProviderColor` in `Schedule.jsx` with more diverse, high-contrast professional colors (Emerald, Blue, Orange, Cyan, Fuchsia, etc.) to ensure providers are distinguishable.
2. **Remove Active Override**: In the appointment card rendering, remove the hardcoded `#818cf8` active border color. Instead, use the provider's specific `color.accent` but apply a heavier weight or a distinct `ring` effect to indicate "Active" status. This keeps provider identity preserved even when the patient is in clinic.

### Phase 2: High-Density Single-Row Refactor
1. **Vertical Tightening**:
   - Ensure all elements inside the appointment card have a strict height constraint to fit within the `24px` card.
   - Reduce padding and margins in `InlinePatientStatus` buttons (`StatusBtn`, `RoomBtn`).
2. **Horizontal streamlining**:
   - In `Schedule.jsx`, adjust column widths to prioritize critical information.
   - In `InlinePatientStatus.jsx`, replace the "→" arrow with a more subtle separator (e.g., a slim vertical bar or dot).
   - Condense the "FOLLOW-UP" and status buttons to use smaller text or icons where appropriate, but maintain readability.
3. **Component Synchronization**:
   - Ensure `InlinePatientStatus` sub-components use absolute positioning or negative margins if needed to keep the row height strictly under control.

### Phase 3: Alignment & Cleanup
1. **Legend Alignment**: Ensure the provider legend at the top uses the same color mapping as the schedule cards.
2. **Final Audit**: Check responsiveness and ensure that "Active" appointments are still clearly distinguished from "Scheduled" appointments without losing the provider's color identity.

---

## 🛠️ Implementation Steps

1. **Modify `Schedule.jsx`**:
   - Update `getProviderColor` with more distinct colors.
   - Update appointment card rendering logic for colors and active states.
   - Adjust column widths for better horizontal flow.
2. **Modify `InlinePatientStatus.jsx`**:
   - Reduce heights and paddings.
   - Simplify separators.
   - Ensure the "bulky" feel is eliminated by removing unnecessary borders/shadows in standard states.

Onaylıyor musunuz? (Y/N)
