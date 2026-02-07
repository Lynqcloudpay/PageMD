# Plan: Fluid View Transitions for Main Content

## Objective
Implement a smooth, fluid "loading" transition for the main content bubble when switching between navigation items, creating a more professional and integrated feel.

## Proposed Changes

### 1. Layout.jsx (Frontend Specialist)
- **Wrap Main Content**: Wrap the `main` content area (the white bubble) in a `framer-motion` `AnimatePresence` and `motion.div`.
- **Implement Transitions**: 
    - Use a soft fade-in (`opacity`) combined with a subtle upward slide (`translateY`).
    - Timing: ~400ms with a `circOut` or `easeOut` easing for a "fluid" feel.
    - Key on `location.pathname` to trigger animation on every route change.

### 2. Implementation Details
- Ensure the animation doesn't cause layout shifts or vertical scrolling jumps.
- Use `mode="wait"` in `AnimatePresence` to let the old view exit smoothly before the new one enters.

### 3. Verification (Test Engineer)
- **Manual Polish Check**: Navigate through all sidebar items and verify the transition feels "fluid" and not jarring.
- **Performance Audit**: Ensure animations are hardware-accelerated and don't drop frames on low-power devices.
- **Lint Check**: Run `lint_runner.py`.

## Verification Criteria
- Navigation switching feels significantly smoother.
- No "white flash" or instant snap between pages.
- Main bubble feels "alive" during state changes.

Onaylıyor musunuz? (Y/N)
