
const pool = require('../db');

async function migrate() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        console.log('🚀 Starting Superbill Enhancements Migration...');

        // 1. Audit Logs Table
        console.log('Creating superbill_audit_logs table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS superbill_audit_logs (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                superbill_id UUID NOT NULL REFERENCES superbills(id) ON DELETE CASCADE,
                user_id UUID NOT NULL REFERENCES users(id),
                action VARCHAR(50) NOT NULL, -- 'CREATE', 'UPDATE', 'FINALIZE', 'VOID', 'REOPEN'
                changes JSONB, -- Stores { field: { old: val, new: val } }
                reason TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await client.query('CREATE INDEX IF NOT EXISTS idx_audit_superbill ON superbill_audit_logs(superbill_id)');


        // 2. Suggested Lines Table (Two-Line Concept)
        console.log('Creating superbill_suggested_lines table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS superbill_suggested_lines (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                superbill_id UUID NOT NULL REFERENCES superbills(id) ON DELETE CASCADE,
                source VARCHAR(50) NOT NULL, -- 'NOTE_ASSESSMENT', 'ORDER_LAB', 'ORDER_IMAGING', 'TEMPLATE'
                source_id UUID, -- ID of the order or note element if applicable
                cpt_code VARCHAR(10) NOT NULL,
                description TEXT,
                modifier1 VARCHAR(5),
                modifier2 VARCHAR(5),
                units INTEGER DEFAULT 1,
                charge DECIMAL(12, 2) DEFAULT 0.00,
                diagnosis_pointers VARCHAR(50),
                service_date DATE,
                status VARCHAR(20) DEFAULT 'PENDING', -- 'PENDING', 'ACCEPTED', 'REJECTED'
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await client.query('CREATE INDEX IF NOT EXISTS idx_suggested_lines_superbill ON superbill_suggested_lines(superbill_id)');


        // 3. Add Finalization Metadata to Superbills if missing
        console.log('Updating superbills table columns...');
        await client.query(`
            ALTER TABLE superbills 
            ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMP,
            ADD COLUMN IF NOT EXISTS finalized_by UUID REFERENCES users(id),
            ADD COLUMN IF NOT EXISTS voided_at TIMESTAMP,
            ADD COLUMN IF NOT EXISTS voided_by UUID REFERENCES users(id),
            ADD COLUMN IF NOT EXISTS void_reason TEXT
        `);

        await client.query('COMMIT');
        console.log('✅ Superbill enhancements migration completed successfully');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Migration failed:', error);
        process.exit(1);
    } finally {
        client.release();
    }
}

migrate();
