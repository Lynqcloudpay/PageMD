/**
 * Enhanced FHIR R4 API Router
 * 
 * Provides FHIR R4 compliant endpoints with:
 * - CapabilityStatement (metadata)
 * - Core resources: Patient, Practitioner, Organization, Location
 * - Clinical resources: Encounter, Observation, Condition, MedicationRequest
 * - Documents: DocumentReference, ServiceRequest
 * - SMART-style scope translation
 */

const express = require('express');
const pool = require('../db');
const { authenticate, logAudit } = require('../middleware/auth');
const { hybridAuth, requireScopes } = require('../middleware/oauthAuth');

const router = express.Router();

// FHIR base URL
const FHIR_BASE_URL = process.env.FHIR_BASE_URL || 'https://api.pagemdemr.com/fhir/R4';

/**
 * CapabilityStatement (metadata)
 * GET /fhir/R4/metadata
 */
router.get('/R4/metadata', (req, res) => {
    res.json({
        resourceType: 'CapabilityStatement',
        id: 'pagemdemr',
        url: `${FHIR_BASE_URL}/metadata`,
        version: '1.0.0',
        name: 'PageMDEMRCapabilityStatement',
        title: 'PageMD EMR FHIR R4 Capability Statement',
        status: 'active',
        experimental: false,
        date: new Date().toISOString(),
        publisher: 'PageMD',
        description: 'FHIR R4 API for PageMD Electronic Medical Records',
        kind: 'instance',
        software: {
            name: 'PageMD EMR',
            version: '1.0.0'
        },
        fhirVersion: '4.0.1',
        format: ['json'],
        rest: [{
            mode: 'server',
            security: {
                cors: true,
                service: [{
                    coding: [{
                        system: 'http://terminology.hl7.org/CodeSystem/restful-security-service',
                        code: 'SMART-on-FHIR',
                        display: 'SMART-on-FHIR'
                    }]
                }],
                description: 'OAuth 2.1 with SMART-on-FHIR scopes'
            },
            resource: [
                {
                    type: 'Patient',
                    profile: 'http://hl7.org/fhir/StructureDefinition/Patient',
                    interaction: [
                        { code: 'read' },
                        { code: 'search-type' }
                    ],
                    searchParam: [
                        { name: '_id', type: 'token' },
                        { name: 'identifier', type: 'token' },
                        { name: 'name', type: 'string' },
                        { name: 'birthdate', type: 'date' }
                    ]
                },
                {
                    type: 'Practitioner',
                    profile: 'http://hl7.org/fhir/StructureDefinition/Practitioner',
                    interaction: [{ code: 'read' }, { code: 'search-type' }]
                },
                {
                    type: 'Organization',
                    profile: 'http://hl7.org/fhir/StructureDefinition/Organization',
                    interaction: [{ code: 'read' }]
                },
                {
                    type: 'Location',
                    profile: 'http://hl7.org/fhir/StructureDefinition/Location',
                    interaction: [{ code: 'read' }, { code: 'search-type' }]
                },
                {
                    type: 'Encounter',
                    profile: 'http://hl7.org/fhir/StructureDefinition/Encounter',
                    interaction: [{ code: 'read' }, { code: 'search-type' }],
                    searchParam: [
                        { name: 'patient', type: 'reference' },
                        { name: 'date', type: 'date' },
                        { name: 'status', type: 'token' }
                    ]
                },
                {
                    type: 'Observation',
                    profile: 'http://hl7.org/fhir/StructureDefinition/Observation',
                    interaction: [{ code: 'read' }, { code: 'search-type' }],
                    searchParam: [
                        { name: 'patient', type: 'reference' },
                        { name: 'code', type: 'token' },
                        { name: 'category', type: 'token' }
                    ]
                },
                {
                    type: 'Condition',
                    profile: 'http://hl7.org/fhir/StructureDefinition/Condition',
                    interaction: [{ code: 'read' }, { code: 'search-type' }],
                    searchParam: [
                        { name: 'patient', type: 'reference' },
                        { name: 'clinical-status', type: 'token' }
                    ]
                },
                {
                    type: 'MedicationRequest',
                    profile: 'http://hl7.org/fhir/StructureDefinition/MedicationRequest',
                    interaction: [{ code: 'read' }, { code: 'search-type' }],
                    searchParam: [
                        { name: 'patient', type: 'reference' },
                        { name: 'status', type: 'token' }
                    ]
                },
                {
                    type: 'DocumentReference',
                    profile: 'http://hl7.org/fhir/StructureDefinition/DocumentReference',
                    interaction: [{ code: 'read' }, { code: 'search-type' }],
                    searchParam: [
                        { name: 'patient', type: 'reference' },
                        { name: 'type', type: 'token' }
                    ]
                },
                {
                    type: 'ServiceRequest',
                    profile: 'http://hl7.org/fhir/StructureDefinition/ServiceRequest',
                    interaction: [{ code: 'read' }, { code: 'search-type' }],
                    searchParam: [
                        { name: 'patient', type: 'reference' },
                        { name: 'status', type: 'token' }
                    ]
                },
                {
                    type: 'DiagnosticReport',
                    profile: 'http://hl7.org/fhir/StructureDefinition/DiagnosticReport',
                    interaction: [{ code: 'read' }, { code: 'search-type' }],
                    searchParam: [
                        { name: 'patient', type: 'reference' }
                    ]
                }
            ]
        }]
    });
});

