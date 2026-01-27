const express = require('express');
const pool = require('../db');
const { authenticate, logAudit } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// FHIR R4 Patient Resource
router.get('/Patient/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM patients WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const patient = result.rows[0];

    // Convert to FHIR R4 Patient resource
    const fhirPatient = {
      resourceType: 'Patient',
      id: patient.id,
      identifier: [
        {
          use: 'usual',
          type: {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
                code: 'MR',
                display: 'Medical Record Number'
              }
            ]
          },
          value: patient.mrn
        }
      ],
      active: true,
      name: [
        {
          use: 'official',
          family: patient.last_name,
          given: [patient.first_name]
        }
      ],
      telecom: patient.phone ? [
        {
          system: 'phone',
          value: patient.phone,
          use: 'home'
        }
      ] : [],
      gender: patient.sex === 'M' ? 'male' : patient.sex === 'F' ? 'female' : 'other',
      birthDate: patient.dob,
      address: patient.address_line1 ? [
        {
          use: 'home',
          line: [patient.address_line1, patient.address_line2].filter(Boolean),
          city: patient.city,
          state: patient.state,
          postalCode: patient.zip,
          country: 'US'
        }
      ] : []
    };

    req.logAuditEvent({
      action: 'FHIR_PATIENT_READ',
      entityType: 'Patient',
      entityId: id,
      patientId: id
    });
    res.json(fhirPatient);
  } catch (error) {
    console.error('FHIR Patient error:', error);
    res.status(500).json({ error: 'Failed to fetch patient' });
  }
});

// FHIR R4 Observation (Labs/Vitals)
router.get('/Observation', async (req, res) => {
  try {
    const { patient, code } = req.query;

    let query = `
      SELECT o.*, v.visit_date, v.vitals
      FROM orders o
      LEFT JOIN visits v ON o.visit_id = v.id
      WHERE o.order_type = 'lab' AND o.patient_id = $1
    `;
    const params = [patient];

    if (code) {
      query += ` AND o.order_payload->>'loinc' = $2`;
      params.push(code);
    }

    query += ` ORDER BY o.created_at DESC LIMIT 100`;

    const result = await pool.query(query, params);

    const observations = result.rows.map(order => {
      const payload = typeof order.order_payload === 'string'
        ? JSON.parse(order.order_payload)
        : order.order_payload;

      return {
        resourceType: 'Observation',
        id: order.id,
        status: 'final',
        category: [
          {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                code: 'laboratory',
                display: 'Laboratory'
              }
            ]
          }
        ],
        code: {
          coding: [
            {
              system: 'http://loinc.org',
              code: payload.loinc || 'UNKNOWN',
              display: payload.test_name || 'Lab Test'
            }
          ]
        },
        subject: {
          reference: `Patient/${order.patient_id}`
        },
        effectiveDateTime: order.created_at,
        valueQuantity: payload.value ? {
          value: payload.value,
          unit: payload.unit || '',
          system: 'http://unitsofmeasure.org',
          code: payload.unit_code || ''
        } : undefined,
        interpretation: payload.flag ? [
          {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation',
                code: payload.flag === 'H' ? 'H' : payload.flag === 'L' ? 'L' : 'N',
                display: payload.flag === 'H' ? 'High' : payload.flag === 'L' ? 'Low' : 'Normal'
              }
            ]
          }
        ] : []
      };
    });

    req.logAuditEvent({
      action: 'FHIR_OBSERVATION_SEARCH',
      entityType: 'Patient',
      entityId: patient,
      patientId: patient,
      details: { code }
    });
    res.json({
      resourceType: 'Bundle',
      type: 'searchset',
      total: observations.length,
      entry: observations.map(obs => ({ resource: obs }))
    });
  } catch (error) {
    console.error('FHIR Observation error:', error);
    res.status(500).json({ error: 'Failed to fetch observations' });
  }
});

// FHIR R4 DiagnosticReport
router.get('/DiagnosticReport', async (req, res) => {
  try {
    const { patient } = req.query;

    const result = await pool.query(
      `SELECT d.*, v.visit_date
       FROM documents d
       LEFT JOIN visits v ON d.visit_id = v.id
       WHERE d.patient_id = $1 AND d.doc_type = 'lab'
       ORDER BY d.created_at DESC LIMIT 100`,
      [patient]
    );

    const reports = result.rows.map(doc => ({
      resourceType: 'DiagnosticReport',
      id: doc.id,
      status: 'final',
      category: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/v2-0074',
              code: 'LAB',
              display: 'Laboratory'
            }
          ]
        }
      ],
      code: {
        coding: [
          {
            system: 'http://loinc.org',
            code: '11502-2',
            display: 'Laboratory report'
          }
        ]
      },
      subject: {
        reference: `Patient/${doc.patient_id}`
      },
      effectiveDateTime: doc.created_at,
      issued: doc.created_at,
      performer: [
        {
          reference: `Practitioner/${doc.uploader_id}`
        }
      ],
      presentedForm: [
        {
          contentType: doc.mime_type || 'application/pdf',
          url: `/api/documents/${doc.id}/file`
        }
      ]
    }));

    req.logAuditEvent({
      action: 'FHIR_DIAGNOSTICREPORT_SEARCH',
      entityType: 'Patient',
      entityId: patient,
      patientId: patient
    });
    res.json({
      resourceType: 'Bundle',
      type: 'searchset',
      total: reports.length,
      entry: reports.map(rep => ({ resource: rep }))
    });
  } catch (error) {
    console.error('FHIR DiagnosticReport error:', error);
    res.status(500).json({ error: 'Failed to fetch diagnostic reports' });
  }
});

module.exports = router;

















