const { Pool } = require('pg');
require('dotenv').config();

const config = process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'paper_emr',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
    };

const pool = new Pool(config);

async function syncSchema(client, schema) {
    console.log(`🛠️ Syncing Patient Flags for schema: ${schema}`);

    await client.query(`SET search_path TO ${schema}, public`);

    // 1. Create flag_types table
    await client.query(`
        CREATE TABLE IF NOT EXISTS flag_types (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
            label TEXT NOT NULL,
            category TEXT NOT NULL CHECK (category IN ('clinical', 'admin', 'safety')),
            severity TEXT NOT NULL CHECK (severity IN ('info', 'warn', 'critical')),
            color TEXT,
            requires_acknowledgment BOOLEAN DEFAULT FALSE,
            requires_expiration BOOLEAN DEFAULT FALSE,
            default_expiration_days INTEGER,
            is_default BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // 2. Create patient_flags table
    await client.query(`
        CREATE TABLE IF NOT EXISTS patient_flags (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
            patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
            flag_type_id UUID REFERENCES flag_types(id) ON DELETE CASCADE,
            custom_label TEXT,
            custom_severity TEXT CHECK (custom_severity IN ('info', 'warn', 'critical')),
            custom_color TEXT,
            note TEXT,
            status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'expired')),
            created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
            resolved_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
            expires_at TIMESTAMP WITH TIME ZONE,
            resolved_at TIMESTAMP WITH TIME ZONE,
            visibility TEXT DEFAULT 'staff_only',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // Add custom columns if they don't exist (for schemas where table already existed)
    await client.query(`
        ALTER TABLE patient_flags 
        ADD COLUMN IF NOT EXISTS custom_label TEXT,
        ADD COLUMN IF NOT EXISTS custom_severity TEXT CHECK (custom_severity IN ('info', 'warn', 'critical')),
        ADD COLUMN IF NOT EXISTS custom_color TEXT;
    `);

    // Allow flag_type_id to be NULL for custom flags
    await client.query(`ALTER TABLE patient_flags ALTER COLUMN flag_type_id DROP NOT NULL;`);

    // 3. Create patient_flag_acknowledgments table
    await client.query(`
        CREATE TABLE IF NOT EXISTS patient_flag_acknowledgments (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
            patient_flag_id UUID NOT NULL REFERENCES patient_flags(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            acknowledged_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(patient_flag_id, user_id)
        );
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_patient_flags_patient ON patient_flags(patient_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_patient_flags_clinic ON patient_flags(clinic_id)`);

    // 4. Seed default flag types if none exist
    const clinicResult = await client.query('SELECT id FROM clinics WHERE status = \'active\'');
    // Note: In a multi-tenant setup, clinics usually only has one record per schema (itself)
    // but we use the query to be safe.

    const defaultFlags = [
        { label: 'VIP', category: 'admin', severity: 'info', color: '#8b5cf6' },
        { label: 'High Risk', category: 'clinical', severity: 'warn', color: '#f59e0b' },
        { label: 'Fall Risk', category: 'clinical', severity: 'warn', color: '#f59e0b' },
        { label: 'Infection Precaution', category: 'clinical', severity: 'critical', color: '#ef4444' },
        { label: 'Allergy Alert', category: 'clinical', severity: 'critical', color: '#ef4444' },
        { label: 'Behavioral Alert', category: 'safety', severity: 'critical', color: '#ef4444', requires_acknowledgment: true },
        { label: 'Billing Hold', category: 'admin', severity: 'warn', color: '#f59e0b' },
        { label: 'Language Assistance', category: 'admin', severity: 'info', color: '#3b82f6' },
        { label: 'Security Risk', category: 'safety', severity: 'critical', color: '#ef4444', requires_acknowledgment: true }
    ];

    for (const clinic of clinicResult.rows) {
        const count = await client.query('SELECT COUNT(*) FROM flag_types WHERE clinic_id = $1', [clinic.id]);
        if (parseInt(count.rows[0].count) === 0) {
            console.log(`  Seeding default flags for clinic ${clinic.id}...`);
            for (const flag of defaultFlags) {
                await client.query(`
                    INSERT INTO flag_types (clinic_id, label, category, severity, color, requires_acknowledgment, is_default)
                    VALUES ($1, $2, $3, $4, $5, $6, TRUE)
                `, [clinic.id, flag.label, flag.category, flag.severity, flag.color, flag.requires_acknowledgment || false]);
            }
        }
    }

    console.log(`✅ Schema ${schema} synced successfully.`);
}

async function run() {
    const client = await pool.connect();
    try {
        const schemasResult = await client.query(`
            SELECT schema_name 
            FROM information_schema.schemata 
            WHERE schema_name LIKE 'tenant_%' OR schema_name = 'public'
        `);

        const schemas = schemasResult.rows.map(r => r.schema_name);
        console.log(`Found schemas: ${schemas.join(', ')}`);

        for (const schema of schemas) {
            try {
                await syncSchema(client, schema);
            } catch (err) {
                console.error(`❌ Failed to sync schema ${schema}:`, err.message);
            }
        }

        console.log('\n✨ All patient flags migrations completed.');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

run();
