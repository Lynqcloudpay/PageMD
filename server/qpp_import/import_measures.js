const pool = require('../db');
const fs = require('fs');
const path = require('path');

async function importMeasures(filePath) {
    try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        console.log(`[Importer] Found ${data.length} measures in ${filePath}`);

        for (const measure of data) {
            const {
                performance_year,
                category,
                qpp_id,
                title,
                description,
                measure_type,
                specialty_set,
                mvp_ids,
                spec_url
            } = measure;

            await pool.query(
                `INSERT INTO qpp_measures (
                    performance_year, category, qpp_id, title, description, 
                    measure_type, specialty_set, mvp_ids, spec_url
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                ON CONFLICT (performance_year, qpp_id) DO UPDATE SET
                    title = EXCLUDED.title,
                    description = EXCLUDED.description,
                    measure_type = EXCLUDED.measure_type,
                    specialty_set = EXCLUDED.specialty_set,
                    mvp_ids = EXCLUDED.mvp_ids,
                    spec_url = EXCLUDED.spec_url,
                    updated_at = CURRENT_TIMESTAMP`,
                [
                    performance_year,
                    category,
                    qpp_id,
                    title,
                    description,
                    measure_type,
                    specialty_set || [],
                    mvp_ids || [],
                    spec_url
                ]
            );
            console.log(`[Importer] Imported/Updated ${qpp_id}: ${title}`);
        }

        console.log('[Importer] Import complete!');
    } catch (error) {
        console.error('[Importer] Error:', error);
    } finally {
        await pool.end();
    }
}

const fileToImport = process.argv[2] || path.join(__dirname, 'seed_measures_2026.json');
const absolutePath = path.isAbsolute(fileToImport) ? fileToImport : path.join(process.cwd(), fileToImport);

if (!fs.existsSync(absolutePath)) {
    console.error(`[Importer] File not found: ${absolutePath}`);
    process.exit(1);
}

importMeasures(absolutePath);