// Apply hybrid auth for remaining endpoints
router.use('/R4', hybridAuth);

/**
 * FHIR OperationOutcome helper
 */
function operationOutcome(severity, code, diagnostics) {
    return {
        resourceType: 'OperationOutcome',
        issue: [{
            severity,
            code,
            diagnostics
        }]
    };
}

/**
 * FHIR Bundle helper
 */
function searchBundle(resources, total = null) {
    return {
        resourceType: 'Bundle',
        type: 'searchset',
        total: total ?? resources.length,
        entry: resources.map(resource => ({
            fullUrl: `${FHIR_BASE_URL}/${resource.resourceType}/${resource.id}`,
            resource
        }))
    };
}

// ============================================================================
// Patient Resource
// ============================================================================

router.get('/R4/Patient/:id', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM patients WHERE id = $1', [req.params.id]);

        if (result.rows.length === 0) {
            return res.status(404).json(operationOutcome('error', 'not-found', 'Patient not found'));
        }

        res.json(mapPatientToFHIR(result.rows[0]));
    } catch (error) {
        console.error('FHIR Patient read error:', error);
        res.status(500).json(operationOutcome('error', 'exception', 'Internal server error'));
    }
});

router.get('/R4/Patient', async (req, res) => {
    try {
        const { identifier, name, birthdate, _count = 20 } = req.query;
        let query = 'SELECT * FROM patients WHERE 1=1';
        const params = [];
        let paramIndex = 1;

        if (identifier) {
            query += ` AND mrn = $${paramIndex++}`;
            params.push(identifier);
        }
        if (name) {
            query += ` AND (first_name ILIKE $${paramIndex} OR last_name ILIKE $${paramIndex})`;
            params.push(`%${name}%`);
            paramIndex++;
        }
        if (birthdate) {
            query += ` AND dob = $${paramIndex++}`;
            params.push(birthdate);
        }

        query += ` ORDER BY last_name, first_name LIMIT $${paramIndex++}`;
        params.push(Math.min(parseInt(_count, 10), 100));

        const result = await pool.query(query, params);
        res.json(searchBundle(result.rows.map(mapPatientToFHIR)));
    } catch (error) {
        console.error('FHIR Patient search error:', error);
        res.status(500).json(operationOutcome('error', 'exception', 'Internal server error'));
    }
});

