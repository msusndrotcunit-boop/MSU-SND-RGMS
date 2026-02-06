const db = require('./database');

db.serialize(() => {
    db.all("PRAGMA table_info(cadets)", (err, rows) => {
        if (err) {
            console.error("Error getting schema:", err);
            return;
        }
        console.log("--- CADETS TABLE SCHEMA ---");
        const columns = rows.map(r => r.name);
        console.log("Columns:", columns.join(', '));
        console.log("Has is_archived:", columns.includes('is_archived'));
        console.log("Has is_profile_completed:", columns.includes('is_profile_completed'));
    });
});
