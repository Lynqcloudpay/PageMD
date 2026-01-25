const express = require('express');
const pool = require('../db');
const { authenticate, requireRole, logAudit } = require('../middleware/auth');
const { HL7Parser, HL7Generator } = require('../middleware/hl7');

const router = express.Router();

// Known lab facility identifiers
const LAB_FACILITIES = {
  'QUEST': { name: 'Quest Diagnostics', priority: 'normal' },
  'LABCORP': { name: 'LabCorp', priority: 'normal' },
  'QD': { name: 'Quest Diagnostics', priority: 'normal' },
  'LC': { name: 'LabCorp', priority: 'normal' }
};

/**
 * POST /api/hl7/receive
 * Receive HL7 message (lab results from Quest, LabCorp, etc.)
 * Creates order and inbox item for immediate visibility
 */
router.post('/receive', async (req, res) => {
  const startTime = Date.now();

  try {
    // Handle both raw text and JSON-wrapped messages
    let message = req.body;
    if (typeof message === 'object' && message.message) {
      message = message.message;
    }
    if (typeof message !== 'string') {
      // Try to get raw body
      message = req.rawBody || JSON.stringify(req.body);
    }

    if (typeof message !== 'string' || !message.includes('MSH|')) {
      console.warn('[HL7] Invalid message format received');
      return res.status(400).json({ error: 'Invalid HL7 message format' });
    }

    console.log('[HL7] Received message, length:', message.length);

    const parser = new HL7Parser(message);
    const parsed = parser.parse();

    // Identify sending facility
    const sendingFacility = parsed.messageType?.sendingFacility || 'UNKNOWN';
    const labInfo = LAB_FACILITIES[sendingFacility.toUpperCase()] || { name: sendingFacility, priority: 'normal' };

    console.log('[HL7] Processing message from:', labInfo.name, 'Type:', parsed.messageType?.messageType);

    // TENANT-SAFE: Look up tenant by facility ID
    let tenantId = 'default';
    try {
      const tenantLookup = await pool.query(
        'SELECT tenant_id FROM clinic_lab_interfaces WHERE facility_id = $1 AND status = $2',
        [sendingFacility, 'active']
      );
      if (tenantLookup.rows.length > 0) {
        tenantId = tenantLookup.rows[0].tenant_id;
        console.log('[HL7] Routed to tenant:', tenantId);
      }
    } catch (e) {
      console.error('[HL7] Tenant lookup error:', e.message);
    }

    // Process lab results (ORU^R01)
    if (parsed.messageType?.messageType === 'ORU^R01') {
      const patientMRN = parsed.patient?.patientId;

      if (!patientMRN) {
        console.warn('[HL7] No patient MRN in message');
        // Still send ACK but log warning
      } else {
        // Find patient by MRN
        // If we found a tenantId, we should search within that tenant's schema if possible
        // But since the current query is global (it doesn't set search_path), 
        // we'll rely on the patient being in the database and then use tenantId for the inbox item.
        const patient = await pool.query(
          'SELECT id FROM patients WHERE mrn = $1',
          [patientMRN]
        );

        if (patient.rows.length > 0) {
          const patientId = patient.rows[0].id;

          for (const result of parsed.results || []) {
            // Store lab result in orders table
            const orderResult = await pool.query(
              `INSERT INTO orders (
                patient_id, order_type, test_name, result_value, result_units, 
                reference_range, status, completed_at, external_id, 
                order_payload
              )
              VALUES ($1, 'lab', $2, $3, $4, $5, 'completed', CURRENT_TIMESTAMP, $6, $7)
              RETURNING id`,
              [
                patientId,
                result.observationId || result.testName || 'Lab Result',
                result.observationValue,
                result.units,
                result.referenceRange,
                parsed.messageType.messageControlId,
                JSON.stringify({
                  source: labInfo.name,
                  test_name: result.observationId,
                  abnormal_flag: result.abnormalFlag,
                  observation_date: result.observationDate
                })
              ]
            );

            const orderId = orderResult.rows[0].id;

            // Create inbox item for immediate visibility
            const isAbnormal = result.abnormalFlag && result.abnormalFlag !== 'N';
            await pool.query(
              `INSERT INTO inbox_items (
                id, tenant_id, patient_id, type, priority, status,
                subject, body, reference_id, reference_table,
                created_at, updated_at
              ) VALUES (
                gen_random_uuid(), $1, $2, 'lab', $3, 'new',
                $4, $5, $6, 'orders',
                CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
              )
              ON CONFLICT (reference_id, reference_table) WHERE status != 'completed' DO NOTHING`,
              [
                tenantId,
                patientId,
                isAbnormal ? 'stat' : 'normal',
                `${isAbnormal ? '⚠️ ' : ''}${result.observationId || 'Lab Result'} from ${labInfo.name}`,
                `Result: ${result.observationValue} ${result.units || ''} (Ref: ${result.referenceRange || 'N/A'})`,
                orderId
              ]
            );

            console.log('[HL7] Created order and inbox item:', { orderId, patientId, test: result.observationId, tenantId });
          }
        } else {
          console.warn('[HL7] Patient not found for MRN:', patientMRN);
          // Could create unmatched lab queue here
        }
      }
    }

    // Send HL7 ACK
    const ack = `MSH|^~\\&|EMR|CLINIC|${sendingFacility}|LAB|${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}||ACK|ACK${Date.now()}|P|2.5\rMSA|AA|${parsed.messageType?.messageControlId || 'MSG001'}\r`;

    console.log('[HL7] Processed in', Date.now() - startTime, 'ms');

    res.set('Content-Type', 'text/plain');
    res.send(ack);
  } catch (error) {
    console.error('[HL7] Error processing message:', error);

    // Send NACK for errors
    const nack = `MSH|^~\\&|EMR|CLINIC|LAB|FACILITY|${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}||ACK|ACK${Date.now()}|P|2.5\rMSA|AE|ERROR|${error.message}\r`;
    res.set('Content-Type', 'text/plain');
    res.status(500).send(nack);
  }
});