function mapPatientToFHIR(p) {
    return {
        resourceType: 'Patient',
        id: p.id,
        identifier: [{
            use: 'usual',
            type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v2-0203', code: 'MR' }] },
            value: p.mrn
        }],
        active: p.status !== 'inactive',
        name: [{
            use: 'official',
            family: p.last_name,
            given: [p.first_name, p.middle_name].filter(Boolean),
            suffix: p.suffix ? [p.suffix] : undefined
        }],
        telecom: [
            p.phone && { system: 'phone', value: p.phone, use: 'home' },
            p.email && { system: 'email', value: p.email }
        ].filter(Boolean),
        gender: { M: 'male', F: 'female', O: 'other', U: 'unknown' }[p.sex] || 'unknown',
        birthDate: p.dob,
        address: p.address_line1 ? [{
            use: 'home',
            line: [p.address_line1, p.address_line2].filter(Boolean),
            city: p.city,
            state: p.state,
            postalCode: p.zip,
            country: p.country || 'US'
        }] : [],
        communication: p.preferred_language ? [{
            language: { coding: [{ code: p.preferred_language }] },
            preferred: true
        }] : undefined
    };
}

// ============================================================================
// Practitioner Resource
// ============================================================================

router.get('/R4/Practitioner/:id', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT u.*, r.name as role_name FROM users u 
       LEFT JOIN roles r ON u.role_id = r.id 
       WHERE u.id = $1`,
            [req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json(operationOutcome('error', 'not-found', 'Practitioner not found'));
        }

        res.json(mapPractitionerToFHIR(result.rows[0]));
    } catch (error) {
        console.error('FHIR Practitioner read error:', error);
        res.status(500).json(operationOutcome('error', 'exception', 'Internal server error'));
    }
});

router.get('/R4/Practitioner', async (req, res) => {
    try {
        const { name, _count = 20 } = req.query;
        let query = `SELECT u.*, r.name as role_name FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE 1=1`;
        const params = [];
        let paramIndex = 1;

        if (name) {
            query += ` AND (u.first_name ILIKE $${paramIndex} OR u.last_name ILIKE $${paramIndex})`;
            params.push(`%${name}%`);
            paramIndex++;
        }

        query += ` ORDER BY u.last_name, u.first_name LIMIT $${paramIndex++}`;
        params.push(Math.min(parseInt(_count, 10), 100));

        const result = await pool.query(query, params);
        res.json(searchBundle(result.rows.map(mapPractitionerToFHIR)));
    } catch (error) {
        console.error('FHIR Practitioner search error:', error);
        res.status(500).json(operationOutcome('error', 'exception', 'Internal server error'));
    }
});

function mapPractitionerToFHIR(u) {
    return {
        resourceType: 'Practitioner',
        id: u.id,
        identifier: u.npi ? [{
            system: 'http://hl7.org/fhir/sid/us-npi',
            value: u.npi
        }] : [],
        active: u.status !== 'inactive',
        name: [{
            use: 'official',
            family: u.last_name,
            given: [u.first_name].filter(Boolean),
            prefix: u.credentials ? [u.credentials] : undefined
        }],
        telecom: [
            u.email && { system: 'email', value: u.email, use: 'work' }
        ].filter(Boolean),
        qualification: u.role_name ? [{
            code: { text: u.role_name }
        }] : undefined
    };
}

// ============================================================================
// Organization Resource
// ============================================================================

router.get('/R4/Organization/:id', async (req, res) => {
    try {
        const result = await pool.controlPool.query(
            'SELECT * FROM clinics WHERE id = $1',
            [req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json(operationOutcome('error', 'not-found', 'Organization not found'));
        }

        const c = result.rows[0];
        res.json({
            resourceType: 'Organization',
            id: c.id,
            identifier: c.npi ? [{
                system: 'http://hl7.org/fhir/sid/us-npi',
                value: c.npi
            }] : [],
            active: c.status === 'active',
            name: c.display_name || c.name,
            telecom: [
                c.phone && { system: 'phone', value: c.phone },
                c.fax && { system: 'fax', value: c.fax },
                c.email && { system: 'email', value: c.email }
            ].filter(Boolean),
            address: c.address_line1 ? [{
                line: [c.address_line1, c.address_line2].filter(Boolean),
                city: c.city,
                state: c.state,
                postalCode: c.zip
            }] : []
        });
    } catch (error) {
        console.error('FHIR Organization read error:', error);
        res.status(500).json(operationOutcome('error', 'exception', 'Internal server error'));
    }
});

// ============================================================================
// Location Resource
// ============================================================================

router.get('/R4/Location', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM locations ORDER BY name LIMIT 100');

        const locations = result.rows.map(l => ({
            resourceType: 'Location',
            id: l.id,
            status: l.active !== false ? 'active' : 'inactive',
            name: l.name,
            description: l.description,
            address: l.address_line1 ? {
                line: [l.address_line1, l.address_line2].filter(Boolean),
                city: l.city,
                state: l.state,
                postalCode: l.zip
            } : undefined,
            telecom: l.phone ? [{ system: 'phone', value: l.phone }] : undefined
        }));

        res.json(searchBundle(locations));
    } catch (error) {
        console.error('FHIR Location search error:', error);
        res.status(500).json(operationOutcome('error', 'exception', 'Internal server error'));
    }
});

// ============================================================================
// Encounter Resource
// ============================================================================

router.get('/R4/Encounter/:id', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT v.*, p.mrn, u.first_name as provider_first, u.last_name as provider_last
       FROM visits v
       LEFT JOIN patients p ON v.patient_id = p.id
       LEFT JOIN users u ON v.provider_id = u.id
       WHERE v.id = $1`,
            [req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json(operationOutcome('error', 'not-found', 'Encounter not found'));
        }

        res.json(mapEncounterToFHIR(result.rows[0]));
    } catch (error) {
        console.error('FHIR Encounter read error:', error);
        res.status(500).json(operationOutcome('error', 'exception', 'Internal server error'));
    }
});

