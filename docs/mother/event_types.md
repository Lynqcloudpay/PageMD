# Mother Event Types (v1)

| Event Type | Description | Payload Schema |
|------------|-------------|----------------|
| `VITAL_RECORDED` | New vital signs recorded | `bp_systolic`, `bp_diastolic`, `heart_rate`, `recorded_at`, etc. |
| `MED_ADDED` | Medication added to chart | `medication_name`, `dosage`, `start_date`, etc. |
| `MED_CHANGED` | Medication dosage/freq updated | New medication details |
| `MED_STOPPED` | Medication marked inactive | `end_date`, `status = inactive` |
| `DX_ADDED` | New diagnosis added | `problem_name`, `icd10_code`, `onset_date` |
| `DX_RESOLVED` | Diagnosis marked resolved | `problem_id`, `resolution_date` |
| `ORDER_PLACED` | Diagnostic or therapeutic order | `order_type`, `description`, `status = pending` |
| `ORDER_RESULTED` | Order status updated to completed | `order_id`, `results`, `status = completed` |
| `DOCUMENT_CREATED` | New document record created | `document_id`, `doc_type`, `title` |
| `DOCUMENT_SIGNED` | Document finalized/signed | `document_id` |
| `BACKFILL` | Internal event for legacy migration | Varies |
