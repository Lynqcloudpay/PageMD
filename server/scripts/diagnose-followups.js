/**
 * Diagnostic script to check and fix follow-ups
 */

const { Pool } = require('pg');

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    })
  : new Pool({
      host: process.env.DB_HOST || 'db',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'paper_emr',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
    });

async function diagnose() {
  const client = await pool.connect();
  
  try {
    console.log('=== Follow-ups Diagnostic ===\n');
    
    // 1. Check if tables exist
    console.log('1. Checking if tables exist...');
    const tablesCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('cancellation_followups', 'cancellation_followup_notes')
    `);
    
    const existingTables = tablesCheck.rows.map(r => r.table_name);
    console.log('   Existing tables:', existingTables);
    
    if (!existingTables.includes('cancellation_followups')) {
      console.log('   ❌ cancellation_followups table missing - creating...');
      await client.query(`
        CREATE TABLE cancellation_followups (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
          patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
          status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'addressed', 'dismissed')),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          addressed_at TIMESTAMP,
          addressed_by UUID REFERENCES users(id),
          dismissed_at TIMESTAMP,
          dismissed_by UUID REFERENCES users(id),
          dismiss_reason TEXT
        )
      `);
      console.log('   ✅ Created cancellation_followups table');
    }
    
    if (!existingTables.includes('cancellation_followup_notes')) {
      console.log('   ❌ cancellation_followup_notes table missing - creating...');
      await client.query(`
        CREATE TABLE cancellation_followup_notes (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          followup_id UUID NOT NULL REFERENCES cancellation_followups(id) ON DELETE CASCADE,
          note TEXT NOT NULL,
          note_type VARCHAR(30) DEFAULT 'general' CHECK (note_type IN ('general', 'call_attempt', 'rescheduled', 'dismissed', 'message_sent')),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          created_by UUID NOT NULL REFERENCES users(id),
          created_by_name VARCHAR(255)
        )
      `);
      console.log('   ✅ Created cancellation_followup_notes table');
    }
    
    // Create indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_followups_appointment_id ON cancellation_followups(appointment_id);
      CREATE INDEX IF NOT EXISTS idx_followups_patient_id ON cancellation_followups(patient_id);
      CREATE INDEX IF NOT EXISTS idx_followups_status ON cancellation_followups(status);
      CREATE INDEX IF NOT EXISTS idx_followup_notes_followup_id ON cancellation_followup_notes(followup_id);
    `);
    console.log('   ✅ Indexes created/verified\n');
    
    // 2. Check for cancelled/no_show appointments
    console.log('2. Checking for cancelled/no_show appointments...');
    const cancelledAppts = await client.query(`
      SELECT id, patient_id, appointment_date, patient_status, cancellation_reason
      FROM appointments
      WHERE patient_status IN ('cancelled', 'no_show')
      ORDER BY appointment_date DESC
      LIMIT 10
    `);
    console.log(`   Found ${cancelledAppts.rows.length} cancelled/no_show appointments`);
    cancelledAppts.rows.forEach(apt => {
      console.log(`   - ${apt.id}: ${apt.patient_status} on ${apt.appointment_date}`);
    });
    console.log('');
    
    // 3. Check existing follow-ups
    console.log('3. Checking existing follow-ups...');
    const existingFollowups = await client.query(`
      SELECT COUNT(*) as count FROM cancellation_followups
    `);
    console.log(`   Existing follow-ups: ${existingFollowups.rows[0].count}\n`);
    
    // 4. Create follow-ups for missing appointments
    console.log('4. Creating follow-ups for cancelled/no_show appointments...');
    let created = 0;
    for (const apt of cancelledAppts.rows) {
      const existing = await client.query(
        'SELECT id FROM cancellation_followups WHERE appointment_id = $1',
        [apt.id]
      );
      
      if (existing.rows.length === 0) {
        await client.query(
          `INSERT INTO cancellation_followups (appointment_id, patient_id, status)
           VALUES ($1, $2, 'pending')`,
          [apt.id, apt.patient_id]
        );
        created++;
        console.log(`   ✅ Created follow-up for appointment ${apt.id}`);
      } else {
        console.log(`   ⏭️  Follow-up already exists for appointment ${apt.id}`);
      }
    }
    console.log(`\n   Created ${created} new follow-ups\n`);
    
    // 5. Verify final state
    console.log('5. Final verification...');
    const finalStats = await client.query(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
        COUNT(*) FILTER (WHERE status = 'addressed') as addressed_count,
        COUNT(*) FILTER (WHERE status = 'dismissed') as dismissed_count,
        COUNT(*) as total_count
      FROM cancellation_followups
    `);
    console.log('   Stats:', finalStats.rows[0]);
    
    // Test the query that the API uses
    console.log('\n6. Testing API query...');
    const testQuery = await client.query(`
      SELECT 
        cf.*,
        a.appointment_date,
        a.appointment_time,
        a.appointment_type,
        a.patient_status as appointment_status,
        a.cancellation_reason,
        p.first_name as patient_first_name,
        p.last_name as patient_last_name
      FROM cancellation_followups cf
      JOIN appointments a ON cf.appointment_id = a.id
      JOIN patients p ON cf.patient_id = p.id
      WHERE cf.status = 'pending'
      ORDER BY cf.created_at DESC
      LIMIT 5
    `);
    console.log(`   Found ${testQuery.rows.length} pending follow-ups in test query`);
    testQuery.rows.forEach(f => {
      console.log(`   - ${f.patient_first_name} ${f.patient_last_name}: ${f.appointment_status}`);
    });
    
    console.log('\n✅ Diagnostic complete!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

diagnose()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Diagnostic failed:', error);
    process.exit(1);
  });

