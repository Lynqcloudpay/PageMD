const pool = require('./db');

async function migrate() {
    try {
        console.log('Starting migration...');

        // Add uuid column
        await pool.query(`
            ALTER TABLE sales_inquiries 
            ADD COLUMN IF NOT EXISTS uuid UUID DEFAULT gen_random_uuid();
        `);
        console.log('Added uuid column to sales_inquiries');

        // Add lead_info column (jsonb) for persistent profile data
        await pool.query(`
            ALTER TABLE sales_inquiries 
            ADD COLUMN IF NOT EXISTS lead_profile JSONB DEFAULT '{}';
        `);
        console.log('Added lead_profile column');

        // Ensure every row has a uuid
        await pool.query(`
            UPDATE sales_inquiries SET uuid = gen_random_uuid() WHERE uuid IS NULL;
        `);

        // Add last_activity_at column
        await pool.query(`
            ALTER TABLE sales_inquiries 
            ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        `);
        console.log('Migration complete');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        process.exit();
    }
}

migrate();
