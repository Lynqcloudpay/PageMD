const pool = require('./db');

async function migrate() {
    try {
        console.log('Adding outcome columns to sales_demos...');
        await pool.query(`
            ALTER TABLE sales_demos 
            ADD COLUMN IF NOT EXISTS outcome_category VARCHAR(50),
            ADD COLUMN IF NOT EXISTS outcome_notes TEXT,
            ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;
        `);
        console.log('Columns added successfully');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        process.exit();
    }
}

migrate();
