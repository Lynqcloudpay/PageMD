const express = require('express');
const pool = require('../db');
const { authenticate, requireRole, logAudit } = require('../middleware/auth');
const { HL7Parser, HL7Generator } = require('../middleware/hl7');

const router = express.Router();

// Receive HL7 message (lab results, etc.)
router.post('/receive', async (req, res) => {
  try {
    const message = req.body.message || req.body;
    
    if (typeof message !== 'string') {
      return res.status(400).json({ error: 'Invalid HL7 message format' });
    }

    const parser = new HL7Parser(message);
    const parsed = parser.parse();

    // Process lab results
    if (parsed.messageType?.messageType === 'ORU^R01') {
      for (const result of parsed.results) {
        // Find patient by MRN or create order
        const patient = await pool.query(
          'SELECT id FROM patients WHERE mrn = $1',
          [parsed.patient.patientId]
        );

        if (patient.rows.length > 0) {
          // Store lab result
          await pool.query(
            `INSERT INTO orders (patient_id, order_type, test_name, result_value, result_units, 
             reference_range, status, completed_at, external_id)
             VALUES ($1, 'Lab', $2, $3, $4, $5, 'completed', CURRENT_TIMESTAMP, $6)`,
            [
              patient.rows[0].id,
              result.observationId,
              result.observationValue,
              result.units,
              result.referenceRange,
              parsed.messageType.messageControlId
            ]
          );
        }
      }
    }

    // Send ACK
    const ack = `MSH|^~\\&|EMR|CLINIC|LAB|FACILITY|${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}||ACK|ACK001|P|2.5\rMSA|AA|${parsed.messageType?.messageControlId || 'MSG001'}\r`;
    
    res.set('Content-Type', 'text/plain');
    res.send(ack);
  } catch (error) {
    console.error('Error processing HL7 message:', error);
    res.status(500).json({ error: 'Failed to process HL7 message' });
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

















