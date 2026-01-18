# Mother Patient System Architecture

The Mother Patient System is the single canonical source of truth for all patient-related data in PageMD EMR.

## Core Concepts

1. **Immutable Event Ledger (`patient_event`)**: Every clinical action (recording vitals, adding medications, signing notes) is recorded as an immutable event. This provides a full audit trail and enables data reconstruction.
2. **Current-State Projections (`patient_state_*`)**: Read-optimized tables derived from the event ledger. These provide fast access to the latest patient state (current meds, latest vitals, etc.).
3. **Unified Document Management (`patient_document`)**: All narrative data (visit notes, uploaded files, reports) is structured and stored with full-text search capabilities.

## Architecture Flow

- **Writes**: `MotherWriteService` → Transaction [Append Event → Apply Projection → Legacy table sync (transitional)]
- **Reads**: `MotherReadService` → [Query Projections / Event Ledger / Documents]
- **Projections**: Managed by `ProjectionEngine` which defines how state changes based on event types.

## Multi-Tenancy
All Mother services are tenant-aware using `clinic_id` and support optional schema isolation via `TenantDb.withTenantDb`.

## AI Integration
The system provides a dedicated `/api/mother/patient/:id/ai-context` endpoint that serves as the optimized data source for AI agents.
