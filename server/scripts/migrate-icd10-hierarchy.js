const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'paper_emr',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function migrate() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // ICD-10 Hierarchy table - stores main diagnoses and their follow-up questions
    await client.query(`
      CREATE TABLE IF NOT EXISTS icd10_hierarchy (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        parent_code VARCHAR(20),
        parent_description TEXT,
        question_text TEXT NOT NULL,
        question_type VARCHAR(50) NOT NULL CHECK (question_type IN ('select', 'text', 'number', 'percentage', 'boolean')),
        question_order INTEGER NOT NULL DEFAULT 0,
        options JSONB, -- For select type questions: [{value: "I50.2", label: "Reduced EF", next_question: 2}, ...]
        validation_rules JSONB, -- {min: 0, max: 100, required: true, etc.}
        depends_on JSONB, -- Conditions for showing this question based on previous answers
        final_code_template TEXT, -- Template for building final ICD-10 code
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Index for efficient lookups
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_icd10_hierarchy_parent 
      ON icd10_hierarchy(parent_code) WHERE is_active = true
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_icd10_hierarchy_order 
      ON icd10_hierarchy(parent_code, question_order) WHERE is_active = true
    `);

    await client.query('COMMIT');
    console.log('✅ ICD-10 Hierarchy table created successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error creating ICD-10 hierarchy table:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run if called directly
if (require.main === module) {
  migrate()
    .then(() => {
      console.log('✅ Migration completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { migrate };

