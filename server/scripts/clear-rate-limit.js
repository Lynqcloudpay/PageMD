/**
 * Clear Rate Limit for Login Attempts
 * 
 * This script clears failed login attempts from the database
 * to reset rate limiting for specific users or IPs.
 * 
 * Usage: 
 *   node scripts/clear-rate-limit.js <email>           # Clear for specific email
 *   node scripts/clear-rate-limit.js --ip <ip>         # Clear for specific IP
 *   node scripts/clear-rate-limit.js --all            # Clear all failed attempts
 */

const { Pool } = require('pg');
require('dotenv').config();

// Use DATABASE_URL if available (production/Docker), otherwise use individual env vars
const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes('localhost') || process.env.DATABASE_URL.includes('127.0.0.1')
        ? false
        : {
            rejectUnauthorized: false // Allow self-signed certificates
          },
    })
  : new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'paper_emr',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
    });

async function clearRateLimit(email, ipAddress, clearAll) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    let result;
    if (clearAll) {
      console.log('Clearing all failed login attempts...');
      result = await client.query(`
        DELETE FROM login_attempts
        WHERE success = false
      `);
      console.log(`✅ Cleared ${result.rowCount} failed login attempts`);
    } else if (ipAddress) {
      console.log(`Clearing failed login attempts for IP: ${ipAddress}...`);
      result = await client.query(`
        DELETE FROM login_attempts
        WHERE ip_address = $1 AND success = false
      `, [ipAddress]);
      console.log(`✅ Cleared ${result.rowCount} failed login attempts for IP ${ipAddress}`);
    } else if (email) {
      console.log(`Clearing failed login attempts for email: ${email}...`);
      result = await client.query(`
        DELETE FROM login_attempts
        WHERE email = $1 AND success = false
      `, [email]);
      console.log(`✅ Cleared ${result.rowCount} failed login attempts for ${email}`);
    } else {
      console.error('❌ Please provide an email, IP address, or use --all flag');
      process.exit(1);
    }

    await client.query('COMMIT');
    
    console.log('\n✅ Rate limit cleared successfully!');
    console.log('Note: If using in-memory rate limiting, you may need to restart the API server.');
    
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '42P01') {
      console.log('⚠️  Table login_attempts does not exist (rate limiting may use in-memory storage)');
      console.log('💡 Try restarting the API server to clear in-memory rate limits');
    } else {
      console.error('❌ Error clearing rate limit:', error);
    }
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
let email = null;
let ipAddress = null;
let clearAll = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--all') {
    clearAll = true;
  } else if (args[i] === '--ip' && args[i + 1]) {
    ipAddress = args[i + 1];
    i++;
  } else if (!email && !args[i].startsWith('--')) {
    email = args[i];
  }
}

if (!email && !ipAddress && !clearAll) {
  console.error('Usage:');
  console.error('  node scripts/clear-rate-limit.js <email>');
  console.error('  node scripts/clear-rate-limit.js --ip <ip_address>');
  console.error('  node scripts/clear-rate-limit.js --all');
  console.error('');
  console.error('Examples:');
  console.error('  node scripts/clear-rate-limit.js admin@clinic.com');
  console.error('  node scripts/clear-rate-limit.js --ip 192.168.1.100');
  console.error('  node scripts/clear-rate-limit.js --all');
  process.exit(1);
}

clearRateLimit(email, ipAddress, clearAll)
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  });




