const pool = require('../db');

async function migrate() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        console.log('--- Creating Governance Tables ---');

        // Reset tables to ensure schema match (Phase 2 fresh start)
        await client.query('DROP TABLE IF EXISTS platform_role_template_privileges');
        await client.query('DROP TABLE IF EXISTS platform_role_templates');

        // 1. Role Templates
        await client.query(`
      CREATE TABLE IF NOT EXISTS platform_role_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        role_key VARCHAR(50) UNIQUE NOT NULL,      -- Stable identifier (e.g. 'PHYSICIAN')
        display_name VARCHAR(100) NOT NULL,
        description TEXT,
        version INTEGER DEFAULT 1,
        is_required BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_by UUID                            -- Platform Admin ID
      )
    `);

        // 2. Template Privileges
        await client.query(`
      CREATE TABLE IF NOT EXISTS platform_role_template_privileges (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        template_id UUID REFERENCES platform_role_templates(id) ON DELETE CASCADE,
        privilege_name VARCHAR(100) NOT NULL,
        UNIQUE(template_id, privilege_name)
      )
    `);

        console.log('--- Seeding Canonical Role Templates ---');

        const templates = [
            {
                key: 'CLINIC_ADMIN',
                display: 'Admin',
                required: true,
                privs: [
                    'patients:view_list', 'patients:view_chart', 'patients:view_demographics',
                    'patients:edit_demographics', 'patients:edit_insurance', 'patients:create', 'patients:delete',
                    'notes:view', 'notes:create', 'notes:edit', 'notes:sign', 'notes:delete',
                    'visits:create', 'visits:edit', 'visits:sign', 'visits:delete',
                    'orders:create', 'orders:edit', 'orders:delete', 'orders:view',
                    'prescriptions:create', 'prescriptions:edit', 'prescriptions:view', 'prescriptions:delete', 'meds:prescribe',
                    'referrals:create', 'referrals:edit', 'referrals:view', 'referrals:delete',
                    'schedule:view', 'schedule:edit', 'schedule:status_update', 'schedule:assign_provider', 'schedule:delete',
                    'users:manage', 'roles:manage', 'permissions:manage',
                    'billing:view', 'billing:create', 'billing:edit', 'claims:submit',
                    'reports:view', 'settings:edit', 'admin:access', 'audit:view'
                ]
            },
            {
                key: 'PHYSICIAN',
                display: 'Physician',
                required: true,
                privs: [
                    'patients:view_list', 'patients:view_chart', 'patients:view_demographics',
                    'patients:edit_demographics', 'patients:create',
                    'visits:create', 'visits:edit', 'visits:sign',
                    'notes:create', 'notes:edit', 'notes:sign',
                    'orders:create', 'orders:edit', 'orders:view',
                    'prescriptions:create', 'prescriptions:edit', 'prescriptions:view', 'meds:prescribe',
                    'referrals:create', 'referrals:edit', 'referrals:view',
                    'schedule:view', 'schedule:edit', 'schedule:status_update',
                    'billing:view', 'reports:view'
                ]
            },
            {
                key: 'NURSE_PRACTITIONER',
                display: 'Nurse Practitioner',
                required: false,
                privs: [
                    'patients:view_list', 'patients:view_chart', 'patients:view_demographics',
                    'patients:edit_demographics', 'patients:create',
                    'visits:create', 'visits:edit', 'visits:sign',
                    'notes:create', 'notes:edit', 'notes:sign',
                    'orders:create', 'orders:edit', 'orders:view',
                    'prescriptions:create', 'prescriptions:edit', 'prescriptions:view', 'meds:prescribe',
                    'referrals:create', 'referrals:edit', 'referrals:view',
                    'schedule:view', 'schedule:edit', 'schedule:status_update',
                    'billing:view', 'reports:view'
                ]
            },
            {
                key: 'PHYSICIAN_ASSISTANT',
                display: 'Physician Assistant',
                required: false,
                privs: [
                    'patients:view_list', 'patients:view_chart', 'patients:view_demographics',
                    'patients:edit_demographics', 'patients:create',
                    'visits:create', 'visits:edit', 'visits:sign',
                    'notes:create', 'notes:edit', 'notes:sign',
                    'orders:create', 'orders:edit', 'orders:view',
                    'prescriptions:create', 'prescriptions:edit', 'prescriptions:view', 'meds:prescribe',
                    'referrals:create', 'referrals:edit', 'referrals:view',
                    'schedule:view', 'schedule:edit', 'schedule:status_update',
                    'billing:view', 'reports:view'
                ]
            },
            {
                key: 'NURSE',
                display: 'Nurse',
                required: false,
                privs: [
                    'patients:view_list', 'patients:view_chart', 'patients:view_demographics',
                    'visits:create', 'visits:edit', 'orders:view',
                    'schedule:view', 'schedule:edit', 'schedule:status_update',
                    'billing:view'
                ]
            },
            {
                key: 'MEDICAL_ASSISTANT',
                display: 'Medical Assistant',
                required: false,
                privs: [
                    'patients:view_list', 'patients:view_chart', 'patients:view_demographics',
                    'visits:create', 'visits:edit', 'orders:view',
                    'schedule:view', 'schedule:status_update'
                ]
            },
            {
                key: 'FRONT_DESK',
                display: 'Front Desk',
                required: false,
                privs: [
                    'patients:view_list', 'patients:view_demographics', 'patients:create',
                    'schedule:view', 'schedule:edit', 'schedule:status_update', 'schedule:assign_provider'
                ]
            },
            {
                key: 'BILLING_SPECIALIST',
                display: 'Billing Specialist',
                required: false,
                privs: [
                    'patients:view_list', 'patients:view_chart', 'patients:edit_insurance',
                    'billing:view', 'billing:create', 'billing:edit', 'claims:submit', 'reports:view'
                ]
            }
        ];

        for (const tpl of templates) {
            const { rows } = await client.query(`
        INSERT INTO platform_role_templates (role_key, display_name, is_required)
        VALUES ($1, $2, $3)
        ON CONFLICT (role_key) DO UPDATE SET display_name = EXCLUDED.display_name, is_required = EXCLUDED.is_required
        RETURNING id
      `, [tpl.key, tpl.display, tpl.required]);

            const tplId = rows[0].id;

            // Clean old privs and re-insert
            await client.query('DELETE FROM platform_role_template_privileges WHERE template_id = $1', [tplId]);
            for (const priv of tpl.privs) {
                await client.query(`
          INSERT INTO platform_role_template_privileges (template_id, privilege_name)
          VALUES ($1, $2)
        `, [tplId, priv]);
            }
        }

        await client.query('COMMIT');
        console.log('✅ Governance migration completed successfully');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Governance migration failed:', err);
        throw err;
    } finally {
        client.release();
        await pool.end();
    }
}

migrate();
