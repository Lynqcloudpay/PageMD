# PageMD Global UI Redesign — V3 (Vivid Navy & Blue)

**Goal:** Transform the UI into a high-vibrancy, professional clinical dashboard using Navy and Sapphire Blue. Eliminate all green/teal hues.

## 🎨 Design System (Vivid Navy)

| Category | Value | Reasoning |
|----------|-------|-----------|
| **Sidebar BG** | `#0F172A` (Rich Navy) | Darker than content, high contrast, non-green. |
| **Page BG** | `#F8FAFC` (Clean Gray) | Neutral and crisp, prevents "washed out" feel. |
| **Brand Primary**| `#2563EB` (Sapphire Blue) | Vivid, trustworthy, energetic health blue. |
| **Surface** | `#FFFFFF` | Solid white. |
| **Text (Body)** | `#111827` (Gray-900) | High contrast for readability. |
| **Borders** | `#E5E7EB` (Gray-200) | Crisp definition. |

## 🛠️ Step 1: Sidebar Overhaul
- Change sidebar background to `#0F172A`.
- Active state: `#2563EB` (Solid Blue) bar on the left.
- Icons: Bright white/blue accents.

## 🩺 Step 2: Vivid Snapshot (Fixing "Washed Out")
- **Eliminate Mint**: Change page background to clean `#F8FAFC`.
- **Vivid Headers**: Each card gets a strong top border or saturated header icon.
- **Problems Header**: `border-t-2 border-rose-500`.
- **Meds Header**: `border-t-2 border-blue-500`.
- **Allergies Header**: `border-t-2 border-amber-500`.
- **Shadows**: Increase to `shadow-md` for distinct depth.

## ✅ Step 3: Global Text Contrast
- Audit all text labels. Anything `gray-400` becomes `gray-600` or `gray-900`.
- CTA buttons switch from Cyan to **Indigo/Blue-600**.

---

## Agent Participation Matrix
| Agent | Task |
|-------|------|
| **project-planner** | Coordination |
| **frontend-specialist** | Implementation of Navy Sidebar & Vivid Snapshot |
| **test-engineer** | build & contrast audit |
