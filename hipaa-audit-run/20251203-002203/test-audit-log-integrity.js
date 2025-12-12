/**
 * Audit Log Integrity Test
 * 
 * Verifies audit logs are append-only and cannot be modified
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'paper_emr_test',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function testAuditLogIntegrity() {
  console.log('Testing audit log integrity...\n');
  const results = [];
  
  let testAuditLogId = null;
  
  try {
    // Test 1: Create an audit log entry
    console.log('1. Creating test audit log entry...');
    const insertResult = await pool.query(`
      INSERT INTO audit_logs (actor_user_id, action, target_type, target_id, outcome)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `, ['00000000-0000-0000-0000-000000000001', 'test.action', 'test', '00000000-0000-0000-0000-000000000002', 'success']);
    
    testAuditLogId = insertResult.rows[0].id;
    console.log(`   ✅ Created audit log entry: ${testAuditLogId}`);
    
    // Test 2: Attempt to UPDATE (should fail)
    console.log('\n2. Attempting to UPDATE audit log (should fail)...');
    try {
      await pool.query(`
        UPDATE audit_logs SET action = 'modified' WHERE id = $1
      `, [testAuditLogId]);
      
      results.push({
        test: 'prevent_update',
        pass: false,
        note: 'UPDATE was allowed - audit logs should be append-only!'
      });
      console.log('   ❌ UPDATE was allowed (should be blocked)');
    } catch (error) {
      const isBlocked = error.message.includes('append-only') || error.message.includes('cannot be modified');
      results.push({
        test: 'prevent_update',
        pass: isBlocked,
        note: isBlocked ? 'UPDATE correctly blocked' : `Unexpected error: ${error.message}`
      });
      console.log(`   ${isBlocked ? '✅' : '❌'} UPDATE ${isBlocked ? 'blocked' : 'error'}: ${error.message.substring(0, 100)}`);
    }
    
    // Test 3: Attempt to DELETE (should fail)
    console.log('\n3. Attempting to DELETE audit log (should fail)...');
    try {
      await pool.query(`
        DELETE FROM audit_logs WHERE id = $1
      `, [testAuditLogId]);
      
      results.push({
        test: 'prevent_delete',
        pass: false,
        note: 'DELETE was allowed - audit logs should be append-only!'
      });
      console.log('   ❌ DELETE was allowed (should be blocked)');
    } catch (error) {
      const isBlocked = error.message.includes('append-only') || error.message.includes('cannot be modified');
      results.push({
        test: 'prevent_delete',
        pass: isBlocked,
        note: isBlocked ? 'DELETE correctly blocked' : `Unexpected error: ${error.message}`
      });
      console.log(`   ${isBlocked ? '✅' : '❌'} DELETE ${isBlocked ? 'blocked' : 'error'}: ${error.message.substring(0, 100)}`);
    }
    
    // Test 4: Verify INSERT still works
    console.log('\n4. Verifying INSERT still works...');
    try {
      const insertResult2 = await pool.query(`
        INSERT INTO audit_logs (actor_user_id, action, target_type, target_id, outcome)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `, ['00000000-0000-0000-0000-000000000001', 'test.action2', 'test', '00000000-0000-0000-0000-000000000002', 'success']);
      
      results.push({
        test: 'allow_insert',
        pass: true,
        note: 'INSERT works correctly'
      });
      console.log('   ✅ INSERT works correctly');
      
      // Cleanup
      // Note: We can't DELETE, so we'll leave test entries (they're harmless)
    } catch (error) {
      results.push({
        test: 'allow_insert',
        pass: false,
        note: error.message
      });
      console.log(`   ❌ INSERT failed: ${error.message}`);
    }
    
    // Test 5: Check trigger exists
    console.log('\n5. Verifying append-only trigger exists...');
    try {
      const triggerResult = await pool.query(`
        SELECT trigger_name, event_manipulation, action_statement
        FROM information_schema.triggers
        WHERE event_object_table = 'audit_logs'
        AND (event_manipulation = 'UPDATE' OR event_manipulation = 'DELETE')
      `);
      
      const hasTrigger = triggerResult.rows.length > 0;
      results.push({
        test: 'trigger_exists',
        pass: hasTrigger,
        note: hasTrigger ? `Found ${triggerResult.rows.length} trigger(s)` : 'No append-only trigger found'
      });
      console.log(`   ${hasTrigger ? '✅' : '❌'} Trigger ${hasTrigger ? 'exists' : 'missing'}`);
    } catch (error) {
      results.push({
        test: 'trigger_exists',
        pass: false,
        note: error.message
      });
    }
    
  } catch (error) {
    console.error('Test error:', error);
    results.push({
      test: 'setup',
      pass: false,
      note: error.message
    });
  } finally {
    await pool.end();
  }
  
  const allPassed = results.every(r => r.pass);
  console.log(`\n${allPassed ? '✅' : '❌'} Audit log integrity tests: ${results.filter(r => r.pass).length}/${results.length} passed\n`);
  
  return results;
}

if (require.main === module) {
  testAuditLogIntegrity()
    .then(results => {
      const fs = require('fs');
      const path = require('path');
      const outputPath = path.join(__dirname, 'audit-log-integrity.out');
      fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
      process.exit(results.every(r => r.pass) ? 0 : 1);
    })
    .catch(error => {
      console.error('Test failed:', error);
      process.exit(1);
    });
}

module.exports = { testAuditLogIntegrity };





















