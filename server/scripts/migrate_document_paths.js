const { Pool } = require('pg');
const path = require('path');

const config = process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'paper_emr',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
    };

const pool = new Pool(config);

async function migrateDocumentPaths() {
    const client = await pool.connect();
    try {
        console.log('Starting document path migration...');

        // Get all documents that need migration
        const result = await client.query(`
            SELECT id, file_path 
            FROM documents 
            WHERE file_path LIKE '%/%'
        `);

        console.log(`Found ${result.rows.length} total documents`);

        let migrated = 0;
        for (const doc of result.rows) {
            // Extract filename from any path format
            const filename = path.basename(doc.file_path);
            const newPath = `/uploads/${filename}`;

            // Skip if already in correct format
            if (doc.file_path === newPath) {
                console.log(`Skipping ${doc.id}: already in correct format`);
                continue;
            }

            console.log(`Migrating ${doc.id}: "${doc.file_path}" -> "${newPath}"`);
            await client.query(
                'UPDATE documents SET file_path = $1 WHERE id = $2',
                [newPath, doc.id]
            );
            migrated++;
        }

        console.log(`✅ Successfully migrated ${migrated} document paths to /uploads/ format`);
    } catch (error) {
        console.error('Error migrating document paths:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

migrateDocumentPaths();
