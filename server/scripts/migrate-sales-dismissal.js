const pool = require('./db');

async function migrate() {
    try {
        console.log('Adding dismissal columns to sales_inquiries...');
        await pool.query(`
            ALTER TABLE sales_inquiries 
            ADD COLUMN IF NOT EXISTS dismissal_reason VARCHAR(50),
            ADD COLUMN IF NOT EXISTS dismissal_notes TEXT,
            ADD COLUMN IF NOT EXISTS dismissed_at TIMESTAMP WITH TIME ZONE,
            ADD COLUMN IF NOT EXISTS dismissed_by INTEGER;
        `);
        console.log('Columns added successfully');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        process.exit();
    }
}

migrate();
