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

        // Get all documents with filesystem paths
        const result = await client.query(`
            SELECT id, file_path 
            FROM documents 
            WHERE file_path NOT LIKE '/api/uploads/%'
        `);

        console.log(`Found ${result.rows.length} documents to migrate`);

        let migrated = 0;
        for (const doc of result.rows) {
            // Extract filename from the old path
            const filename = path.basename(doc.file_path);
            const newPath = `/api/uploads/${filename}`;

            await client.query(
                'UPDATE documents SET file_path = $1 WHERE id = $2',
                [newPath, doc.id]
            );
            migrated++;
        }

        console.log(`✅ Successfully migrated ${migrated} document paths`);
    } catch (error) {
        console.error('Error migrating document paths:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

migrateDocumentPaths();
