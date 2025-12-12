const pool = require('../db');

async function cleanupOrphanedData() {
  try {
    console.log('🧹 Cleaning up orphaned data...\n');
    
    // Delete visits that reference non-existent patients
    const visitsResult = await pool.query(`
      DELETE FROM visits 
      WHERE patient_id NOT IN (SELECT id FROM patients)
    `);
    console.log(`   Deleted ${visitsResult.rowCount} orphaned visit(s)\n`);
    
    // Delete allergies that reference non-existent patients
    const allergiesResult = await pool.query(`
      DELETE FROM allergies 
      WHERE patient_id NOT IN (SELECT id FROM patients)
    `);
    console.log(`   Deleted ${allergiesResult.rowCount} orphaned allerg${allergiesResult.rowCount === 1 ? 'y' : 'ies'}\n`);
    
    // Delete medications that reference non-existent patients
    const medicationsResult = await pool.query(`
      DELETE FROM medications 
      WHERE patient_id NOT IN (SELECT id FROM patients)
    `);
    console.log(`   Deleted ${medicationsResult.rowCount} orphaned medication(s)\n`);
    
    // Delete problems that reference non-existent patients
    const problemsResult = await pool.query(`
      DELETE FROM problems 
      WHERE patient_id NOT IN (SELECT id FROM patients)
    `);
    console.log(`   Deleted ${problemsResult.rowCount} orphaned problem(s)\n`);
    
    // Delete documents that reference non-existent patients
    const documentsResult = await pool.query(`
      DELETE FROM documents 
      WHERE patient_id NOT IN (SELECT id FROM patients)
    `);
    console.log(`   Deleted ${documentsResult.rowCount} orphaned document(s)\n`);
    
    // Delete referrals that reference non-existent patients
    const referralsResult = await pool.query(`
      DELETE FROM referrals 
      WHERE patient_id NOT IN (SELECT id FROM patients)
    `);
    console.log(`   Deleted ${referralsResult.rowCount} orphaned referral(s)\n`);
    
    // Delete orders that reference non-existent patients
    const ordersResult = await pool.query(`
      DELETE FROM orders 
      WHERE patient_id NOT IN (SELECT id FROM patients)
    `);
    console.log(`   Deleted ${ordersResult.rowCount} orphaned order(s)\n`);
    
    // Delete messages that reference non-existent patients
    const messagesResult = await pool.query(`
      DELETE FROM messages 
      WHERE patient_id IS NOT NULL AND patient_id NOT IN (SELECT id FROM patients)
    `);
    console.log(`   Deleted ${messagesResult.rowCount} orphaned message(s)\n`);
    
    console.log('✅ Cleanup complete!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error cleaning up orphaned data:', error);
    console.error('Error details:', error.message);
    process.exit(1);
  }
}

cleanupOrphanedData();
