router.get('/R4/Encounter', async (req, res) => {
    try {
        const { patient, date, status, _count = 20 } = req.query;
        let query = `
      SELECT v.*, u.first_name as provider_first, u.last_name as provider_last
      FROM visits v
      LEFT JOIN users u ON v.provider_id = u.id
      WHERE 1=1
    `;
        const params = [];
        let paramIndex = 1;

        if (patient) {
            query += ` AND v.patient_id = $${paramIndex++}`;
            params.push(patient);
        }
        if (date) {
            query += ` AND v.visit_date = $${paramIndex++}`;
            params.push(date);
        }
        if (status) {
            const statusMap = { 'finished': 'signed', 'in-progress': 'in_progress', 'planned': 'scheduled' };
            query += ` AND v.status = $${paramIndex++}`;
            params.push(statusMap[status] || status);
        }

        query += ` ORDER BY v.visit_date DESC LIMIT $${paramIndex++}`;
        params.push(Math.min(parseInt(_count, 10), 100));

        const result = await pool.query(query, params);
        res.json(searchBundle(result.rows.map(mapEncounterToFHIR)));
    } catch (error) {
        console.error('FHIR Encounter search error:', error);
        res.status(500).json(operationOutcome('error', 'exception', 'Internal server error'));
    }
});

function mapEncounterToFHIR(v) {
    const statusMap = { 'signed': 'finished', 'in_progress': 'in-progress', 'scheduled': 'planned', 'cancelled': 'cancelled' };
    return {
        resourceType: 'Encounter',
        id: v.id,
        status: statusMap[v.status] || 'unknown',
        class: {
            system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
            code: v.visit_type === 'telehealth' ? 'VR' : 'AMB',
            display: v.visit_type === 'telehealth' ? 'virtual' : 'ambulatory'
        },
        type: v.visit_type ? [{
            coding: [{ code: v.visit_type, display: v.visit_type }]
        }] : undefined,
        subject: { reference: `Patient/${v.patient_id}` },
        participant: v.provider_id ? [{
            individual: {
                reference: `Practitioner/${v.provider_id}`,
                display: `${v.provider_first || ''} ${v.provider_last || ''}`.trim()
            }
        }] : [],
        period: {
            start: v.visit_date ? `${v.visit_date}T${v.visit_time || '00:00:00'}` : undefined,
            end: v.signed_at
        },
        reasonCode: v.chief_complaint ? [{ text: v.chief_complaint }] : undefined
    };
}

