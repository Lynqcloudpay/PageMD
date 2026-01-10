const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/paper_emr'
});

async function migrate() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

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
                flag_type_id UUID NOT NULL REFERENCES flag_types(id) ON DELETE CASCADE,
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

        // 4. Update audit_logs table (if needed, but usually it's just raw inserts)
        // Ensure clinic_id index exists on patient_flags
        await client.query(`CREATE INDEX IF NOT EXISTS idx_patient_flags_patient ON patient_flags(patient_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_patient_flags_clinic ON patient_flags(clinic_id)`);

        // 5. Seed default flag types for each clinic
        const clinicsRes = await client.query('SELECT id FROM clinics');
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

        for (const clinic of clinicsRes.rows) {
            for (const flag of defaultFlags) {
                await client.query(`
                    INSERT INTO flag_types (clinic_id, label, category, severity, color, requires_acknowledgment, is_default)
                    VALUES ($1, $2, $3, $4, $5, $6, TRUE)
                    ON CONFLICT DO NOTHING
                `, [clinic.id, flag.label, flag.category, flag.severity, flag.color, flag.requires_acknowledgment || false]);
            }
        }

        await client.query('COMMIT');
        console.log('Migration successful: Patient Flags schema created and seeded.');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Migration failed:', err);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

migrate();
