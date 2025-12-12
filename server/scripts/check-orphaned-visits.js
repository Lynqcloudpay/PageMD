const pool = require('../db');

async function checkOrphanedVisits() {
  try {
    console.log('🔍 Checking for orphaned visits...\n');
    
    // Find visits without valid patients
    const result = await pool.query(`
      SELECT v.id, v.patient_id, v.visit_date, v.visit_type
      FROM visits v
      LEFT JOIN patients p ON v.patient_id = p.id
      WHERE p.id IS NULL
    `);
    
    if (result.rows.length > 0) {
      console.log(`Found ${result.rows.length} orphaned visit(s):\n`);
      result.rows.forEach(visit => {
        console.log(`  - Visit ID: ${visit.id}`);
        console.log(`    Patient ID: ${visit.patient_id}`);
        console.log(`    Visit Date: ${visit.visit_date}`);
        console.log(`    Visit Type: ${visit.visit_type}\n`);
      });
      
      // Delete them
      const deleteResult = await pool.query(`
        DELETE FROM visits 
        WHERE id IN (
          SELECT v.id
          FROM visits v
          LEFT JOIN patients p ON v.patient_id = p.id
          WHERE p.id IS NULL
        )
      `);
      console.log(`✅ Deleted ${deleteResult.rowCount} orphaned visit(s)`);
    } else {
      console.log('✅ No orphaned visits found');
    }
    
    // Also check total visits
    const totalVisits = await pool.query('SELECT COUNT(*) as count FROM visits');
    console.log(`\nTotal visits in database: ${totalVisits.rows[0].count}`);
    
    // Check visits with valid patients
    const validVisits = await pool.query(`
      SELECT COUNT(*) as count 
      FROM visits v
      INNER JOIN patients p ON v.patient_id = p.id
    `);
    console.log(`Visits with valid patients: ${validVisits.rows[0].count}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error checking orphaned visits:', error);
    console.error('Error details:', error.message);
    process.exit(1);
  }
}

checkOrphanedVisits();
























