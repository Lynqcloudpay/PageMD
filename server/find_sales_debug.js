const pool = require('./db');

async function find() {
    try {
        const res = await pool.query(`
            SELECT table_schema, table_name 
            FROM information_schema.tables 
            WHERE table_type = 'BASE TABLE'
            ORDER BY table_schema, table_name
        `);
        console.log('Total tables found:', res.rows.length);
        const grouped = res.rows.reduce((acc, row) => {
            if (!acc[row.table_schema]) acc[row.table_schema] = [];
            acc[row.table_schema].push(row.table_name);
            return acc;
        }, {});

        for (const [schema, tables] of Object.entries(grouped)) {
            console.log(`Schema: ${schema} (${tables.length} tables)`);
            if (tables.includes('sales_inquiries')) {
                console.log('  >>> FOUND sales_inquiries here!');
            }
        }
    } catch (err) {
        console.error('Find failed:', err);
    } finally {
        process.exit();
    }
}

find();
