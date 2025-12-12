/**
 * Migration: Add room_sub_status column to appointments table
 * 
 * This tracks whether patient is:
 * - with_nurse: Being seen by nurse/MA
 * - ready_for_provider: Waiting for doctor
 */

const pool = require('../db');

async function migrate() {
    console.log('Starting room_sub_status migration...');
    
    try {
        // Check if column exists
        const checkColumn = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'appointments' AND column_name = 'room_sub_status'
        `);
        
        if (checkColumn.rows.length === 0) {
            console.log('Adding room_sub_status column...');
            await pool.query(`
                ALTER TABLE appointments 
                ADD COLUMN room_sub_status VARCHAR(50) DEFAULT NULL
            `);
            console.log('✅ room_sub_status column added');
        } else {
            console.log('✅ room_sub_status column already exists');
        }
        
        console.log('Migration completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migrate();
