const db = require('./database');

console.log('--- CHECKING TABLES ---');

// Check Users Schema
db.all("PRAGMA table_info(users)", [], (err, rows) => {
    if (err) console.error(err);
    else {
        console.log('Users Table Schema:');
        console.table(rows.map(r => ({ name: r.name, type: r.type })));
    }
});

// Check Cadets Schema
db.all("PRAGMA table_info(cadets)", [], (err, rows) => {
    if (err) console.error(err);
    else {
        console.log('Cadets Table Schema:');
        console.table(rows.map(r => ({ name: r.name, type: r.type })));
    }
});

// Check specific ghost cadet
db.all("SELECT * FROM cadets WHERE last_name LIKE '%LANGUIDO%' OR first_name LIKE '%JOHN MARK%'", [], (err, rows) => {
    if (err) console.error(err);
    else {
        console.log('Ghost Cadet Search Result:');
        console.log(rows);
    }
});

// Check all cadets visibility flags
db.all("SELECT id, first_name, last_name, is_archived, is_profile_completed FROM cadets", [], (err, rows) => {
    if (err) console.error(err);
    else {
        console.log('All Cadets Flags:');
        console.table(rows);
    }
});

// Check Training Days
db.all("SELECT * FROM training_days", [], (err, rows) => {
    if (err) console.error(err);
    else {
        console.log('Training Days:');
        console.table(rows);
    }
});
