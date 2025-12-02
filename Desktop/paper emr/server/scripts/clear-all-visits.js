const pool = require('../db');

async function clearAllVisits() {
  try {
    console.log('🗑️  Clearing all visits...\n');
    
    // Delete all visits
    const visitsResult = await pool.query('DELETE FROM visits');
    console.log(`   Deleted ${visitsResult.rowCount} visit(s)\n`);
    
    console.log('✅ All visits cleared!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error clearing visits:', error);
    console.error('Error details:', error.message);
    process.exit(1);
  }
}

clearAllVisits();


