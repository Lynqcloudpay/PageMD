/**
 * Fix notes that were signed by "System Administrator" user
 * Updates note_signed_by to match provider_id for those notes
 */

const pool = require('../db');

async function fixNoteSigners() {
    console.log('Starting fix for notes signed by System Administrator...');
    
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');

        // First, find all notes signed by "System Administrator"
        const findNotes = await client.query(`
            SELECT v.id, v.provider_id, v.note_signed_by,
                   signed_by_user.first_name as signed_by_first_name,
                   signed_by_user.last_name as signed_by_last_name,
                   provider_user.first_name as provider_first_name,
                   provider_user.last_name as provider_last_name
            FROM visits v
            LEFT JOIN users signed_by_user ON v.note_signed_by = signed_by_user.id
            LEFT JOIN users provider_user ON v.provider_id = provider_user.id
            WHERE v.note_signed_by IS NOT NULL
              AND (
                  (signed_by_user.first_name = 'System' AND signed_by_user.last_name = 'Administrator')
                  OR (signed_by_user.first_name = 'System Administrator')
              )
        `);

        console.log(`Found ${findNotes.rows.length} notes signed by System Administrator`);

        if (findNotes.rows.length === 0) {
            console.log('No notes to fix!');
            await client.query('COMMIT');
            return;
        }

        // Update each note to use provider_id as the signer, if provider_id exists and is different
        // If provider is also "System Administrator", we can't fix it automatically (need manual intervention)
        let fixedCount = 0;
        let skippedCount = 0;
        
        for (const note of findNotes.rows) {
            const providerName = note.provider_first_name && note.provider_last_name
                ? `${note.provider_first_name} ${note.provider_last_name}`
                : 'Unknown';
            
            const isProviderAlsoAdmin = (note.provider_first_name === 'System' && note.provider_last_name === 'Administrator')
                || note.provider_first_name === 'System Administrator';
            
            if (note.provider_id && note.note_signed_by !== note.provider_id && !isProviderAlsoAdmin) {
                await client.query(
                    `UPDATE visits 
                     SET note_signed_by = $1
                     WHERE id = $2`,
                    [note.provider_id, note.id]
                );
                fixedCount++;
                console.log(`✓ Fixed note ${note.id} - now signed by provider: ${providerName}`);
            } else if (isProviderAlsoAdmin) {
                skippedCount++;
                console.log(`⚠ Note ${note.id} - Provider is also "System Administrator" (needs manual fix)`);
            } else {
                skippedCount++;
                console.log(`⚠ Note ${note.id} - Already has provider as signer or no provider`);
            }
        }
        
        console.log(`\n📊 Summary:`);
        console.log(`   • Fixed: ${fixedCount} notes`);
        console.log(`   • Skipped: ${skippedCount} notes (provider is also System Administrator or already correct)`);

        await client.query('COMMIT');
        console.log(`✅ Fixed ${fixedCount} notes!`);
        console.log('All notes now show the correct provider name instead of System Administrator.');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error fixing notes:', error);
        throw error;
    } finally {
        client.release();
    }
}

// Run if called directly
if (require.main === module) {
    fixNoteSigners()
        .then(() => {
            console.log('Fix completed successfully!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Fix failed:', error);
            process.exit(1);
        });
}

module.exports = fixNoteSigners;

