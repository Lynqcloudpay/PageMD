const fs = require('fs');
const readline = require('readline');
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const poolConfig = process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'paper_emr',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
    };

const pool = new Pool(poolConfig);

async function runImport() {
    const args = process.argv.slice(2);
    const getArg = (flag) => {
        const idx = args.indexOf(flag);
        return idx > -1 ? args[idx + 1] : null;
    };

    const file = getArg('--file') || getArg('-f');
    const format = getArg('--format') || getArg('-m');
    const deactivateMissing = args.includes('--deactivate-missing');
    const year = getArg('--year') || new Date().getFullYear().toString();

    if (!file || !format) {
        console.log(`
Usage: node scripts/icd10/import.js --file <path> --format <csv|cms> [options]

Options:
  --file, -f            Path to source file (required)
  --format, -m          Format: csv or cms (required)
  --deactivate-missing  Mark codes not in file as inactive
  --year <year>         Effective year (default: current year)
    `);
        process.exit(1);
    }

    const filePath = path.resolve(file);

    if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        process.exit(1);
    }

    console.log(`📂 Starting import from ${filePath} (Format: ${format})`);

    const client = await pool.connect();
    try {
        const startTime = Date.now();
        let processed = 0;
        let inserted = 0;
        let updated = 0;
        let codesInFile = new Set();

        const fileStream = fs.createReadStream(filePath);
        const rl = readline.createInterface({
            input: fileStream,
            crlfDelay: Infinity
        });

        await client.query('BEGIN');

        // Processing loop
        for await (const line of rl) {
            const trimmedLine = line.trim();
            if (!trimmedLine) continue;

            let parsed;
            if (format === 'csv') {
                parsed = parseCSV(trimmedLine);
            } else if (format === 'cms') {
                parsed = parseCMS(trimmedLine);
            }

            if (parsed) {
                const res = await client.query(`
                    INSERT INTO icd10_codes (code, description, is_billable, effective_date, termination_date, is_active)
                    VALUES ($1, $2, $3, $4, $5, true)
                    ON CONFLICT (code) DO UPDATE SET
                        description = EXCLUDED.description,
                        is_billable = EXCLUDED.is_billable,
                        is_active = true,
                        updated_at = CURRENT_TIMESTAMP
                    RETURNING (xmax = 0) AS is_inserted
                `, [parsed.code, parsed.description, parsed.is_billable, parsed.effective_date, parsed.termination_date]);

                if (res.rows[0].is_inserted) {
                    inserted++;
                } else {
                    updated++;
                }
                codesInFile.add(parsed.code);
                processed++;

                if (processed % 100 === 0) {
                    process.stdout.write(`Processed ${processed} codes...\r`);
                }
            }
        }

        console.log(`\n✅ Finished processing file. Total: ${processed} codes.`);

        if (deactivateMissing) {
            console.log('🧹 Deactivating missing codes...');
            const res = await client.query(`
                UPDATE icd10_codes 
                SET is_active = false 
                WHERE code NOT IN (SELECT unnest($1::text[]))
            `, [Array.from(codesInFile)]);
            console.log(`   Inactivated ${res.rowCount} codes.`);
        }

        await client.query('COMMIT');
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`🏁 Import Summary:
   - Total Processed: ${processed}
   - New Inserted: ${inserted}
   - Updated: ${updated}
   - Time Taken: ${duration}s`);

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Import failed:', err);
    } finally {
        client.release();
        pool.end();
    }
}

function parseCSV(line) {
    const parts = line.split(',').map(p => p.trim().replace(/^"|"$/g, ''));
    if (parts.length < 2) return null;

    return {
        code: formatCode(parts[0]),
        description: parts[1],
        is_billable: parts[2] === undefined ? true : (parts[2].toLowerCase() === 'true' || parts[2] === '1'),
        effective_date: parts[3] || null,
        termination_date: parts[4] || null
    };
}

function parseCMS(line) {
    if (line.length < 16) return null;

    const rawCode = line.substring(6, 13).trim();
    const billable = line.substring(14, 15) === '1';
    const description = line.substring(77).trim() || line.substring(16, 76).trim();

    return {
        code: formatCode(rawCode),
        description: description,
        is_billable: billable,
        effective_date: null,
        termination_date: null
    };
}

function formatCode(code) {
    let c = code.replace(/\./g, '').trim().toUpperCase();
    if (c.length > 3) {
        return c.substring(0, 3) + '.' + c.substring(3);
    }
    return c;
}

runImport();
