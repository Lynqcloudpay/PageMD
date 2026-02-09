# Task: Refine Growth Rewards Widget for Simplicity and Aesthetics

The goal is to simplify the "Referrals/Reward" section in Admin Settings. The user feels the current design is too "big and bold" and the math is hard to understand. We need a "Regular Joe" friendly explanation and a cleaner, premium UI.

## 1. Simplified "Regular Joe" Math Explanation
> "Think of PageMD like a bulk-buying club. The more referrals you have, the cheaper it gets for everyone. Your referrals add 'Discount Weight' to your account, pushing your per-provider price down. You only pay for your own providers, but at the discounted rate earned by the whole group."

## 2. Design Updates (UX/UI)
- **Compact Tiers**: Instead of a "Staircase" name, use "Volume Tiers".
- **Weight Concept**: Replace "Ghost Seats" with "Network Weight" or "Referral Credits".
- **Gentile Aesthetics**:
    - Use Indigo-600 as the primary accent.
    - Use Slate-500/600 for secondary text (not light grey).
    - Remove large gradients; use subtle border-radius (2rem) and soft shadows.
    - Reduce title font sizes from "black" (900) to "bold" (700).

## 3. Component Refactoring (GrowthRewardWidget.jsx)
### Phase 1: Terminology & Data Mapping
- Update labels:
    - `totalBillingSeats` -> `Effective Volume`
    - `ghostSeats` -> `Referral Weight`
    - `physicalSeats` -> `Your Providers`
    - `virtualTotal` -> `Network Total`

### Phase 2: Refined Layout
- **Tier 0: Progress Overview**: A simple progress bar showing how close you are to the next discount tier.
- **Tier 1: Value Cards**: Three clean cards:
    - Your Monthly Price (The current bill)
    - Total Savings (The green number)
    - Active Referral Weight (The count)
- **Tier 3: The "How it Works" Section**: A simple 1-2-3 graphic (Network Volume -> Average Rate -> Your Saving).

### Phase 4: Verification
- Verify math remains accurate against backend `growth.js`.
- Check responsiveness.

## User Rules to Follow
- Purple Ban: No violet/purple.
- Clean Code: No over-engineering.
- Premium Design: Wow factor through simplicity, not loudness.
