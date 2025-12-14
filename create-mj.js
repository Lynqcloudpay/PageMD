require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const email = 'mjrodriguez14@live.com';
  const password = 'password'; 
  const roleId = '244a431e-5604-403a-8562-0755ce7336af'; // Physician
  
  try {
    console.log('Generating hash...');
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    
    console.log('Checking if user exists...');
    const check = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    
    if (check.rows.length > 0) {
        console.log('User exists, updating password...');
        await pool.query('UPDATE users SET password_hash = $1, role_id = $2 WHERE email = $3', [hash, roleId, email]);
        console.log('✅ Updated existing user.');
    } else {
        console.log('Creating new user...');
        await pool.query(
            'INSERT INTO users (email, password_hash, first_name, last_name, role_id, role, status, active) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
            [email, hash, 'MJ', 'Rodriguez', roleId, 'clinician', 'active', true]
        );
        console.log('✅ Created user.');
    }
  } catch (err) {
    console.error('❌ Error:', err);
  } finally {
    pool.end();
  }
}

run();
