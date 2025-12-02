const express = require('express');
const pool = require('../db');
const { authenticate, requireRole, logAudit } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// ICD-10 code lookup - Enhanced with database support
router.get('/icd10', async (req, res) => {
  try {
    const { search, limit = 50 } = req.query;
    
    // First, try database if icd10_codes table exists
    try {
      const tableCheck = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'icd10_codes'
        );
      `);

      if (tableCheck.rows[0].exists && search) {
        // Use database search with full-text search
        const result = await pool.query(`
          SELECT code, description, billable, valid_for_submission
          FROM icd10_codes
          WHERE search_vector @@ plainto_tsquery('english', $1)
             OR code ILIKE $2
             OR description ILIKE $2
          ORDER BY ts_rank(search_vector, plainto_tsquery('english', $1)) DESC,
                   CASE WHEN code ILIKE $2 THEN 1 ELSE 2 END
          LIMIT $3
        `, [search, `%${search}%`, parseInt(limit)]);

        if (result.rows.length > 0) {
          return res.json(result.rows.map(row => ({
            code: row.code,
            description: row.description,
            billable: row.billable,
            valid: row.valid_for_submission
          })));
        }
      }
    } catch (dbError) {
      console.warn('Database search failed, using fallback:', dbError.message);
      // Fall through to hardcoded codes
    }
    
    // Fallback to hardcoded common codes
    const commonCodes = [
      // Diabetes
      { code: 'E11.9', description: 'Type 2 diabetes mellitus without complications' },
      { code: 'E11.65', description: 'Type 2 diabetes mellitus with hyperglycemia' },
      { code: 'E10.9', description: 'Type 1 diabetes mellitus without complications' },
      // Hypertension
      { code: 'I10', description: 'Essential (primary) hypertension' },
      { code: 'I11.9', description: 'Hypertensive heart disease without heart failure' },
      // Hyperlipidemia
      { code: 'E78.5', description: 'Hyperlipidemia, unspecified' },
      { code: 'E78.4', description: 'Other hyperlipidemia' },
      // Respiratory
      { code: 'J20.9', description: 'Acute bronchitis, unspecified' },
      { code: 'J06.9', description: 'Acute upper respiratory infection, unspecified' },
      { code: 'J44.9', description: 'Chronic obstructive pulmonary disease, unspecified' },
      { code: 'J18.9', description: 'Pneumonia, unspecified organism' },
      // Musculoskeletal
      { code: 'M79.3', description: 'Panniculitis, unspecified' },
      { code: 'M54.5', description: 'Low back pain' },
      { code: 'M25.511', description: 'Pain in right shoulder' },
      { code: 'M25.512', description: 'Pain in left shoulder' },
      // Symptoms
      { code: 'R50.9', description: 'Fever, unspecified' },
      { code: 'R06.02', description: 'Shortness of breath' },
      { code: 'R51', description: 'Headache' },
      { code: 'R53.83', description: 'Other fatigue' },
      { code: 'R10.9', description: 'Unspecified abdominal pain' },
      { code: 'R05.9', description: 'Cough, unspecified' },
      // Mental Health
      { code: 'F41.9', description: 'Anxiety disorder, unspecified' },
      { code: 'F32.9', description: 'Major depressive disorder, single episode, unspecified' },
      // Well visits
      { code: 'Z00.00', description: 'Encounter for general adult medical examination without abnormal findings' },
      { code: 'Z00.121', description: 'Encounter for routine child health examination with abnormal findings' },
      // Other common
      { code: 'K21.9', description: 'Gastro-esophageal reflux disease without esophagitis' },
      { code: 'N39.0', description: 'Urinary tract infection, site not specified' },
      { code: 'L70.9', description: 'Acne, unspecified' },
      { code: 'H52.13', description: 'Myopia, bilateral' },
      { code: 'Z51.11', description: 'Encounter for antineoplastic chemotherapy' },
    ];

    let results = commonCodes;
    if (search) {
      const searchLower = search.toLowerCase();
      results = commonCodes.filter(c => 
        c.code.toLowerCase().includes(searchLower) || 
        c.description.toLowerCase().includes(searchLower)
      );
    }

    res.json(results.slice(0, 50));
  } catch (error) {
    console.error('ICD-10 lookup error:', error);
    res.status(500).json({ error: 'Failed to lookup ICD-10 codes' });
  }
});

// CPT code lookup - Enhanced with database support
router.get('/cpt', async (req, res) => {
  try {
    const { search, limit = 50 } = req.query;
    
    // First, try database if cpt_codes table exists
    try {
      const tableCheck = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'cpt_codes'
        );
      `);

      if (tableCheck.rows[0].exists && search) {
        // Use database search with full-text search
        const result = await pool.query(`
          SELECT code, description, category, medicare_fee, active
          FROM cpt_codes
          WHERE search_vector @@ plainto_tsquery('english', $1)
             OR code ILIKE $2
             OR description ILIKE $2
          ORDER BY ts_rank(search_vector, plainto_tsquery('english', $1)) DESC,
                   CASE WHEN code ILIKE $2 THEN 1 ELSE 2 END
          LIMIT $3
        `, [search, `%${search}%`, parseInt(limit)]);

        if (result.rows.length > 0) {
          return res.json(result.rows.map(row => ({
            code: row.code,
            description: row.description,
            category: row.category,
            medicareFee: row.medicare_fee,
            active: row.active
          })));
        }
      }
    } catch (dbError) {
      console.warn('Database search failed, using fallback:', dbError.message);
      // Fall through to hardcoded codes
    }
    
    // Fallback to hardcoded common codes
    const commonCodes = [
      { code: '99213', description: 'Office or other outpatient visit, established patient' },
      { code: '99214', description: 'Office or other outpatient visit, established patient, detailed' },
      { code: '99215', description: 'Office or other outpatient visit, established patient, comprehensive' },
      { code: '99203', description: 'Office or other outpatient visit, new patient' },
      { code: '99204', description: 'Office or other outpatient visit, new patient, detailed' },
      { code: '99205', description: 'Office or other outpatient visit, new patient, comprehensive' },
      { code: '85025', description: 'Complete blood count (CBC)' },
      { code: '80053', description: 'Comprehensive metabolic panel' },
      { code: '80061', description: 'Lipid panel' },
    ];

    let results = commonCodes;
    if (search) {
      const searchLower = search.toLowerCase();
      results = commonCodes.filter(c => 
        c.code.toLowerCase().includes(searchLower) || 
        c.description.toLowerCase().includes(searchLower)
      );
    }

    res.json(results.slice(0, 50));
  } catch (error) {
    console.error('CPT lookup error:', error);
    res.status(500).json({ error: 'Failed to lookup CPT codes' });
  }
});

module.exports = router;


