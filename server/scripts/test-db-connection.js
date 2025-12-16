/**
 * Simple script to test database connection
 */

const { Pool } = require('pg');

console.log('=== Database Connection Test ===\n');

// Show environment
console.log('Environment variables:');
console.log('  DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET');
if (process.env.DATABASE_URL) {
  const masked = process.env.DATABASE_URL.replace(/:[^:@]+@/, ':****@');
  console.log('  Value:', masked);
}
console.log('  DB_HOST:', process.env.DB_HOST || 'NOT SET');
console.log('  DB_NAME:', process.env.DB_NAME || 'NOT SET');
console.log('  DB_USER:', process.env.DB_USER || 'NOT SET');
console.log('  NODE_ENV:', process.env.NODE_ENV || 'NOT SET');
console.log('');

// Create pool
let pool;
if (process.env.DATABASE_URL) {
  console.log('Creating pool with DATABASE_URL...');
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('localhost') || process.env.DATABASE_URL.includes('127.0.0.1')
      ? false
      : { rejectUnauthorized: false },
  });
} else {
  console.log('Creating pool with individual parameters...');
  pool = new Pool({
    host: process.env.DB_HOST || 'db',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'emr_db',
    user: process.env.DB_USER || 'emr_user',
    password: process.env.DB_PASSWORD || '',
  });
}

// Test connection
console.log('Attempting to connect...\n');
pool.connect()
  .then(async (client) => {
    try {
      console.log('✅ Connection successful!');
      const result = await client.query('SELECT version()');
      console.log('PostgreSQL version:', result.rows[0].version.split(' ')[0] + ' ' + result.rows[0].version.split(' ')[1]);
      client.release();
      await pool.end();
      process.exit(0);
    } catch (error) {
      client.release();
      throw error;
    }
  })
  .catch((error) => {
    console.error('❌ Connection failed!');
    console.error('Error:', error.message);
    console.error('Code:', error.code);
    console.error('Address:', error.address);
    console.error('Port:', error.port);
    process.exit(1);
  });

