const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'rotc.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
        process.exit(1);
    }
    console.log('Connected to SQLite database.');
});

function addColumnIfNotExists(tableName, columnName, columnDef) {
    return new Promise((resolve, reject) => {
        db.run(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef}`, (err) => {
            if (err) {
                if (err.message.includes('duplicate column')) {
                    console.log(`Column ${columnName} already exists in ${tableName}.`);
                    resolve();
                } else {
                    console.error(`Error adding column ${columnName} to ${tableName}:`, err.message);
                    // Don't reject, just log error and continue (might be other issues)
                    resolve(); 
                }
            } else {
                console.log(`Successfully added column ${columnName} to ${tableName}.`);
                resolve();
            }
        });
    });
}

async function fixSchema() {
    console.log('Starting schema fix...');

    // 1. Add last_seen to users
    await addColumnIfNotExists('users', 'last_seen', 'TEXT');

    // 2. Add time_in and time_out to attendance_records
    await addColumnIfNotExists('attendance_records', 'time_in', 'TEXT');
    await addColumnIfNotExists('attendance_records', 'time_out', 'TEXT');

    // 3. Add is_profile_completed to cadets (just in case)
    await addColumnIfNotExists('cadets', 'is_profile_completed', 'INTEGER DEFAULT 0');
    
    // 4. Add is_archived to cadets (just in case)
    await addColumnIfNotExists('cadets', 'is_archived', 'INTEGER DEFAULT 0');

    // 5. Add is_profile_completed to training_staff (just in case)
    await addColumnIfNotExists('training_staff', 'is_profile_completed', 'INTEGER DEFAULT 0');

    // 6. Add is_archived to training_staff (just in case)
    await addColumnIfNotExists('training_staff', 'is_archived', 'INTEGER DEFAULT 0');

     // 7. Add has_seen_guide to cadets (just in case)
     await addColumnIfNotExists('cadets', 'has_seen_guide', 'INTEGER DEFAULT 0');

    console.log('Schema fix completed.');
    db.close((err) => {
        if (err) console.error(err.message);
        console.log('Database connection closed.');
    });
}

fixSchema();
