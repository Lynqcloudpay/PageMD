const bcrypt = require('bcryptjs');
const pool = require('../db');

async function seedUsers() {
  try {
    const users = [
      {
        email: 'superadmin@clinic.com',
        password: 'SuperAdmin2025!',
        firstName: 'Super',
        lastName: 'Admin',
        role: 'SuperAdmin'
      },
      {
        email: 'doctor@clinic.com',
        password: 'Password123!',
        firstName: 'Dr.',
        lastName: 'Rodriguez',
        role: 'clinician'
      },
      {
        email: 'nurse@clinic.com',
        password: 'Password123!',
        firstName: 'Nurse',
        lastName: 'Smith',
        role: 'nurse'
      },
      {
        email: 'admin@clinic.com',
        password: 'Password123!',
        firstName: 'Admin',
        lastName: 'Johnson',
        role: 'admin'
      }
    ];

    console.log('🌱 Seeding users...\n');

    for (const user of users) {
      // Check if user already exists
      const existing = await pool.query('SELECT id FROM users WHERE email = $1', [user.email]);

      if (existing.rows.length > 0) {
        console.log(`ℹ️  User ${user.email} already exists, skipping...`);
        continue;
      }

      // Create user
      const passwordHash = await bcrypt.hash(user.password, 12);
      const result = await pool.query(
        `INSERT INTO users (email, password_hash, first_name, last_name, role, active)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, email, first_name, last_name, role`,
        [user.email, passwordHash, user.firstName, user.lastName, user.role, true]
      );

      console.log(`✅ Created ${user.role}:`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Password: ${user.password}`);
      console.log(`   Name: ${user.firstName} ${user.lastName}\n`);
    }

    console.log('✅ All users seeded successfully!');
    console.log('\n📋 Login Credentials:');
    console.log('   Doctor:  doctor@clinic.com / Password123!');
    console.log('   Nurse:   nurse@clinic.com / Password123!');
    console.log('   Admin:   admin@clinic.com / Password123!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding users:', error);
    process.exit(1);
  }
}

seedUsers();

