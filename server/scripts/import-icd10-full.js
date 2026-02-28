const { Pool } = require('pg');
const fs = require('fs');
const readline = require('readline');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const poolConfig = process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'emr_db',
        user: process.env.DB_USER || 'emr_user',
        password: process.env.DB_PASSWORD,
    };

const pool = new Pool(poolConfig);

function formatCode(code) {
    let c = code.replace(/\./g, '').trim().toUpperCase();
    if (c.length > 3) {
        return c.substring(0, 3) + '.' + c.substring(3);
    }
    return c;
}

async function importICD10() {
    console.log('🚀 Starting ICD-10 codes import from local CMS file...');

    // Point to the actual local data file found in workspace
    const filePath = path.join(__dirname, '../../data/icd10cm_codes_2026.txt');

    if (!fs.existsSync(filePath)) {
        console.error(`❌ File not found: ${filePath}`);
        process.exit(1);
    }

    const client = await pool.connect();

    try {
        const fileStream = fs.createReadStream(filePath);
        const rl = readline.createInterface({
            input: fileStream,
            crlfDelay: Infinity
        });

        let batch = [];
        let totalInserted = 0;
        let totalUpdated = 0;
        let totalSkipped = 0;
        let processedLines = 0;
        let batchSize = 1000;

        await client.query('BEGIN');

        for await (const line of rl) {
            if (!line.trim()) continue;

            // Format: CODE (first 8 chars, trim) + DESCRIPTION (rest)
            const rawCode = line.substring(0, 8).trim();
            const description = line.substring(8).trim();

            if (!rawCode || !description) continue;

            const code = formatCode(rawCode);
            const isBillable = rawCode.length >= 3;

            batch.push({ code, description, isBillable });
            processedLines++;

            if (batch.length >= batchSize) {
                const result = await insertBatch(client, batch);
                totalInserted += result.inserted;
                totalUpdated += result.updated;
                totalSkipped += result.skipped;
                process.stdout.write(`  Processed ${processedLines} lines (Inserted: ${totalInserted}, Updated: ${totalUpdated})\r`);
                batch = [];
            }
        }

        // Insert remaining
        if (batch.length > 0) {
            const result = await insertBatch(client, batch);
            totalInserted += result.inserted;
            totalUpdated += result.updated;
            totalSkipped += result.skipped;
        }

        await client.query('COMMIT');
        console.log(`\n\n✅ Import completed!`);
        console.log(`   - New Inserted: ${totalInserted}`);
        console.log(`   - Updated/Existing: ${totalUpdated}`);
        console.log(`   - Skipped: ${totalSkipped}`);
        console.log(`   - Total lines: ${processedLines}`);

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('\n❌ Import failed:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

async function insertBatch(client, batch) {
    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    for (const item of batch) {
        try {
            const result = await client.query(`
                INSERT INTO icd10_codes (code, description, is_billable, is_active)
                VALUES ($1, $2, $3, true)
                ON CONFLICT (code) DO UPDATE SET
                    description = EXCLUDED.description,
                    is_active = true,
                    updated_at = CURRENT_TIMESTAMP
                RETURNING (xmax = 0) AS is_inserted
            `, [item.code, item.description, item.isBillable]);

            if (result.rows[0].is_inserted) {
                inserted++;
            } else {
                updated++;
            }
        } catch (error) {
            // Silently skip rare errors to keep speed, log if critical
            skipped++;
        }
    }

    return { inserted, updated, skipped };
}

importICD10().catch(err => {
    console.error('❌ Import failed:', err);
    process.exit(1);
});
