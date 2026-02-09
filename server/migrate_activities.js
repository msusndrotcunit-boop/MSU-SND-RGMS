const path = require('path');
const sqlite3 = require('sqlite3').verbose();
// Mock process.env if needed or just rely on default behavior
const dbPath = path.resolve(__dirname, 'rotc.db');

const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    console.log("Running migrations...");
    
    db.run("ALTER TABLE activities ADD COLUMN images TEXT", (err) => {
        if (err) console.log("Images column error (might exist):", err.message);
        else console.log("Added images column");
    });

    db.run("ALTER TABLE activities ADD COLUMN type TEXT DEFAULT 'activity'", (err) => {
        if (err) console.log("Type column error (might exist):", err.message);
        else console.log("Added type column");
    });
});

db.close();
