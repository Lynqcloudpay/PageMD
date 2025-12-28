const pool = require('../db');

class SchemaValidator {
    /**
     * Compare all tenant schemas against a baseline (or the first tenant found)
     * Detects: Missing tables, Missing columns, Type mismatches
     */
    static async checkDrift() {
        const results = {
            timestamp: new Date(),
            baselineSchema: null,
            drifts: []
        };

        const client = await pool.controlPool.connect();
        try {
            // 1. Get all Tenant Schemas
            const schemasRes = await client.query(`
                SELECT schema_name 
                FROM clinics 
                WHERE status = 'active'
            `);
            const schemas = schemasRes.rows.map(r => r.schema_name);

            if (schemas.length < 2) {
                return { ...results, message: 'Not enough active tenants to compare.' };
            }

            // 2. Build Maps of { schema -> { table -> { column -> type } } }
            const schemaMaps = {};

            for (const schema of schemas) {
                const map = await this.getSchemaStructure(client, schema);
                schemaMaps[schema] = map;
            }

            // 3. Compare (Using the first schema as the "Baseline" for now, or 'public' if we had a template)
            // Realistically, we should compare against a "Gold Standard". 
            // For this phase, we compare everyone against the first tenant to ensure consistency.
            const baseline = schemas[0];
            results.baselineSchema = baseline;
            const baselineStructure = schemaMaps[baseline];

            for (let i = 1; i < schemas.length; i++) {
                const target = schemas[i];
                const targetStructure = schemaMaps[target];
                const drift = this.compareStructures(baselineStructure, targetStructure);

                if (drift.length > 0) {
                    results.drifts.push({
                        tenant: target,
                        issues: drift
                    });
                }
            }

        } finally {
            client.release();
        }

        return results;
    }

    static async getSchemaStructure(client, schema) {
        // Fetch all tables and columns
        const res = await client.query(`
            SELECT table_name, column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_schema = $1
            ORDER BY table_name, ordinal_position
        `, [schema]);

        const structure = {};
        for (const row of res.rows) {
            if (!structure[row.table_name]) structure[row.table_name] = {};
            structure[row.table_name][row.column_name] = {
                type: row.data_type,
                nullable: row.is_nullable
            };
        }
        return structure;
    }

    static compareStructures(baseline, target) {
        const issues = [];

        // Check for missing tables
        for (const table of Object.keys(baseline)) {
            if (!target[table]) {
                issues.push(`Missing Table: ${table}`);
                continue;
            }

            // Check for missing/mismatched columns
            const baselineCols = baseline[table];
            const targetCols = target[table];

            for (const col of Object.keys(baselineCols)) {
                if (!targetCols[col]) {
                    issues.push(`Table ${table}: Missing Column '${col}'`);
                    continue;
                }

                const bType = baselineCols[col].type;
                const tType = targetCols[col].type;
                if (bType !== tType) {
                    issues.push(`Table ${table}.${col}: Type Mismatch (${bType} vs ${tType})`);
                }
            }
        }

        return issues;
    }
}

module.exports = SchemaValidator;
