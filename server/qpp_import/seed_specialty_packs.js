const pool = require('../db');

async function seedSpecialtyPacks() {
    try {
        const year = 2026;

        // 1. Get Quality Measures
        const measuresRes = await pool.query(`SELECT id, qpp_id FROM qpp_measures WHERE performance_year = $1`, [year]);
        const m = {};
        measuresRes.rows.forEach(row => {
            m[row.qpp_id] = row.id;
        });

        const packs = [
            {
                specialty: 'Cardiology',
                reporting_path: 'TRADITIONAL_MIPS',
                measure_ids: ['236', '128', '226'].map(id => m[id]).filter(Boolean),
                ia_ids: ['IA_EPA_1'].map(id => m[id]).filter(Boolean),
                pi_ids: ['PI_PCP_1'].map(id => m[id]).filter(Boolean),
                cost_refs: ["TPCC", "MSPB", "Revascularization (episode)"]
            },
            {
                specialty: 'Family Medicine / Primary Care',
                reporting_path: 'TRADITIONAL_MIPS',
                measure_ids: ['236', '001', '128', '226', '110', '130'].map(id => m[id]).filter(Boolean),
                ia_ids: ['IA_EPA_1'].map(id => m[id]).filter(Boolean),
                pi_ids: ['PI_PCP_1'].map(id => m[id]).filter(Boolean),
                cost_refs: ["TPCC", "MSPB"]
            },
            {
                specialty: 'Endocrinology',
                reporting_path: 'TRADITIONAL_MIPS',
                measure_ids: ['001', '236', '128'].map(id => m[id]).filter(Boolean),
                ia_ids: ['IA_EPA_1'].map(id => m[id]).filter(Boolean),
                pi_ids: ['PI_PCP_1'].map(id => m[id]).filter(Boolean)
            }
        ];

        for (const pack of packs) {
            await pool.query(
                `INSERT INTO specialty_packs (
                    performance_year, specialty, reporting_path, measure_ids, ia_ids, pi_ids, cost_refs
                ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT (performance_year, specialty, reporting_path, mvp_id) DO UPDATE SET
                    measure_ids = EXCLUDED.measure_ids,
                    ia_ids = EXCLUDED.ia_ids,
                    pi_ids = EXCLUDED.pi_ids,
                    cost_refs = EXCLUDED.cost_refs,
                    updated_at = CURRENT_TIMESTAMP`,
                [
                    year,
                    pack.specialty,
                    pack.reporting_path,
                    pack.measure_ids,
                    pack.ia_ids || [],
                    pack.pi_ids || [],
                    JSON.stringify(pack.cost_refs || [])
                ]
            );
            console.log(`[Pack Seeder] Seeded ${pack.specialty} for ${year}`);
        }

        console.log('[Pack Seeder] Complete!');
    } catch (error) {
        console.error('[Pack Seeder] Error:', error);
    } finally {
        await pool.end();
    }
}

seedSpecialtyPacks();
