const pool = require('../db');
const bcrypt = require('bcryptjs');

async function setupSalesAuth() {
    try {
        console.log('🏗️  Setting up Sales Team Authentication...');

        // 1. Create table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS sales_team_users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                email VARCHAR(255),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                last_login TIMESTAMP WITH TIME ZONE
            );
        `);
        console.log('✅ Created sales_team_users table');

        // 2. Check if default user exists
        const checkUser = await pool.query(`SELECT * FROM sales_team_users WHERE username = 'admin'`);

        if (checkUser.rows.length === 0) {
            // 3. Create default admin user
            const defaultPassword = 'PageMD2026Sales!';
            const salt = await bcrypt.genSalt(10);
            const hash = await bcrypt.hash(defaultPassword, salt);

            await pool.query(`
                INSERT INTO sales_team_users (username, password_hash, email)
                VALUES ($1, $2, $3)
            `, ['admin', hash, 'pagemdemr@outlook.com']);

            console.log(`✅ Created default sales user: 'admin' with password: '${defaultPassword}'`);
        } else {
            console.log('ℹ️  Default admin user already exists');
        }

        console.log('🎉 Sales Auth Setup Complete!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error setting up sales auth:', error);
        process.exit(1);
    }
}

setupSalesAuth();
