
const pool = require('../db');

async function migrate() {
    const client = await pool.controlPool.connect();
    try {
        console.log('Starting migration: Seed default flag types');

        // Check if any default flags already exist
        const res = await client.query("SELECT COUNT(*) FROM flag_types WHERE is_default = true");
        const count = parseInt(res.rows[0].count);

        if (count === 0) {
            console.log('Seeding default flag types...');
            await client.query(`
                INSERT INTO flag_types (label, category, severity, is_default) 
                VALUES 
                    ('Critical Alert', 'clinical', 'critical', true), 
                    ('Admin Warning', 'admin', 'warn', true), 
                    ('Billing Hold', 'admin', 'warn', true), 
                    ('Safety Concern', 'safety', 'critical', true)
                ON CONFLICT DO NOTHING
            `);
            console.log('Seeding complete.');
        } else {
            console.log(`Default flag types already exist (${count}). Skipping seed.`);
        }

        console.log('Migration complete!');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        client.release();
        if (require.main === module) {
            process.exit();
        }
    }
}

if (require.main === module) {
    migrate();
}

module.exports = migrate;
