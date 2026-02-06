const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'rotc.db');
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
        console.error(err.message);
        process.exit(1);
    }
});

db.serialize(() => {
    console.log("--- CADETS ---");
    db.get("SELECT COUNT(*) as total FROM cadets", (err, row) => {
        console.log("Total Cadets:", row.total);
    });
    db.all("SELECT is_archived, COUNT(*) as count FROM cadets GROUP BY is_archived", (err, rows) => {
        console.log("Cadets by is_archived:", rows);
    });
    db.all("SELECT is_profile_completed, COUNT(*) as count FROM cadets GROUP BY is_profile_completed", (err, rows) => {
        console.log("Cadets by is_profile_completed:", rows);
    });

    console.log("\n--- TRAINING DAYS ---");
    db.get("SELECT COUNT(*) as total FROM training_days", (err, row) => {
        console.log("Total Training Days:", row.total);
    });
    db.all("SELECT * FROM training_days LIMIT 5", (err, rows) => {
        console.log("First 5 Training Days:", rows);
    });

    console.log("\n--- USERS ---");
    db.get("SELECT COUNT(*) as total FROM users", (err, row) => {
        console.log("Total Users:", row.total);
    });
});

db.close();
