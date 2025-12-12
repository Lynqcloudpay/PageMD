const { Pool } = require('pg');
const passwordService = require('../services/passwordService');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'paper_emr',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function resetPassword() {
  const email = process.argv[2];
  const newPassword = process.argv[3] || 'Test123!@#';
  
  if (!email) {
    console.error('Usage: node reset-user-password.js <email> [newPassword]');
    console.error('Example: node reset-user-password.js meljrodriguez14@gmail.com Test123!@#');
    process.exit(1);
  }
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Check if user exists
    const userResult = await client.query('SELECT id, email FROM users WHERE email = $1', [email]);
    
    if (userResult.rows.length === 0) {
      console.error(`❌ User with email ${email} not found`);
      await client.query('ROLLBACK');
      process.exit(1);
    }
    
    const user = userResult.rows[0];
    console.log(`✅ Found user: ${user.email} (ID: ${user.id})`);
    
    // Hash the new password
    console.log('🔐 Hashing new password...');
    const passwordHash = await passwordService.hashPassword(newPassword);
    
    // Update password
    await client.query('UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [
      passwordHash,
      user.id
    ]);
    
    await client.query('COMMIT');
    console.log(`✅ Password reset successfully for ${email}`);
    console.log(`📝 New password: ${newPassword}`);
    console.log('⚠️  Please change this password after logging in!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error resetting password:', error);
    throw error;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  resetPassword()
    .then(() => {
      console.log('✅ Password reset completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Password reset failed:', error);
      process.exit(1);
    });
}

module.exports = { resetPassword };



