
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbFile = 'rotc_grading.db'; // Default name from your code
const dbPath = path.resolve(process.cwd(), dbFile);

console.log('Checking database at:', dbPath);
if (!fs.existsSync(dbPath)) {
    console.error('Database file does not exist!');
    process.exit(1);
}

const db = new sqlite3.Database(dbPath);

const queries = [
    "SELECT COUNT(*) as count FROM training_days",
    "SELECT COUNT(*) as count FROM cadets",
    "SELECT COUNT(*) as count FROM attendance_records",
    "SELECT COUNT(*) as count FROM merit_demerit_logs",
    "SELECT * FROM training_days LIMIT 2"
];

async function run() {
    for (const sql of queries) {
        console.log('\nQuery:', sql);
        await new Promise((resolve) => {
            db.all(sql, [], (err, rows) => {
                if (err) console.error('Error:', err.message);
                else console.log('Result:', JSON.stringify(rows, null, 2));
                resolve();
            });
        });
    }
    db.close();
}

run();
