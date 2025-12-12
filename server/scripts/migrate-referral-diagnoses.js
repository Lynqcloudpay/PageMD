const pool = require('../db');

async function migrate() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('Creating referral_diagnoses table...');
    
    // Create referral_diagnoses table
    await client.query(`
      CREATE TABLE IF NOT EXISTS referral_diagnoses (
        referral_id UUID NOT NULL REFERENCES referrals(id) ON DELETE CASCADE,
        problem_id  UUID NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (referral_id, problem_id)
      )
    `);
    
    // Create index for faster lookups
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_referral_diagnoses_referral_id 
      ON referral_diagnoses(referral_id)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_referral_diagnoses_problem_id 
      ON referral_diagnoses(problem_id)
    `);
    
    await client.query('COMMIT');
    console.log('✅ Successfully created referral_diagnoses table');
    
    // Migrate existing data if any (from order_diagnoses where order_type = 'referral')
    console.log('Checking for existing referral diagnoses in order_diagnoses...');
    const existing = await client.query(`
      SELECT od.order_id, od.problem_id, od.created_at
      FROM order_diagnoses od
      WHERE od.order_type = 'referral'
        AND EXISTS (SELECT 1 FROM referrals r WHERE r.id = od.order_id)
    `);
    
    if (existing.rows.length > 0) {
      console.log(`Found ${existing.rows.length} existing referral diagnoses to migrate...`);
      await client.query('BEGIN');
      
      for (const row of existing.rows) {
        await client.query(`
          INSERT INTO referral_diagnoses (referral_id, problem_id, created_at)
          VALUES ($1, $2, $3)
          ON CONFLICT (referral_id, problem_id) DO NOTHING
        `, [row.order_id, row.problem_id, row.created_at]);
      }
      
      await client.query('COMMIT');
      console.log(`✅ Migrated ${existing.rows.length} referral diagnoses`);
    } else {
      console.log('No existing referral diagnoses found to migrate');
    }
    
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  migrate()
    .then(() => {
      console.log('Migration completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration error:', error);
      process.exit(1);
    });
}

module.exports = migrate;




