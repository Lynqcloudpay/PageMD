/**
 * Phase 2 Database Migrations: READY State + Insurance Editing + Billing Notes
 * 
 * Run: node scripts/migrate-superbills-phase2.js
 */

const pool = require('../db'); // Use shared connection

async function migrate() {
    const client = await pool.connect();
    try {
        console.log('🔧 Starting Phase 2 migrations...\n');

        // 1. Update status constraint to include READY
        console.log('1️⃣ Adding READY status to superbills...');
        await client.query(`
            ALTER TABLE superbills 
            DROP CONSTRAINT IF EXISTS superbills_status_check;
            
            ALTER TABLE superbills 
            ADD CONSTRAINT superbills_status_check 
            CHECK (status IN ('DRAFT', 'READY', 'FINALIZED', 'VOID'));
        `);
        console.log('   ✅ Status constraint updated\n');

        // 2. Add insurance override fields
        console.log('2️⃣ Adding insurance override fields...');
        await client.query(`
            ALTER TABLE superbills
            ADD COLUMN IF NOT EXISTS insurance_provider_override VARCHAR(255),
            ADD COLUMN IF NOT EXISTS insurance_id_override VARCHAR(100),
            ADD COLUMN IF NOT EXISTS authorization_number VARCHAR(100);
        `);
        console.log('   ✅ Insurance fields added\n');

        // 3. Add billing notes and tracking fields
        console.log('3️⃣ Adding billing notes and claim tracking fields...');
        await client.query(`
            ALTER TABLE superbills
            ADD COLUMN IF NOT EXISTS billing_notes TEXT,
            ADD COLUMN IF NOT EXISTS denial_reason TEXT,
            ADD COLUMN IF NOT EXISTS resubmission_count INT DEFAULT 0,
            ADD COLUMN IF NOT EXISTS claim_status VARCHAR(20) CHECK (claim_status IN ('PENDING', 'SUBMITTED', 'PAID', 'DENIED', 'ADJUSTED')),
            ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP,
            ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP,
            ADD COLUMN IF NOT EXISTS paid_amount DECIMAL(10,2);
        `);
        console.log('   ✅ Billing tracking fields added\n');

        // 4. Add ready_at timestamp
        console.log('4️⃣ Adding ready_at timestamp...');
        await client.query(`
            ALTER TABLE superbills
            ADD COLUMN IF NOT EXISTS ready_at TIMESTAMP,
            ADD COLUMN IF NOT EXISTS ready_by UUID REFERENCES users(id);
        `);
        console.log('   ✅ Ready tracking added\n');

        // 5. Set default claim_status for existing finalized superbills
        console.log('5️⃣ Setting default claim status for existing superbills...');
        await client.query(`
            UPDATE superbills 
            SET claim_status = 'PENDING' 
            WHERE status = 'FINALIZED' AND claim_status IS NULL;
        `);
        console.log('   ✅ Default claim statuses set\n');

        console.log('🎉 Phase 2 migrations completed successfully!\n');
        console.log('New features enabled:');
        console.log('  - READY state workflow (DRAFT → READY → FINALIZED)');
        console.log('  - Insurance override fields (editable by billing)');
        console.log('  - Billing notes and denial tracking');
        console.log('  - Claim lifecycle tracking');
        console.log('');

    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        client.release();
        // Don't end shared pool
    }
}

migrate().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
