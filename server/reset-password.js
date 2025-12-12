const pool = require('./db');
const passwordService = require('./services/passwordService');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function resetPassword() {
  try {
    const email = 'meljrodriguez14@gmail.com';
    
    // Check if user exists
    const userResult = await pool.query('SELECT id, email FROM users WHERE email = $1', [email]);
    
    if (userResult.rows.length === 0) {
      console.log('❌ User not found!');
      process.exit(1);
    }
    
    const user = userResult.rows[0];
    console.log(`✅ Found user: ${user.email} (ID: ${user.id})`);
    
    // Ask for new password
    rl.question('Enter new password (min 8 characters): ', async (newPassword) => {
      if (newPassword.length < 8) {
        console.log('❌ Password must be at least 8 characters');
        rl.close();
        process.exit(1);
      }
      
      try {
        // Hash the new password
        console.log('Hashing password...');
        const passwordHash = await passwordService.hashPassword(newPassword);
        
        // Update user password
        await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, user.id]);
        
        console.log('✅ Password reset successfully!');
        console.log('You can now log in with:');
        console.log(`Email: ${email}`);
        console.log(`Password: [the password you just entered]`);
        
        rl.close();
        process.exit(0);
      } catch (error) {
        console.error('❌ Error resetting password:', error.message);
        rl.close();
        process.exit(1);
      }
    });
  } catch (error) {
    console.error('❌ Error:', error.message);
    rl.close();
    process.exit(1);
  }
}

resetPassword();


