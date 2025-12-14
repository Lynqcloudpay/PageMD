/**
 * Verify HIPAA Setup
 * 
 * Checks that all HIPAA security features are properly configured
 */

const pool = require('../db');
const redis = require('redis');
require('dotenv').config();

async function verifySetup() {
  console.log('🔍 Verifying HIPAA Security Setup...\n');
  
  let allChecksPassed = true;
  
  // 1. Check database tables
  console.log('1. Checking database tables...');
  try {
    const tables = [
      'roles', 'privileges', 'role_privileges',
      'audit_logs', 'user_mfa', 'sessions',
      'encryption_keys', 'patient_history', 'visit_history', 'note_history',
      'password_reset_tokens', 'login_attempts'
    ];
    
    for (const table of tables) {
      const result = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = $1
        )
      `, [table]);
      
      if (result.rows[0].exists) {
        console.log(`   ✅ ${table}`);
      } else {
        console.log(`   ❌ ${table} - MISSING`);
        allChecksPassed = false;
      }
    }
  } catch (error) {
    console.log(`   ❌ Database check failed: ${error.message}`);
    allChecksPassed = false;
  }
  
  // 2. Check roles
  console.log('\n2. Checking roles...');
  try {
    const result = await pool.query('SELECT name FROM roles ORDER BY name');
    const roleNames = result.rows.map(r => r.name);
    const requiredRoles = ['SuperAdmin', 'Admin', 'Physician', 'Nurse', 'Medical Assistant', 'Billing', 'ReadOnly'];
    
    for (const role of requiredRoles) {
      if (roleNames.includes(role)) {
        console.log(`   ✅ ${role}`);
      } else {
        console.log(`   ❌ ${role} - MISSING`);
        allChecksPassed = false;
      }
    }
  } catch (error) {
    console.log(`   ❌ Roles check failed: ${error.message}`);
    allChecksPassed = false;
  }
  
  // 3. Check privileges
  console.log('\n3. Checking privileges...');
  try {
    const result = await pool.query('SELECT COUNT(*) as count FROM privileges');
    const count = parseInt(result.rows[0].count);
    console.log(`   ✅ ${count} privileges defined`);
    
    if (count < 30) {
      console.log(`   ⚠️  Expected at least 30 privileges, found ${count}`);
    }
  } catch (error) {
    console.log(`   ❌ Privileges check failed: ${error.message}`);
    allChecksPassed = false;
  }
  
  // 4. Check audit logs structure
  console.log('\n4. Checking audit logs structure...');
  try {
    const result = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'audit_logs'
      ORDER BY column_name
    `);
    
    const columns = result.rows.map(r => r.column_name);
    const requiredColumns = [
      'actor_user_id', 'actor_ip', 'action', 'target_type', 
      'target_id', 'outcome', 'request_id', 'session_id'
    ];
    
    for (const col of requiredColumns) {
      if (columns.includes(col)) {
        console.log(`   ✅ ${col}`);
      } else {
        console.log(`   ❌ ${col} - MISSING`);
        allChecksPassed = false;
      }
    }
  } catch (error) {
    console.log(`   ❌ Audit logs check failed: ${error.message}`);
    allChecksPassed = false;
  }
  
  // 5. Check Redis connection
  console.log('\n5. Checking Redis connection...');
  try {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const client = redis.createClient({ url: redisUrl });
    
    await client.connect();
    await client.ping();
    await client.quit();
    
    console.log('   ✅ Redis connection successful');
  } catch (error) {
    console.log(`   ⚠️  Redis not available: ${error.message}`);
    console.log('   ℹ️  Redis is required for session management. Install and start Redis:');
    console.log('      brew install redis (macOS)');
    console.log('      redis-server');
  }
  
  // 6. Check environment variables
  console.log('\n6. Checking environment variables...');
  const requiredEnvVars = ['JWT_SECRET', 'DB_HOST', 'DB_NAME', 'DB_USER'];
  const optionalEnvVars = ['REDIS_URL', 'KMS_PROVIDER', 'BACKUP_DIR'];
  
  for (const envVar of requiredEnvVars) {
    if (process.env[envVar]) {
      console.log(`   ✅ ${envVar}`);
    } else {
      console.log(`   ❌ ${envVar} - NOT SET`);
      allChecksPassed = false;
    }
  }
  
  for (const envVar of optionalEnvVars) {
    if (process.env[envVar]) {
      console.log(`   ✅ ${envVar}`);
    } else {
      console.log(`   ⚠️  ${envVar} - Not set (optional)`);
    }
  }
  
  // 7. Check dependencies
  console.log('\n7. Checking dependencies...');
  const requiredDeps = ['argon2', 'otplib', 'qrcode', 'redis', 'express-session'];
  
  for (const dep of requiredDeps) {
    try {
      require.resolve(dep);
      console.log(`   ✅ ${dep}`);
    } catch (error) {
      console.log(`   ❌ ${dep} - NOT INSTALLED`);
      console.log(`      Run: npm install ${dep}`);
      allChecksPassed = false;
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(50));
  if (allChecksPassed) {
    console.log('✅ All critical checks passed!');
    console.log('\nHIPAA security features are properly configured.');
  } else {
    console.log('❌ Some checks failed. Please review the issues above.');
  }
  console.log('='.repeat(50));
  
  await pool.end();
  process.exit(allChecksPassed ? 0 : 1);
}

if (require.main === module) {
  verifySetup().catch((error) => {
    console.error('Verification failed:', error);
    process.exit(1);
  });
}

module.exports = { verifySetup };





