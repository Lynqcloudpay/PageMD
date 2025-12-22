const pool = require('../db');

async function createOrdersetsTable() {
    const client = await pool.connect();
    try {
        console.log('🚀 Starting ordersets and favorites table creation...');

        // Create ordersets table
        await client.query(`
      CREATE TABLE IF NOT EXISTS ordersets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL UNIQUE,
        description TEXT,
        specialty VARCHAR(100) DEFAULT 'cardiology',
        category VARCHAR(100) DEFAULT 'general',
        orders JSONB NOT NULL DEFAULT '[]',
        tags TEXT[] DEFAULT '{}',
        created_by UUID REFERENCES users(id),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
        console.log('✅ ordersets table created or already exists');

        // Create favorites table if it doesn't exist
        await client.query(`
      CREATE TABLE IF NOT EXISTS favorites (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id),
        favorite_type VARCHAR(50) NOT NULL, -- 'orderset', 'lab', etc.
        favorite_id UUID NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, favorite_type, favorite_id)
      )
    `);
        console.log('✅ favorites table created or already exists');

        console.log('🎉 Migration completed successfully');
    } catch (err) {
        console.error('❌ Migration failed:', err);
    } finally {
        client.release();
        process.exit();
    }
}

createOrdersetsTable();
