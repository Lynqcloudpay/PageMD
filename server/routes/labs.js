const express = require('express');
const pool = require('../db');
const { authenticate, logAudit, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// Get labs for patient
router.get('/patient/:patientId', async (req, res) => {
  try {
    const { patientId } = req.params;
    // For MVP, we'll return mock data or query from orders where order_type = 'lab'
    // In production, this would integrate with FHIR DiagnosticReport/Observation
    const result = await pool.query(
      `SELECT o.*, o.order_payload as lab_data
       FROM orders o
       WHERE o.patient_id = $1 AND o.order_type = 'lab'
       ORDER BY o.created_at DESC`,
      [patientId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching labs:', error);
    res.status(500).json({ error: 'Failed to fetch labs' });
  }
});

// Get lab trend history for a specific test
router.get('/trend/:patientId/:testName', requireRole('clinician', 'nurse', 'admin'), async (req, res) => {
  try {
    const { patientId, testName } = req.params;

    // Get all lab orders for this patient
    const labQuery = `
      SELECT o.*, 
             o.created_at as order_date
      FROM orders o
      WHERE o.patient_id = $1 AND o.order_type = 'lab'
      ORDER BY o.created_at DESC
    `;

    const labs = await pool.query(labQuery, [patientId]);

    // Extract values for the specific test from all labs
    const trendData = [];
    labs.rows.forEach(lab => {
      const payload = typeof lab.order_payload === 'string' ? JSON.parse(lab.order_payload) : lab.order_payload;
      if (!payload?.results) return;

      // Check if this lab contains the test we're looking for
      const results = payload.results;
      let testValue = null;
      let testUnit = null;
      let isAbnormal = false;

      if (Array.isArray(results)) {
        const testResult = results.find(r => {
          const name = (r.test || r.name || '').toLowerCase();
          return name.includes(testName.toLowerCase()) || testName.toLowerCase().includes(name);
        });
        if (testResult) {
          testValue = testResult.value || testResult.result;
          testUnit = testResult.unit || '';
          isAbnormal = testResult.flag && testResult.flag.toLowerCase() !== 'normal';
        }
      } else if (typeof results === 'object') {
        // Check if testName matches any key (case-insensitive)
        const testKey = Object.keys(results).find(key => {
          const formattedKey = key.replace(/([A-Z])/g, ' $1').toLowerCase();
          return formattedKey.includes(testName.toLowerCase()) || testName.toLowerCase().includes(formattedKey);
        });

        if (testKey) {
          const testResult = results[testKey];
          const isObject = typeof testResult === 'object' && testResult !== null;
          testValue = isObject ? (testResult.value || testResult.result) : testResult;
          testUnit = isObject ? (testResult.unit || '') : '';
          isAbnormal = isObject && testResult.flag && testResult.flag.toLowerCase() !== 'normal';
        }
      }

      if (testValue !== null && testValue !== undefined && testValue !== '') {
        trendData.push({
          date: lab.order_date,
          value: parseFloat(testValue) || testValue,
          unit: testUnit,
          isAbnormal: isAbnormal || payload.normal === false || payload.critical === true,
          testName: payload?.test_name || payload?.testName || 'Lab Test'
        });
      }
    });

    // Sort by date (oldest first for trend)
    trendData.sort((a, b) => new Date(a.date) - new Date(b.date));

    res.json(trendData);
  } catch (error) {
    console.error('Error fetching lab trend:', error);
    res.status(500).json({ error: 'Failed to fetch lab trend' });
  }
});

module.exports = router;