// ============================================================================
// Condition Resource
// ============================================================================

router.get('/R4/Condition', async (req, res) => {
    try {
        const { patient, 'clinical-status': clinicalStatus, _count = 50 } = req.query;

        if (!patient) {
            return res.status(400).json(operationOutcome('error', 'required', 'patient parameter is required'));
        }

        let query = `SELECT * FROM problems WHERE patient_id = $1`;
        const params = [patient];
        let paramIndex = 2;

        if (clinicalStatus === 'active') {
            query += ` AND (status = 'active' OR resolved_date IS NULL)`;
        } else if (clinicalStatus === 'resolved') {
            query += ` AND resolved_date IS NOT NULL`;
        }

        query += ` ORDER BY onset_date DESC NULLS LAST LIMIT $${paramIndex++}`;
        params.push(Math.min(parseInt(_count, 10), 100));

        const result = await pool.query(query, params);

        const conditions = result.rows.map(p => ({
            resourceType: 'Condition',
            id: p.id,
            clinicalStatus: {
                coding: [{
                    system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
                    code: p.resolved_date ? 'resolved' : 'active'
                }]
            },
            category: [{
                coding: [{
                    system: 'http://terminology.hl7.org/CodeSystem/condition-category',
                    code: 'problem-list-item',
                    display: 'Problem List Item'
                }]
            }],
            code: {
                coding: p.icd10_code ? [{
                    system: 'http://hl7.org/fhir/sid/icd-10-cm',
                    code: p.icd10_code,
                    display: p.description
                }] : [],
                text: p.description
            },
            subject: { reference: `Patient/${p.patient_id}` },
            onsetDateTime: p.onset_date,
            abatementDateTime: p.resolved_date,
            note: p.notes ? [{ text: p.notes }] : undefined
        }));

        res.json(searchBundle(conditions));
    } catch (error) {
        console.error('FHIR Condition search error:', error);
        res.status(500).json(operationOutcome('error', 'exception', 'Internal server error'));
    }
});

// ============================================================================
// MedicationRequest Resource
// ============================================================================

router.get('/R4/MedicationRequest', async (req, res) => {
    try {
        const { patient, status, _count = 50 } = req.query;

        if (!patient) {
            return res.status(400).json(operationOutcome('error', 'required', 'patient parameter is required'));
        }

        let query = `SELECT * FROM prescriptions WHERE patient_id = $1`;
        const params = [patient];
        let paramIndex = 2;

        if (status) {
            const statusMap = { 'active': 'active', 'completed': 'completed', 'cancelled': 'cancelled' };
            query += ` AND status = $${paramIndex++}`;
            params.push(statusMap[status] || status);
        }

        query += ` ORDER BY created_at DESC LIMIT $${paramIndex++}`;
        params.push(Math.min(parseInt(_count, 10), 100));

        const result = await pool.query(query, params);

        const requests = result.rows.map(rx => ({
            resourceType: 'MedicationRequest',
            id: rx.id,
            status: rx.status || 'active',
            intent: 'order',
            medicationCodeableConcept: {
                coding: rx.rxnorm_code ? [{
                    system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
                    code: rx.rxnorm_code,
                    display: rx.medication_name
                }] : [],
                text: rx.medication_name
            },
            subject: { reference: `Patient/${rx.patient_id}` },
            authoredOn: rx.created_at,
            requester: rx.prescriber_id ? { reference: `Practitioner/${rx.prescriber_id}` } : undefined,
            dosageInstruction: rx.sig ? [{
                text: rx.sig,
                timing: rx.frequency ? { code: { text: rx.frequency } } : undefined,
                doseAndRate: rx.quantity ? [{
                    doseQuantity: {
                        value: parseFloat(rx.quantity) || undefined,
                        unit: rx.unit
                    }
                }] : undefined
            }] : undefined,
            dispenseRequest: {
                quantity: rx.dispense_quantity ? {
                    value: parseFloat(rx.dispense_quantity)
                } : undefined,
                numberOfRepeatsAllowed: rx.refills ? parseInt(rx.refills, 10) : undefined,
                expectedSupplyDuration: rx.days_supply ? {
                    value: parseInt(rx.days_supply, 10),
                    unit: 'days',
                    system: 'http://unitsofmeasure.org',
                    code: 'd'
                } : undefined
            }
        }));

        res.json(searchBundle(requests));
    } catch (error) {
        console.error('FHIR MedicationRequest search error:', error);
        res.status(500).json(operationOutcome('error', 'exception', 'Internal server error'));
    }
});

