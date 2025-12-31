const pool = require('../db');

async function migrate() {
    const client = await pool.connect();
    try {
        console.log('Beginning Inbasket Migration...');
        await client.query('BEGIN');

        // 1. Inbox Items Table
        await client.query(`
      CREATE TABLE IF NOT EXISTS inbox_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID, -- Nullable for now if strict multi-tenancy not fully enforced yet
        patient_id UUID REFERENCES patients(id),
        
        type VARCHAR(50) NOT NULL, -- 'message', 'task', 'refill', 'lab', 'imaging', 'document'
        priority VARCHAR(20) DEFAULT 'normal',
        status VARCHAR(50) DEFAULT 'new', -- 'new', 'pending', 'completed'
        
        subject VARCHAR(255),
        body TEXT,
        
        -- Linking to external objects
        reference_id UUID,
        reference_table VARCHAR(50),
        
        -- Assignment
        assigned_user_id UUID REFERENCES users(id),
        assigned_role VARCHAR(50),
        
        -- Metadata
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP WITH TIME ZONE,
        completed_by UUID REFERENCES users(id)
      );
    `);

        // 2. Inbox Threads/Comments (for conversation history)
        await client.query(`
      CREATE TABLE IF NOT EXISTS inbox_notes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        item_id UUID REFERENCES inbox_items(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id),
        user_name VARCHAR(100),
        note TEXT NOT NULL,
        is_internal BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

        // 3. Indexes
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_inbox_assigned_user ON inbox_items(assigned_user_id) WHERE status != 'completed';
      CREATE INDEX IF NOT EXISTS idx_inbox_patient ON inbox_items(patient_id);
      CREATE INDEX IF NOT EXISTS idx_inbox_status ON inbox_items(status);
      CREATE INDEX IF NOT EXISTS idx_inbox_reference ON inbox_items(reference_id);
    `);

        console.log('Tables created successfully.');

        await client.query('COMMIT');
        console.log('Migration committed.');
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('Migration failed:', e);
    } finally {
        client.release();
        pool.end(); // Close pool to exit script
    }
}

migrate();
