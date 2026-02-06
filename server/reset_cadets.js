const db = require('./database');

const run = async () => {
    console.log('--- RESETTING CADET DATA ---');
    
    const tablesToClear = [
        'grades',
        'attendance_records',
        'merit_demerit_logs',
        'excuse_letters',
        'cadets'
    ];

    db.serialize(() => {
        db.run("BEGIN TRANSACTION");

        try {
            // 1. Clear dependent tables first
            tablesToClear.forEach(table => {
                db.run(`DELETE FROM ${table}`, (err) => {
                    if (err) console.error(`Error clearing ${table}:`, err);
                    else console.log(`Cleared ${table}`);
                });
            });

            // 2. Clear Users but keep Admin/Staff
            db.run("DELETE FROM users WHERE role = 'cadet' OR cadet_id IS NOT NULL", (err) => {
                if (err) console.error("Error clearing cadet users:", err);
                else console.log("Cleared cadet users");
            });
            
            // 3. Reset Sequence (Optional, but good for ID 1 start)
            tablesToClear.forEach(table => {
                db.run(`DELETE FROM sqlite_sequence WHERE name='${table}'`, (err) => {
                    if (err) {} // Ignore if sequence doesn't exist
                });
            });

            db.run("COMMIT", () => {
                console.log('--- RESET COMPLETE ---');
            });
        } catch (err) {
            console.error("Transaction Error:", err);
            db.run("ROLLBACK");
        }
    });
};

run();
