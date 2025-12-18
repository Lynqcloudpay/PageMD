/**
 * Verify and fix privilege assignments for roles
 * 
 * This script checks if roles have the required privileges and adds them if missing
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes('localhost') || process.env.DATABASE_URL.includes('127.0.0.1')
        ? false
        : { rejectUnauthorized: false },
    })
  : new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'paper_emr',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
    });

async function verifyPrivileges() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    console.log('Checking privilege assignments...\n');

    // Check if required tables exist
    const tablesCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('roles', 'privileges', 'role_privileges')
    `);
    
    const existingTables = tablesCheck.rows.map(r => r.table_name);
    const requiredTables = ['roles', 'privileges', 'role_privileges'];
    const missingTables = requiredTables.filter(t => !existingTables.includes(t));
    
    if (missingTables.length > 0) {
      console.error('❌ Missing required database tables:', missingTables.join(', '));
      console.error('\nPlease run the following migrations first:');
      console.error('  1. node scripts/migrate-rbac.js (creates roles, privileges, role_privileges tables)');
      if (!existingTables.includes('privileges')) {
        console.error('  2. node scripts/migrate-hipaa-security.js (adds patient:* privileges)');
      }
      console.error('\nThen run this script again.\n');
      await client.query('ROLLBACK');
      process.exit(1);
    }

    // Get all roles
    const rolesResult = await client.query('SELECT id, name FROM roles ORDER BY name');
    const roles = {};
    rolesResult.rows.forEach(r => { roles[r.name] = r.id; });

    // Get all privileges
    const privResult = await client.query('SELECT id, name FROM privileges ORDER BY name');
    const privileges = {};
    privResult.rows.forEach(p => { privileges[p.name] = p.id; });

    console.log('Found roles:', Object.keys(roles).join(', '));
    console.log('Found privileges:', Object.keys(privileges).join(', '));
    console.log('');

    // Expected privilege assignments
    const expectedAssignments = {
      'Physician': ['patient:view', 'patient:edit', 'patient:create', 'patient:view_identifiers'],
      'Nurse': ['patient:view'],
      'Medical Assistant': ['patient:view'],
      'Front Desk': ['patient:view'],
      'Nurse Practitioner': ['patient:view', 'patient:edit', 'patient:create'],
      'Physician Assistant': ['patient:view', 'patient:edit', 'patient:create'],
    };

    let fixedCount = 0;

    for (const [roleName, expectedPrivs] of Object.entries(expectedAssignments)) {
      if (!roles[roleName]) {
        console.log(`⚠️  Role "${roleName}" not found in database`);
        continue;
      }

      console.log(`Checking ${roleName}...`);
      const roleId = roles[roleName];

      for (const privName of expectedPrivs) {
        if (!privileges[privName]) {
          console.log(`  ⚠️  Privilege "${privName}" not found in database`);
          continue;
        }

        // Check if assignment exists
        const checkResult = await client.query(
          `SELECT COUNT(*) as count FROM role_privileges 
           WHERE role_id = $1 AND privilege_id = $2`,
          [roleId, privileges[privName]]
        );

        if (parseInt(checkResult.rows[0].count) === 0) {
          console.log(`  ➕ Adding privilege "${privName}" to role "${roleName}"`);
          await client.query(
            `INSERT INTO role_privileges (role_id, privilege_id)
             VALUES ($1, $2)
             ON CONFLICT (role_id, privilege_id) DO NOTHING`,
            [roleId, privileges[privName]]
          );
          fixedCount++;
        } else {
          console.log(`  ✅ "${privName}" already assigned`);
        }
      }
      console.log('');
    }

    await client.query('COMMIT');

    if (fixedCount > 0) {
      console.log(`✅ Fixed ${fixedCount} missing privilege assignments!`);
    } else {
      console.log('✅ All privilege assignments are correct!');
    }

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

verifyPrivileges()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });






