# E-Prescribing & ICD-10/CPT Integration - Implementation Plan

## Overview

This document outlines the complete implementation plan for production-ready e-prescribing and enhanced ICD-10/CPT code search functionality in the Paper EMR system.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React)                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ E-Prescribe  │  │ ICD-10 Search│  │ CPT Search   │      │
│  │  Component   │  │  Component   │  │  Component   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTP/REST
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  Backend API (Express)                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Prescription │  │   Codes API  │  │  Validation  │      │
│  │   Routes     │  │   Routes     │  │   Services   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         │                  │                  │              │
│         └──────────────────┴──────────────────┘              │
│                            │                                 │
│                   ┌────────▼─────────┐                       │
│                   │ Service Layer    │                       │
│                   │ - RxNorm API     │                       │
│                   │ - Pharmacy Search│                       │
│                   │ - NPI/DEA Valid. │                       │
│                   └────────┬─────────┘                       │
└────────────────────────────┼─────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│              PostgreSQL Database                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │prescript.│ │pharmacies│ │icd10_codes│ │cpt_codes │       │
│  │  table   │ │  table   │ │  table   │ │  table   │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
│  ┌──────────┐ ┌──────────┐                                 │
│  │medication│ │audit_logs│                                 │
│  │_database │ │  table   │                                 │
│  └──────────┘ └──────────┘                                 │
└─────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│          External APIs (if available)                        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                    │
│  │ RxNorm   │ │  NCPDP   │ │  Surescr.│                    │
│  │   API    │ │ Registry │ │   API    │                    │
│  └──────────┘ └──────────┘ └──────────┘                    │
└─────────────────────────────────────────────────────────────┘
```

## Phase 1: Database Schema

### 1.1 E-Prescribing Tables

#### prescriptions table
- Stores all prescription records
- Links to patients, prescribers, pharmacies
- Tracks status and transmission

#### pharmacies table
- Pharmacy directory with NCPDP IDs
- Location and contact information
- Integration details

#### medication_database table
- RxNorm drug database cache
- Medication details, interactions
- FDA drug information

### 1.2 Enhanced Code Tables

#### icd10_codes table
- Full ICD-10 code set
- Hierarchical structure
- Searchable metadata

#### cpt_codes table
- Complete CPT code set
- Category and pricing
- Modifier support

## Phase 2: Backend Services

### 2.1 RxNorm Integration Service
- Medication search API
- Drug interaction checking
- Dose/formulation lookup

### 2.2 Pharmacy Search Service
- NCPDP directory search
- Location-based lookup
- Integration status

### 2.3 Validation Services
- NPI validation
- DEA number validation
- Controlled substance checks

## Phase 3: API Routes

### 3.1 Prescription Routes
- POST /api/prescriptions/create
- POST /api/prescriptions/send
- GET /api/prescriptions/patient/:id
- GET /api/prescriptions/:id

### 3.2 Medication Routes
- GET /api/medications/search
- GET /api/medications/interactions
- GET /api/medications/:rxcui

### 3.3 Pharmacy Routes
- GET /api/pharmacies/search
- GET /api/pharmacies/nearby
- GET /api/pharmacies/:id

### 3.4 Enhanced Code Routes
- GET /api/codes/icd10/search
- GET /api/codes/cpt/search
- POST /api/codes/icd10/import

## Phase 4: Frontend Components

### 4.1 E-Prescribe Component
- Medication search
- Sig builder
- Pharmacy selection
- Review and send

### 4.2 Code Search Components
- ICD-10 search modal
- CPT search modal
- Code attachment UI

## Phase 5: Security & Compliance

- HIPAA audit logging
- NPI/DEA validation
- Controlled substance tracking
- FHIR resource logging (if implemented)

## Implementation Files

1. `server/scripts/migrate-eprescribing.js` - Database migrations
2. `server/services/rxnorm.js` - RxNorm API service
3. `server/services/pharmacy.js` - Pharmacy search service
4. `server/services/validation.js` - NPI/DEA validation
5. `server/routes/prescriptions.js` - Prescription API routes
6. `server/routes/pharmacies.js` - Pharmacy API routes
7. `server/routes/medications.js` - Medication search routes
8. `client/src/components/EPrescribeEnhanced.jsx` - Enhanced e-prescribe UI
9. `client/src/components/CodeSearchModal.jsx` - ICD-10/CPT search
10. `client/src/utils/validation.js` - Client-side validation

## Next Steps

See individual file implementations below.






















