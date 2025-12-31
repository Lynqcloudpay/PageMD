const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'paper_emr',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
});

async function migrate() {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        console.log('Creating orders_catalog table...');
        await client.query(`
      CREATE TABLE IF NOT EXISTS orders_catalog (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        type VARCHAR(50) NOT NULL CHECK (type IN ('medication', 'lab', 'imaging', 'referral', 'other')),
        name VARCHAR(255) NOT NULL,
        code VARCHAR(50),
        code_type VARCHAR(20),
        description TEXT,
        instructions TEXT,
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

        console.log('Creating index for orders_catalog...');
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_orders_catalog_type ON orders_catalog(type);
      CREATE INDEX IF NOT EXISTS idx_orders_catalog_name ON orders_catalog(name);
    `);

        // Seed some initial data
        console.log('Seeding initial medication data...');
        const medications = [
            { name: 'Lisinopril', code: '314076', code_type: 'RxNorm', description: 'ACE Inhibitor' },
            { name: 'Metformin', code: '860975', code_type: 'RxNorm', description: 'Antidiabetic' },
            { name: 'Atorvastatin', code: '6918', code_type: 'RxNorm', description: 'Statin' },
            { name: 'Amlodipine', code: '17767', code_type: 'RxNorm', description: 'Calcium Channel Blocker' },
            { name: 'Levothyroxine', code: '10582', code_type: 'RxNorm', description: 'Thyroid Hormone' },
            { name: 'Omeprazole', code: '7646', code_type: 'RxNorm', description: 'PPI' },
            { name: 'Losartan', code: '52440', code_type: 'RxNorm', description: 'ARB' },
            { name: 'Gabapentin', code: '25480', code_type: 'RxNorm', description: 'Anticonvulsant' },
            { name: 'Hydrochlorothiazide', code: '5487', code_type: 'RxNorm', description: 'Diuretic' },
            { name: 'Sertraline', code: '36437', code_type: 'RxNorm', description: 'SSRI' }
        ];

        for (const med of medications) {
            await client.query(`
            INSERT INTO orders_catalog (type, name, code, code_type, description)
            VALUES ('medication', $1, $2, $3, $4)
            ON CONFLICT DO NOTHING
        `, [med.name, med.code, med.code_type, med.description]);
        }

        await client.query('COMMIT');
        console.log('✅ Migration completed successfully');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

migrate().catch(console.error);
