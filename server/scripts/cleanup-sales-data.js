const pool = require('../db');

async function cleanup() {
    console.log('🚀 Starting Sales Data Cleanup...');
    try {
        // Find all converted inquiries with non-completed demos
        const res = await pool.query(`
            SELECT DISTINCT i.id, i.name
            FROM sales_inquiries i
            JOIN sales_demos d ON i.id = d.inquiry_id
            WHERE i.status = 'converted' AND d.status != 'completed'
        `);

        console.log(`Found ${res.rows.length} inquiries with pending demos that should be completed.`);

        for (const row of res.rows) {
            console.log(`Auto-completing demos for: ${row.name} (ID: ${row.id})`);
            await pool.query(`
                UPDATE sales_demos 
                SET status = 'completed', 
                    outcome_category = 'converted',
                    outcome_notes = 'Auto-completed via cleanup (lead already converted)',
                    completed_at = NOW(),
                    updated_at = NOW()
                WHERE inquiry_id = $1 AND status != 'completed'
            `, [row.id]);
        }

        console.log('✅ Sales Data Cleanup complete!');
    } catch (err) {
        console.error('❌ Cleanup failed:', err);
    } finally {
        await pool.end();
    }
}

cleanup();
