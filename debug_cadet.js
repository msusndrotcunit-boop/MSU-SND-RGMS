const db = require('./server/database');

const search = '%Lastimosa%';

console.log('Searching for cadet...');

// Use the db object which handles the connection (SQLite or Postgres)
// Note: db.all is available on the exported object

const run = async () => {
    // 1. Search Cadets
    db.all(`SELECT * FROM cadets WHERE last_name LIKE ? OR first_name LIKE ?`, [search, search], (err, rows) => {
        if (err) console.error('Error searching cadets:', err);
        else {
            console.log('--- Cadets Found ---');
            console.log(JSON.stringify(rows, null, 2));
        }
    });

    // 2. Search Users
    db.all(`SELECT * FROM users WHERE username LIKE ? OR email LIKE ?`, [search, search], (err, rows) => {
        if (err) console.error('Error searching users:', err);
        else {
            console.log('--- Users Found ---');
            console.log(JSON.stringify(rows, null, 2));
        }
    });
    
    // 3. Search Attendance Records (if possible, though they link to cadet_id)
    // We can't easily search by name in attendance_records if it only stores cadet_id, 
    // unless we join, but we already searched cadets.
    // However, maybe there are "raw" records? The schema might help.
    // Let's check the schema of attendance_records first.
    db.all(`PRAGMA table_info(attendance_records)`, [], (err, rows) => {
         if (err) console.error('Error getting schema:', err);
         else {
             // console.log('Attendance Schema:', rows);
         }
    });
};

// Wait a bit for DB to init
setTimeout(run, 1000);
