const db = require('./database');
const path = require('path');

console.log('--- DEBUG: Listing All Cadets ---');
db.all("SELECT id, rank, last_name, first_name, student_id FROM cadets", [], (err, rows) => {
    if (err) {
        console.error(err);
    } else {
        console.table(rows);
        if (rows.length === 0) console.log('No cadets found in DB.');
    }
});

console.log('\n--- DEBUG: Listing All Training Staff ---');
db.all("SELECT id, rank, last_name, first_name FROM training_staff", [], (err, rows) => {
    if (err) {
        console.error(err);
    } else {
        console.table(rows);
        if (rows.length === 0) console.log('No staff found in DB.');
    }
});

console.log('\n--- DEBUG: Listing All Users ---');
db.all("SELECT id, username, cadet_id, staff_id FROM users", [], (err, rows) => {
    if (err) {
        console.error(err);
    } else {
        console.table(rows);
    }
});
