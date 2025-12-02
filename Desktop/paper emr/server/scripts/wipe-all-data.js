const pool = require('../db');

async function wipeAllData() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('🧹 Wiping all mock data...\n');
    console.log('⚠️  This will delete ALL patient data, visits, and related records.\n');
    
    // Delete in order to respect foreign key constraints
    // Order matters - delete child tables before parent tables
    const deletions = [
      { table: 'claims', description: 'Claims' },
      { table: 'messages', description: 'Messages' },
      { table: 'orders', description: 'Orders' },
      { table: 'referrals', description: 'Referrals' },
      { table: 'documents', description: 'Documents' },
      { table: 'appointments', description: 'Appointments' },
      { table: 'alerts', description: 'Alerts' },
      { table: 'social_history', description: 'Social History' },
      { table: 'family_history', description: 'Family History' },
      { table: 'problems', description: 'Problems' },
      { table: 'medications', description: 'Medications' },
      { table: 'allergies', description: 'Allergies' },
      { table: 'visits', description: 'Visits' },
      { table: 'patients', description: 'Patients' },
      { table: 'audit_logs', description: 'Audit Logs' },
      { table: 'sessions', description: 'Sessions' }
    ];
    
    let totalDeleted = 0;
    
    // First, check which tables exist
    const tableCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      AND table_name NOT IN ('users')
    `);
    
    const existingTables = new Set(tableCheck.rows.map(row => row.table_name));
    
    for (const { table, description } of deletions) {
      if (!existingTables.has(table)) {
        console.log(`   ⏭️  Table '${table}' does not exist, skipping...`);
        continue;
      }
      
      try {
        const result = await client.query(`DELETE FROM ${table}`);
        const count = result.rowCount || 0;
        totalDeleted += count;
        if (count > 0) {
          console.log(`   ✅ Deleted ${count} ${description.toLowerCase()}`);
        } else {
          console.log(`   ✓ ${description} (already empty)`);
        }
      } catch (error) {
        console.log(`   ⚠️  Error deleting from '${table}': ${error.message}`);
        // Continue with other tables
      }
    }
    
    await client.query('COMMIT');
    
    console.log(`\n✅ Cleanup complete!`);
    console.log(`   Total records deleted: ${totalDeleted}`);
    console.log(`   ✅ Database schema and user accounts preserved`);
    console.log(`\n   Your EMR is now clean and ready for production use.`);
    
    process.exit(0);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error wiping data:', error);
    console.error('Error details:', error.message);
    process.exit(1);
  } finally {
    client.release();
  }
}

wipeAllData();

