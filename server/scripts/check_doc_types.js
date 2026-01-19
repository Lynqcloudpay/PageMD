const pool = require('../db');

async function checkDocTypes() {
    const client = await pool.connect();
    try {
        const res = await client.query('SELECT DISTINCT doc_type FROM documents');
        console.log('Distinct doc_types:', res.rows.map(r => r.doc_type));
    } catch (err) {
        console.error('Error:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

checkDocTypes();
