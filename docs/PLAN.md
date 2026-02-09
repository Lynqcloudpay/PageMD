# Plan: Admin Settings Redesign

Redesign the Admin Settings page to match the new PageMD "Clinic Overview" aesthetics: compact, modern, space-aware, and premium.

## 🎨 Design Goals
- **Compact Header**: Thin out the main title and description.
- **Glassmorphism Tabs**: Use sticky, blurred tab navigation with subtle indicators.
- **High-Density Inputs**: Tighten padding, reduce font sizes (text-[10px] for labels, text-sm for inputs), and use a more refined grid layout.
- **Premium Cards**: Group settings into refined section cards with subtle borders and shadows.
- **Status Sync**: Ensure consistent save indicators and loading states.

## 🛠️ Phases

### Phase 1: Header & Tab Navigation
- Reduce header padding and font sizes.
- Implement a floating/sticky tab bar with glassmorphism (backdrop-blur).
- Use Lucide icons with consistent scaling (w-4 h-4).

### Phase 2: Main Layout & Section Cards
- Redesign the tab content container to be edge-to-edge with the clinic container.
- Implement section cards for "Practice Information", "Security Policy", etc.
- Use a tiered z-index approach similar to the schedule.

### Phase 3: Field-Level Optimizations
- Reduce input padding (py-1.5 px-3).
- Use `text-[10px] font-bold text-slate-500 uppercase tracking-widest` for labels.
- Tighten the gap between fields (space-y-4 instead of default margins).

### Phase 4: Tab-Specific Refinements
- **Practice**: Compact address grid and logo uploader.
- **Security**: Refined toggles and policy inputs.
- **Clinical**: Condensed list of clinical defaults.
- **Features**: Grid-based toggle list.

## 🧪 Verification
- Test responsiveness across monitor sizes.
- Verify "Save" functionality in all tabs.
- Ensure tab switching preserves state where possible.
- Lint and security check.
