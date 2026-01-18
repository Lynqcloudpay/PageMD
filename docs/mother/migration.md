# Migration to Mother Patient System

## Strategy: Phased Cutover with Shadow Writes

1. **Phase 1: Foundation (Current)**
   - Deploy schema.
   - Run backfill script to populate initial events and state.
   - Deploy AI Context endpoint using Mother.

2. **Phase 2: Shadow Writes**
   - Update core routes (Visits, Meds, Problems) to write to both legacy tables and Mother system within the same transaction.
   - Verify projection consistency.

3. **Phase 3: Final Cutover**
   - Point all READ services to MotherReadService.
   - Disable direct legacy table writes (enforce via linting/DB triggers).
   - Archive legacy tables or use them only for raw audit.

## Backfill Tools
- `node server/scripts/mother_migration/backfill_clinical_data.js`: Initial migration.
- `node server/scripts/rebuild-projections.js --clinic=<id>`: Re-derive state from event ledger.
