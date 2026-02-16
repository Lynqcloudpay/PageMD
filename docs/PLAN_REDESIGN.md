# PageMD Global UI Redesign — Plan

**Goal:** Transform the PageMD EMR into a premium, HD healthcare dashboard based on the "Teal Dashboard" reference image.

## 🎨 Design System (Teal High-Contrast)

| Category | Value | Reasoning |
|----------|-------|-----------|
| **Sidebar BG** | `#003133` (Deep Teal) | Provides strong anchor and contrast against content. |
| **Page BG** | `#F0F4F5` (Light Teal-Gray) | Soft color that makes white cards "pop". |
| **Surface** | `#FFFFFF` (Solid White) | Maximum clarity for clinical data. |
| **Border** | `#E2E8E9` (Soft Teal-Border) | Replaces generic gray with branded depth. |
| **Primary** | `#0891B2` (Cyan-600) | Vibrant, health-focused teal. |
| **Active State** | `#FFFFFF15` (Translucent White) | Subtle highlight in dark sidebar. |
| **Typography** | Figtree / Noto Sans | Premium, legible, professional. |

## 🛠️ Step 1: Layout & Sidebar Shell
- Update `Layout.jsx` to support a narrow (~72px) dark teal sidebar.
- Move Logo to the top center of the sidebar.
- Style `SidebarItem` with white icons and a clean "active indicator" (vertical teal bar).
- Implement a white header strip with breadcrumbs and global search (matching image).

## 🩺 Step 2: Snapshot Overhaul
- Replace ALL frosted-lg/backdrop-blur elements with solid white cards.
- **Card Styling**: `border border-gray-100 shadow-sm rounded-lg`.
- **Headers**: Subtle gray-50 background on card headers to separate from body.
- **Buttons**: Replace gradients with solid teal (`bg-teal-600`) and indigo fills.
- **Spacing**: Rigid 8-point grid (16px/24px padding).

## 📋 Step 3: Global Component Sync
- **PatientHeader**: Ensure it fits the light-bg/white-card aesthetic.
- **Tables**: Crisp lines, no background nesting.
- **Navigation**: Breadcrumb styling in the header.

## ✅ Step 4: Verification
- Visual audit against reference image.
- Build test to ensure no breaking changes.
- Contrast check (WCAG 2.1 AA compliant).

---

## Agent Participation Matrix
| Agent | Task |
|-------|------|
| **project-planner** | Coordination & Roadmap |
| **frontend-specialist** | Implementation of Layout, Sidebar & Snapshot |
| **test-engineer** | `vite build` verification & visual audit |
