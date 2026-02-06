const pool = require('./db');

async function migrate() {
    console.log('🚀 Starting Sales Schema Sync...');
    try {
        // Add demo_scheduled_at to sales_inquiries
        console.log('Adding demo_scheduled_at to sales_inquiries...');
        await pool.query(`
            ALTER TABLE sales_inquiries 
            ADD COLUMN IF NOT EXISTS demo_scheduled_at TIMESTAMP WITH TIME ZONE;
        `);

        // Add last_viewed_at to sales_inquiries
        console.log('Adding last_viewed_at to sales_inquiries...');
        await pool.query(`
            ALTER TABLE sales_inquiries 
            ADD COLUMN IF NOT EXISTS last_viewed_at TIMESTAMP WITH TIME ZONE;
        `);

        console.log('✅ Sales Schema Sync complete!');
    } catch (err) {
        console.error('❌ Migration failed:', err);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

migrate();
