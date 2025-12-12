const express = require('express');
const pool = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// Get all parent codes that have hierarchies (must come before /:code route)
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT DISTINCT parent_code, parent_description 
      FROM icd10_hierarchy 
      WHERE is_active = true
      ORDER BY parent_code
    `);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching ICD-10 hierarchy parents:', error);
    res.status(500).json({ error: 'Failed to fetch ICD-10 hierarchy parents' });
  }
});

// Get hierarchy questions for a parent ICD-10 code
router.get('/:code', async (req, res) => {
  try {
    const { code } = req.params;
    
    // Try to find hierarchy - first exact match, then try base code
    let parentCode = code;
    let hierarchyResult = await pool.query(`
      SELECT * FROM icd10_hierarchy 
      WHERE parent_code = $1 AND is_active = true
      ORDER BY question_order ASC
    `, [code]);
    
    // If no exact match, try base code (e.g., I50 for I50.1, I50.2, etc.)
    if (hierarchyResult.rows.length === 0) {
      const baseMatch = code.match(/^([A-Z]\d+)/);
      if (baseMatch) {
        const baseCode = baseMatch[1];
        hierarchyResult = await pool.query(`
          SELECT * FROM icd10_hierarchy 
          WHERE parent_code = $1 AND is_active = true
          ORDER BY question_order ASC
        `, [baseCode]);
        if (hierarchyResult.rows.length > 0) {
          parentCode = baseCode;
        }
      }
    }
    
    const result = hierarchyResult;
    
    // Parse JSONB fields
    const questions = result.rows.map(row => ({
      id: row.id,
      parent_code: row.parent_code,
      parent_description: row.parent_description,
      question_text: row.question_text,
      question_type: row.question_type,
      question_order: row.question_order,
      options: typeof row.options === 'string' ? JSON.parse(row.options) : row.options,
      depends_on: typeof row.depends_on === 'string' ? JSON.parse(row.depends_on) : row.depends_on,
      final_code_template: row.final_code_template,
      validation_rules: typeof row.validation_rules === 'string' ? JSON.parse(row.validation_rules) : row.validation_rules
    }));
    
    res.json({
      parent_code: parentCode,
      questions
    });
  } catch (error) {
    console.error('Error fetching ICD-10 hierarchy:', error);
    res.status(500).json({ error: 'Failed to fetch ICD-10 hierarchy' });
  }
});

module.exports = router;

