const pool = require('../db');

async function fixDrift() {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // For handling self-signed certs in migrations if needed
    console.log('🔧 Starting Schema Drift Remediation...');

    const client = await pool.controlPool.connect();
    try {
        // 1. Get Active Tenants
        const res = await client.query("SELECT schema_name FROM clinics WHERE status = 'active'");
        const schemas = res.rows.map(r => r.schema_name);

        for (const schema of schemas) {
            console.log(`\nChecking Tenant: ${schema}...`);

            // REMEDIATION 1: cancellation_followups columns
            const t1 = await client.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_schema = $1 AND table_name = 'cancellation_followups'
            `, [schema]);

            const existingCols = t1.rows.map(r => r.column_name);

            if (!existingCols.includes('dismissed_by')) {
                console.log(`  - Adding missing column: dismissed_by to ${schema}.cancellation_followups`);
                await client.query(`ALTER TABLE ${schema}.cancellation_followups ADD COLUMN dismissed_by UUID REFERENCES ${schema}.users(id)`);
            }
            if (!existingCols.includes('dismissed_at')) {
                console.log(`  - Adding missing column: dismissed_at to ${schema}.cancellation_followups`);
                await client.query(`ALTER TABLE ${schema}.cancellation_followups ADD COLUMN dismissed_at TIMESTAMP`);
            }
            if (!existingCols.includes('dismiss_reason')) {
                console.log(`  - Adding missing column: dismiss_reason to ${schema}.cancellation_followups`);
                await client.query(`ALTER TABLE ${schema}.cancellation_followups ADD COLUMN dismiss_reason TEXT`);
            }

            // REMEDIATION 2: patients employment_status
            const t2 = await client.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_schema = $1 AND table_name = 'patients'
            `, [schema]);
            const patientCols = t2.rows.map(r => r.column_name);

            if (!patientCols.includes('employment_status')) {
                console.log(`  - Adding missing column: employment_status to ${schema}.patients`);
                await client.query(`ALTER TABLE ${schema}.patients ADD COLUMN employment_status VARCHAR(50)`);
            }
        }

        console.log('\n✅ Remediation Complete. Please run verification again.');

    } catch (err) {
        console.error('❌ Remediation Failed:', err);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

fixDrift();
