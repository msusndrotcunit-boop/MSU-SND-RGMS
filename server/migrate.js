const db = require('./database');

const columnsToAdd = [
    "ADD COLUMN rank TEXT",
    "ADD COLUMN middle_name TEXT",
    "ADD COLUMN suffix_name TEXT",
    "ADD COLUMN contact_number TEXT",
    "ADD COLUMN address TEXT",
    "ADD COLUMN course TEXT",
    "ADD COLUMN year_level TEXT",
    "ADD COLUMN school_year TEXT",
    "ADD COLUMN battalion TEXT",
    "ADD COLUMN company TEXT",
    "ADD COLUMN cadet_course TEXT",
    "ADD COLUMN semester TEXT",
    "ADD COLUMN status TEXT DEFAULT 'Ongoing'",
    "ADD COLUMN profile_pic TEXT",
    "ADD COLUMN profile_completed INTEGER DEFAULT 0"
];

console.log('Migrating database...');

db.serialize(() => {
    columnsToAdd.forEach(col => {
        db.run(`ALTER TABLE cadets ${col}`, (err) => {
            if (err) {
                // Ignore duplicate column errors
                if (!err.message.includes('duplicate column name')) {
                    console.error('Error adding column:', err.message);
                } else {
                    console.log(`Column already exists (skipped): ${col}`);
                }
            } else {
                console.log(`Added column: ${col}`);
            }
        });
    });
});

// Wait a bit then exit
setTimeout(() => {
    console.log('Migration finished.');
    process.exit(0);
}, 2000);