// ============================================================================
// DocumentReference Resource
// ============================================================================

router.get('/R4/DocumentReference', async (req, res) => {
    try {
        const { patient, type, _count = 50 } = req.query;

        if (!patient) {
            return res.status(400).json(operationOutcome('error', 'required', 'patient parameter is required'));
        }

        let query = `SELECT * FROM documents WHERE patient_id = $1`;
        const params = [patient];
        let paramIndex = 2;

        if (type) {
            query += ` AND doc_type = $${paramIndex++}`;
            params.push(type);
        }

        query += ` ORDER BY created_at DESC LIMIT $${paramIndex++}`;
        params.push(Math.min(parseInt(_count, 10), 100));

        const result = await pool.query(query, params);

        const refs = result.rows.map(d => ({
            resourceType: 'DocumentReference',
            id: d.id,
            status: 'current',
            type: {
                coding: [{
                    system: 'http://loinc.org',
                    code: d.loinc_code || '34133-9',
                    display: d.doc_type || 'Clinical Document'
                }],
                text: d.doc_type
            },
            subject: { reference: `Patient/${d.patient_id}` },
            date: d.created_at,
            description: d.title || d.filename,
            content: [{
                attachment: {
                    contentType: d.mime_type || 'application/pdf',
                    url: `/api/documents/${d.id}/file`,
                    title: d.filename
                }
            }],
            context: d.visit_id ? {
                encounter: [{ reference: `Encounter/${d.visit_id}` }]
            } : undefined
        }));

        res.json(searchBundle(refs));
    } catch (error) {
        console.error('FHIR DocumentReference search error:', error);
        res.status(500).json(operationOutcome('error', 'exception', 'Internal server error'));
    }
});

// ============================================================================
// ServiceRequest Resource (Orders)
// ============================================================================

router.get('/R4/ServiceRequest', async (req, res) => {
    try {
        const { patient, status, _count = 50 } = req.query;

        if (!patient) {
            return res.status(400).json(operationOutcome('error', 'required', 'patient parameter is required'));
        }

        let query = `SELECT * FROM orders WHERE patient_id = $1`;
        const params = [patient];
        let paramIndex = 2;

        if (status) {
            query += ` AND status = $${paramIndex++}`;
            params.push(status);
        }

        query += ` ORDER BY created_at DESC LIMIT $${paramIndex++}`;
        params.push(Math.min(parseInt(_count, 10), 100));

        const result = await pool.query(query, params);

        const requests = result.rows.map(o => ({
            resourceType: 'ServiceRequest',
            id: o.id,
            status: o.status || 'active',
            intent: 'order',
            category: [{
                coding: [{
                    code: o.order_type,
                    display: o.order_type
                }]
            }],
            code: {
                coding: o.cpt_code ? [{
                    system: 'http://www.ama-assn.org/go/cpt',
                    code: o.cpt_code,
                    display: o.order_name
                }] : [],
                text: o.order_name
            },
            subject: { reference: `Patient/${o.patient_id}` },
            encounter: o.visit_id ? { reference: `Encounter/${o.visit_id}` } : undefined,
            authoredOn: o.created_at,
            requester: o.ordering_provider_id ? { reference: `Practitioner/${o.ordering_provider_id}` } : undefined,
            note: o.instructions ? [{ text: o.instructions }] : undefined
        }));

        res.json(searchBundle(requests));
    } catch (error) {
        console.error('FHIR ServiceRequest search error:', error);
        res.status(500).json(operationOutcome('error', 'exception', 'Internal server error'));
    }
});

module.exports = router;
