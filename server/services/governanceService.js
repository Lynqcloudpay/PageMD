/**
 * Governance Service
 * Centralizes permission comparisons, drift detection, and role syncing.
 */
const pool = require('../db');
const AuditService = require('./auditService');

/**
 * Global Permission Catalog (Gold Standard)
 */
const PERMISSION_CATALOG = [
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
    'reports:view', 'settings:edit', 'admin:access', 'audit:view',
    'clinical:document', 'clinical:order', 'clinical:rx'
];

/**
 * Detect drift for a specific clinic
 * @param {string} clinicId 
 */
async function detectDrift(clinicId) {
    const clinicRes = await pool.controlPool.query('SELECT id, schema_name FROM clinics WHERE id = $1', [clinicId]);
    if (clinicRes.rows.length === 0) throw new Error('Clinic not found');
    const { schema_name } = clinicRes.rows[0];

    // 1. Fetch templates
    const templatesRes = await pool.controlPool.query(`
        SELECT t.role_key, t.display_name, tp.privilege_name
        FROM platform_role_templates t
        JOIN platform_role_template_privileges tp ON t.id = tp.template_id
    `);

    const templates = {};
    templatesRes.rows.forEach(r => {
        if (!templates[r.role_key]) {
            templates[r.role_key] = {
                displayName: r.display_name,
                privileges: new Set()
            };
        }
        templates[r.role_key].privileges.add(r.privilege_name);
    });

    // 2. Fetch clinic roles & privileges
    const clinicRolesRes = await pool.controlPool.query(`
        SELECT r.id, r.name as role_name, r.source_template_id, p.name as privilege_name
        FROM ${schema_name}.roles r
        LEFT JOIN ${schema_name}.role_privileges rp ON r.id = rp.role_id
        LEFT JOIN ${schema_name}.privileges p ON rp.privilege_id = p.id
    `);

    const clinicRoles = {};
    clinicRolesRes.rows.forEach(r => {
        // Use a composite key or just store by multiple accessors?
        // Let's store objects we can iterate over
        if (!clinicRoles[r.role_name]) {
            clinicRoles[r.role_name] = {
                id: r.id,
                name: r.role_name,
                sourceTemplateId: r.source_template_id,
                privileges: new Set()
            };
        }
        if (r.privilege_name) clinicRoles[r.role_name].privileges.add(r.privilege_name);
    });


    // Map clinic roles by sourceTemplateId for reliable lookup
    const rolesByTemplateId = new Map();
    Object.values(clinicRoles).forEach(role => {
        if (role.sourceTemplateId) {
            rolesByTemplateId.set(role.sourceTemplateId, role);
        }
    });

    const catalogSet = new Set(PERMISSION_CATALOG);
    const driftReports = [];

    // Compare Standard Roles
    const templatesRes2 = await pool.controlPool.query('SELECT id, role_key FROM platform_role_templates');
    const templateIds = new Map();
    templatesRes2.rows.forEach(t => templateIds.set(t.role_key, t.id));

    for (const [tplKey, tpl] of Object.entries(templates)) {
        const tplId = templateIds.get(tplKey);

        // 1. Try match by source_template_id (Hard Link)
        let roleInClinic = rolesByTemplateId.get(tplId);

        // 2. Fallback: Match by name (Soft Link)
        if (!roleInClinic) {
            roleInClinic = clinicRoles[tplKey] || clinicRoles[tpl.displayName];
        }

        if (!roleInClinic) {
            driftReports.push({
                roleKey: tplKey,
                displayName: tpl.displayName,
                status: 'MISSING',
                missingPrivileges: Array.from(tpl.privileges),
                extraPrivileges: [],
                unknownPrivileges: []
            });
            continue;
        }

        const currentPrivs = roleInClinic.privileges;
        const missing = Array.from(tpl.privileges).filter(p => !currentPrivs.has(p));
        const extra = Array.from(currentPrivs).filter(p => !tpl.privileges.has(p));
        const unknown = Array.from(currentPrivs).filter(p => !catalogSet.has(p));

        const status = (missing.length > 0 || extra.length > 0 || unknown.length > 0) ? 'DRIFTED' : 'SYNCED';

        driftReports.push({
            roleKey: tplKey,
            displayName: tpl.displayName,
            status,
            isLinked: !!roleInClinic.sourceTemplateId,
            missingPrivileges: missing,
            extraPrivileges: extra,
            unknownPrivileges: unknown
        });
    }

    return driftReports;
}

/**
 * Sync a role to match template
 * @param {string} clinicId 
 * @param {string} roleKey 
 * @param {string} adminId
 */
