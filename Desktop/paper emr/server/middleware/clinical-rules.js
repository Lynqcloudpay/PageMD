// Clinical Rules Engine - OpenEMR inspired
// Evaluates clinical rules and generates alerts

const pool = require('../db');

// Rule: Check for overdue lab results
const checkOverdueLabs = async (patientId) => {
  try {
    const overdueLabs = await pool.query(
      `SELECT o.*, v.visit_date
       FROM orders o
       JOIN visits v ON o.visit_id = v.id
       WHERE o.patient_id = $1
         AND o.order_type = 'lab'
         AND o.status = 'pending'
         AND v.visit_date < CURRENT_DATE - INTERVAL '7 days'`,
      [patientId]
    );

    return overdueLabs.rows.map(order => ({
      alertType: 'overdue_lab',
      severity: 'high',
      message: `Lab order from ${new Date(order.visit_date).toLocaleDateString()} is overdue`,
      ruleName: 'overdue_lab_check'
    }));
  } catch (error) {
    console.error('Error checking overdue labs:', error);
    return [];
  }
};

// Rule: Check for missing preventive care
const checkPreventiveCare = async (patientId) => {
  try {
    const patient = await pool.query(
      'SELECT dob, sex FROM patients WHERE id = $1',
      [patientId]
    );

    if (patient.rows.length === 0) return [];

    const dob = new Date(patient.rows[0].dob);
    const age = new Date().getFullYear() - dob.getFullYear();
    const alerts = [];

    // Mammogram reminder (women 40+)
    if (patient.rows[0].sex === 'F' && age >= 40) {
      const lastMammogram = await pool.query(
        `SELECT MAX(created_at) as last_date
         FROM orders
         WHERE patient_id = $1
           AND order_type = 'imaging'
           AND (order_payload::text ILIKE '%mammogram%' OR test_name ILIKE '%mammogram%')`,
        [patientId]
      );

      const lastDate = lastMammogram.rows[0]?.last_date;
      if (!lastDate || new Date(lastDate) < new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)) {
        alerts.push({
          alertType: 'preventive_care',
          severity: 'normal',
          message: 'Mammogram screening due (annual)',
          ruleName: 'mammogram_reminder'
        });
      }
    }

    return alerts;
  } catch (error) {
    console.error('Error checking preventive care:', error);
    return [];
  }
};

// Rule: Check for abnormal lab values
const checkAbnormalLabs = async (patientId) => {
  try {
    const abnormalLabs = await pool.query(
      `SELECT o.*, lrr.critical_low, lrr.critical_high
       FROM orders o
       LEFT JOIN lab_reference_ranges lrr ON o.test_code = lrr.test_code
       WHERE o.patient_id = $1
         AND o.order_type = 'lab'
         AND o.status = 'completed'
         AND o.result_value IS NOT NULL
         AND (
           (lrr.critical_low IS NOT NULL AND o.result_value::numeric < lrr.critical_low)
           OR (lrr.critical_high IS NOT NULL AND o.result_value::numeric > lrr.critical_high)
           OR o.abnormal_flags IS NOT NULL
         )
         AND o.completed_at > CURRENT_DATE - INTERVAL '30 days'`,
      [patientId]
    );

    return abnormalLabs.rows.map(order => ({
      alertType: 'abnormal_lab',
      severity: order.abnormal_flags?.includes('C') ? 'critical' : 'high',
      message: `Abnormal lab result: ${order.test_name} = ${order.result_value} ${order.result_units || ''}`,
      ruleName: 'abnormal_lab_check'
    }));
  } catch (error) {
    console.error('Error checking abnormal labs:', error);
    return [];
  }
};

// Run all clinical rules for a patient
const evaluateClinicalRules = async (patientId) => {
  const alerts = [];
  
  alerts.push(...await checkOverdueLabs(patientId));
  alerts.push(...await checkPreventiveCare(patientId));
  alerts.push(...await checkAbnormalLabs(patientId));
  
  return alerts;
};

// Auto-create alerts from rules
const autoCreateAlerts = async (patientId) => {
  try {
    const alerts = await evaluateClinicalRules(patientId);
    
    for (const alert of alerts) {
      // Check if alert already exists
      const existing = await pool.query(
        `SELECT id FROM clinical_alerts 
         WHERE patient_id = $1 
           AND alert_type = $2 
           AND rule_name = $3 
           AND active = true`,
        [patientId, alert.alertType, alert.ruleName]
      );

      if (existing.rows.length === 0) {
        await pool.query(
          `INSERT INTO clinical_alerts (patient_id, alert_type, severity, message, rule_name)
           VALUES ($1, $2, $3, $4, $5)`,
          [patientId, alert.alertType, alert.severity, alert.message, alert.ruleName]
        );
      }
    }
  } catch (error) {
    console.error('Error auto-creating alerts:', error);
  }
};

module.exports = {
  checkOverdueLabs,
  checkPreventiveCare,
  checkAbnormalLabs,
  evaluateClinicalRules,
  autoCreateAlerts
};

