const fs = require('fs');
const readline = require('readline');
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function importLoinc() {
    const args = process.argv.slice(2);
    const fileArg = args.indexOf('--file');
    const versionArg = args.indexOf('--version');

    if (fileArg === -1 || !args[fileArg + 1]) {
        console.error('❌ Error: --file path is required');
        process.exit(1);
    }

    const filePath = path.resolve(args[fileArg + 1]);
    const version = versionArg !== -1 ? args[versionArg + 1] : 'Unknown';

    if (!fs.existsSync(filePath)) {
        console.error(`❌ Error: File not found at ${filePath}`);
        process.exit(1);
    }
    const stats = fs.statSync(filePath);
    console.log(`📂 Starting LOINC import from ${filePath} (Version: ${version}) - ${stats.size} bytes`);

    // Read the entire file first to get lines
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const lines = fileContent.split('\n');
    console.log(`Total lines in file: ${lines.length}`);

    let count = 0;
    let headers = null;
    const batchSize = 1000;
    let batch = [];

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        for (let lineCount = 0; lineCount < lines.length; lineCount++) {
            const line = lines[lineCount];
            if (!line.trim()) continue;  // Skip empty lines

            // Robust CSV parser (handles commas within quotes)
            const cleanParts = [];
            let current = '';
            let inQuotes = false;
            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                if (char === '"') {
                    inQuotes = !inQuotes;
                } else if (char === ',' && !inQuotes) {
                    cleanParts.push(current.trim().replace(/^"|"$/g, ''));
                    current = '';
                } else {
                    current += char;
                }
            }
            cleanParts.push(current.trim().replace(/^"|"$/g, ''));

            if (lineCount === 0) {
                headers = cleanParts.map(h => h.toUpperCase().trim());
                console.log('✅ Headers detected:', headers.slice(0, 5).join(', '));
                continue;
            }

            const record = {};
            headers.forEach((h, i) => {
                record[h] = cleanParts[i] || null;
            });

            const loinc_code = record.LOINC_NUM;
            if (!loinc_code || loinc_code === 'LOINC_NUM') continue;

            batch.push([
                loinc_code,
                record.COMPONENT,
                record.PROPERTY,
                record.TIME_ASPCT,
                record.SYSTEM,
                record.SCALE_TYP,
                record.METHOD_TYP,
                record.LONG_COMMON_NAME,
                record.STATUS,
                version
            ]);

            if (batch.length >= batchSize) {
                await upsertBatch(client, batch);
                count += batch.length;
                if (count % 10000 === 0) {
                    console.log(`...processed ${count} codes`);
                }
                batch = [];
            }
        }

        if (batch.length > 0) {
            await upsertBatch(client, batch);
            count += batch.length;
        }

        await client.query('COMMIT');
        console.log(`✅ LOINC Import complete. Total: ${count} records.`);
    } catch (err) {
        if (client) await client.query('ROLLBACK');
        console.error('❌ Import failed:', err);
    } finally {
        if (client) client.release();
        await pool.end();
    }
}

async function upsertBatch(client, rows) {
    const query = `
        INSERT INTO loinc_codes (
            loinc_code, component, property, timing, system, scale, method, long_common_name, status, version
        )
        SELECT * FROM UNNEST($1::text[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::text[], $8::text[], $9::text[], $10::text[])
        ON CONFLICT (loinc_code) DO UPDATE SET
            component = EXCLUDED.component,
            property = EXCLUDED.property,
            timing = EXCLUDED.timing,
            system = EXCLUDED.system,
            scale = EXCLUDED.scale,
            method = EXCLUDED.method,
            long_common_name = EXCLUDED.long_common_name,
            status = EXCLUDED.status,
            version = EXCLUDED.version
    `;

    const columns = [[], [], [], [], [], [], [], [], [], []];
    rows.forEach(row => {
        row.forEach((val, i) => columns[i].push(val));
    });

    await client.query(query, columns);
}

importLoinc();