async function syncRole(clinicId, roleKey, adminId) {
    // Advisory Lock to prevent concurrent syncs for same clinic
    const lockKey = `sync_${clinicId}`;
    const client = await pool.controlPool.connect();

    try {
        await client.query('BEGIN');

        // Simple application-level mutex using a temporary flag or DB lock
        // Postgres advisory lock (session level)
        const lockRes = await client.query('SELECT pg_try_advisory_xact_lock($1)', [hashStringToInt(clinicId)]);
        if (!lockRes.rows[0].pg_try_advisory_xact_lock) {
            throw new Error('SYNC_IN_PROGRESS');
        }

        const clinicRes = await client.query('SELECT id, schema_name FROM clinics WHERE id = $1', [clinicId]);
        const { schema_name } = clinicRes.rows[0];

        const tplRes = await client.query(`
            SELECT t.id, t.version, t.display_name, tp.privilege_name
            FROM platform_role_templates t
            JOIN platform_role_template_privileges tp ON t.id = tp.template_id
            WHERE t.role_key = $1
        `, [roleKey]);

        const targetPrivs = tplRes.rows.map(r => r.privilege_name);
        const tplVersion = tplRes.rows[0].version;
        const tplId = tplRes.rows[0].id;
        const tplDisplayName = tplRes.rows[0].display_name;

        // 1. Ensure role exists in clinic (Match by source_template_id first, then name)
        let rRes = await client.query(`SELECT id, name FROM ${schema_name}.roles WHERE source_template_id = $1`, [tplId]);
        let roleId;

        if (rRes.rows.length === 0) {
            // Fallback: Check by name (either the key or the display name)
            rRes = await client.query(`SELECT id, name FROM ${schema_name}.roles WHERE name = $1 OR name = $2`, [roleKey, tplDisplayName]);
        }

        if (rRes.rows.length === 0) {
            const newRole = await client.query(`
                INSERT INTO ${schema_name}.roles (name, description, is_system_role, source_template_id) 
                VALUES ($1, $2, TRUE, $3) 
                RETURNING id
            `, [tplDisplayName, `Standard platform role: ${tplDisplayName}`, tplId]);
            roleId = newRole.rows[0].id;
        } else {
            roleId = rRes.rows[0].id;
            // Ensure source_template_id is linked and name is standard
            await client.query(`UPDATE ${schema_name}.roles SET source_template_id = $1, name = $2 WHERE id = $3`, [tplId, tplDisplayName, roleId]);
        }

        // 2. Identify Current State for audit logs
        const currentPrivsRes = await client.query(`
            SELECT p.name 
            FROM ${schema_name}.role_privileges rp
            JOIN ${schema_name}.privileges p ON rp.privilege_id = p.id
            WHERE rp.role_id = $1
        `, [roleId]);
        const currentPrivs = new Set(currentPrivsRes.rows.map(r => r.name));

        const missingBefore = targetPrivs.filter(p => !currentPrivs.has(p));
        const extraBefore = Array.from(currentPrivs).filter(p => !targetPrivs.includes(p));

        // 3. Update privileges
        await client.query(`DELETE FROM ${schema_name}.role_privileges WHERE role_id = $1`, [roleId]);

        for (const pName of targetPrivs) {
            // Ensure privilege exists in clinic database catalog
            let pRes = await client.query(`SELECT id FROM ${schema_name}.privileges WHERE name = $1`, [pName]);
            let privilegeId;
            if (pRes.rows.length === 0) {
                const newP = await client.query(`
                    INSERT INTO ${schema_name}.privileges (name, description, category) 
                    VALUES ($1, $2, $3) 
                    RETURNING id
                `, [pName, `Standard Permission: ${pName}`, 'clinical']);
                privilegeId = newP.rows[0].id;
            } else {
                privilegeId = pRes.rows[0].id;
            }

            await client.query(`
                INSERT INTO ${schema_name}.role_privileges (role_id, privilege_id) 
                VALUES ($1, $2)
            `, [roleId, privilegeId]);
        }

        // 4. Log Platform Audit (Hashed)
        await AuditService.log(client, 'ROLE_FORCE_SYNC', clinicId, {
            roleKey,
            templateVersion: tplVersion,
            adminId,
            diff: {
                missingBefore,
                extraBefore
            }
        });

        await client.query('COMMIT');
        return { success: true, roleKey };
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

function hashStringToInt(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
}

module.exports = {
    detectDrift,
    syncRole,
    PERMISSION_CATALOG
};
