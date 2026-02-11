const pool = require('./db');

async function seedControl() {
    console.log('🌱 Seeding control database...');

    try {
        // 1. Ensure Sandbox Clinic exists
        const sandboxClinicId = '60456326-868d-4e21-942a-fd35190ed4fc';
        const check = await pool.controlPool.query('SELECT 1 FROM clinics WHERE id = $1', [sandboxClinicId]);

        if (check.rows.length === 0) {
            console.log('   Creating Sandbox Demo clinic record...');
            await pool.controlPool.query(`
                INSERT INTO clinics (id, slug, display_name, status, schema_name, is_read_only, billing_locked, prescribing_locked, enabled_features)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            `, [
                sandboxClinicId,
                'demo',
                'PageMD Sandbox Demo',
                'active',
                'public', // Placeholder
                false,
                false,
                false,
                JSON.stringify({ efax: true, labs: true, telehealth: true, eprescribe: true })
            ]);
            console.log('   ✅ Sandbox clinic created.');
        } else {
            console.log('   ✅ Sandbox clinic already exists.');
        }

        // 2. Add an Admin User (Optional, but good for stability)
        // Add more seeding here if needed.

        console.log('✅ Control database seeding complete.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Seeding failed:', error);
        process.exit(1);
    }
}

seedControl();
