// Debugging script to try and reproduce the error locally in the container
const pool = require('./db');

async function checkQuery() {
    try {
        console.log("Checking DB Connection...");
        const res = await pool.controlPool.query('SELECT NOW()');
        console.log("Connected at:", res.rows[0].now);

        console.log("Checking for billing_cycle column...");
        const tableInfo = await pool.controlPool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'clinic_subscriptions'
        `);
        console.log("Columns:", tableInfo.rows.map(r => r.column_name));

        console.log("Attempting the Failing Query...");
        const id = 'ab35d395-517c-4db3-9c0b-7519c710d7a8';
        const clinic = await pool.controlPool.query(`
            SELECT 
                c.*,
                cs.status as subscription_status,
                cs.billing_cycle,
                cs.current_period_start,
                cs.current_period_end,
                cs.trial_end_date,
                sp.name as plan_name,
                sp.price_monthly,
                sp.price_yearly
            FROM clinics c
            LEFT JOIN clinic_subscriptions cs ON c.id = cs.clinic_id
            LEFT JOIN subscription_plans sp ON cs.plan_id = sp.id
            WHERE c.id = $1
        `, [id]);

        console.log("Query Success! Rows:", clinic.rows.length);
    } catch (err) {
        console.error("Query Failed:", err);
    } finally {
        pool.end();
    }
}

checkQuery();