/**
 * GET /api/hl7/status
 * Check HL7 interface status
 */
router.get('/status', authenticate, async (req, res) => {
  try {
    // Count recent labs received via HL7
    const stats = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '24 hours') as last_24h,
        COUNT(*) FILTER (WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '7 days') as last_7d,
        MAX(created_at) as last_received
      FROM orders 
      WHERE external_id IS NOT NULL
    `);

    res.json({
      endpoint: '/api/hl7/receive',
      supportedMessages: ['ORU^R01'],
      knownFacilities: Object.keys(LAB_FACILITIES),
      stats: stats.rows[0] || {}
    });
  } catch (error) {
    console.error('[HL7] Error getting status:', error);
    res.status(500).json({ error: 'Failed to get HL7 status' });
  }
});

// Send HL7 message (order)
router.post('/send', authenticate, requireRole('clinician'), async (req, res) => {
  try {
    const { orderId } = req.body;

    const order = await pool.query(
      `SELECT o.*, p.mrn, p.first_name, p.last_name, p.dob, p.sex
       FROM orders o
       JOIN patients p ON o.patient_id = p.id
       WHERE o.id = $1`,
      [orderId]
    );

    if (order.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const ord = order.rows[0];
    const hl7Message = HL7Generator.generateORU({
      patientId: ord.mrn,
      lastName: ord.last_name,
      firstName: ord.first_name,
      dob: ord.dob,
      sex: ord.sex,
      orderId: ord.id,
      testCode: ord.test_name,
      testName: ord.test_name,
      value: ord.result_value,
      units: ord.result_units,
      referenceRange: ord.reference_range,
      collectedDate: ord.completed_at
    });

    await logAudit(req.user.id, 'send_hl7', 'order', orderId, {}, req.ip);

    res.set('Content-Type', 'text/plain');
    res.send(hl7Message);
  } catch (error) {
    console.error('Error generating HL7 message:', error);
    res.status(500).json({ error: 'Failed to generate HL7 message' });
  }
});

module.exports = router;

















