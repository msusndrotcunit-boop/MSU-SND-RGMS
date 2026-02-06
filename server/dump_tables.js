const db = require('./database');

console.log('--- CADETS ---');
db.all('SELECT id, first_name, last_name, is_archived, is_profile_completed FROM cadets', [], (err, rows) => {
    if (err) console.error(err);
    else console.table(rows);
});

console.log('--- TRAINING STAFF ---');
db.all('SELECT id, first_name, last_name, is_archived FROM training_staff', [], (err, rows) => {
    if (err) console.error(err);
    else console.table(rows);
});
