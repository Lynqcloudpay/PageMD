const pool = require('../db');
const PatientEventStore = require('../mother/PatientEventStore');
const ProjectionEngine = require('../mother/ProjectionEngine');
const TenantDb = require('../mother/TenantDb');

/**
 * npm run mother:rebuild-projections -- --clinic=<id> --patient=<id|all>
 */
async function rebuild() {
    const args = process.argv.slice(2);
    const clinicArg = args.find(a => a.startsWith('--clinic='))?.split('=')[1];
    const patientArg = args.find(a => a.startsWith('--patient='))?.split('=')[1];

    if (!clinicArg) {
        console.error('Usage: node scripts/rebuild-projections.js --clinic=<uuid> [--patient=<uuid|all>]');
        process.exit(1);
    }

    console.log(`🧹 Rebuilding projections for clinic: ${clinicArg}...`);

    await TenantDb.withTenantDb(clinicArg, async (client) => {
        // Clear existing projections
        let patientFilter = '';
        const params = [];
        if (patientArg && patientArg !== 'all') {
            patientFilter = ' AND patient_id = $1';
            params.push(patientArg);
        }

        console.log('  Clearing projection tables...');
        await client.query(`DELETE FROM patient_state_vitals_latest WHERE clinic_id = $1${patientFilter}`, [clinicArg, ...params]);
        await client.query(`DELETE FROM patient_state_medications WHERE clinic_id = $1${patientFilter}`, [clinicArg, ...params]);
        await client.query(`DELETE FROM patient_state_problems WHERE clinic_id = $1${patientFilter}`, [clinicArg, ...params]);
        await client.query(`DELETE FROM patient_state_orders_open WHERE clinic_id = $1${patientFilter}`, [clinicArg, ...params]);
        await client.query(`DELETE FROM patient_state_allergies WHERE clinic_id = $1${patientFilter}`, [clinicArg, ...params]);
        await client.query(`DELETE FROM patient_state_last_visit WHERE clinic_id = $1${patientFilter}`, [clinicArg, ...params]);

        // Replay events
        console.log('  Replaying events...');
        let eventsQuery = `SELECT * FROM patient_event WHERE clinic_id = $1`;
        if (patientArg && patientArg !== 'all') {
            eventsQuery += ` AND patient_id = $2`;
        }
        eventsQuery += ` ORDER BY occurred_at ASC, created_at ASC`;

        const eventsRes = await client.query(eventsQuery, [clinicArg, ...params]);
        console.log(`  Found ${eventsRes.rowCount} events to replay.`);

        for (const event of eventsRes.rows) {
            await ProjectionEngine.apply(client, event);
        }

        console.log('✅ Projections rebuilt successfully.');
    });

    await pool.end();
}

rebuild().catch(err => {
    console.error('❌ Rebuild failed:', err);
    process.exit(1);
});
