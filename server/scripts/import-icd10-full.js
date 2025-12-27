const { Pool } = require('pg');
const fs = require('fs');
const readline = require('readline');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function importICD10() {
    console.log('🚀 Starting ICD-10 codes import from CMS file...');

    const filePath = process.env.ICD10_FILE || '/app/data/icd10cm_codes_2026.txt';

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
        let totalSkipped = 0;
        let batchSize = 500;

        for await (const line of rl) {
            if (!line.trim()) continue;

            // Format: CODE (first 8 chars, trim) + DESCRIPTION (rest)
            const code = line.substring(0, 8).trim();
            const description = line.substring(8).trim();

            if (!code || !description) continue;

            // Determine if billable (codes with 3-7 chars are typically billable)
            const isBillable = code.length >= 3;

            batch.push({ code, description, isBillable });

            if (batch.length >= batchSize) {
                const result = await insertBatch(client, batch);
                totalInserted += result.inserted;
                totalSkipped += result.skipped;
                console.log(`  Processed ${totalInserted + totalSkipped} codes...`);
                batch = [];
            }
        }

        // Insert remaining
        if (batch.length > 0) {
            const result = await insertBatch(client, batch);
            totalInserted += result.inserted;
            totalSkipped += result.skipped;
        }

        console.log(`\n✅ Import completed!`);
        console.log(`   - Inserted: ${totalInserted}`);
        console.log(`   - Skipped (duplicates): ${totalSkipped}`);
        console.log(`   - Total: ${totalInserted + totalSkipped}`);

    } finally {
        client.release();
        await pool.end();
    }
}

async function insertBatch(client, batch) {
    let inserted = 0;
    let skipped = 0;

    for (const item of batch) {
        try {
            const result = await client.query(`
        INSERT INTO icd10_codes (code, description, is_billable, is_active)
        VALUES ($1, $2, $3, true)
        ON CONFLICT (code) DO NOTHING
      `, [item.code, item.description, item.isBillable]);

            if (result.rowCount > 0) {
                inserted++;
            } else {
                skipped++;
            }
        } catch (error) {
            console.error(`  Error inserting ${item.code}: ${error.message}`);
            skipped++;
        }
    }

    return { inserted, skipped };
}

importICD10().catch(err => {
    console.error('❌ Import failed:', err);
    process.exit(1);
});
