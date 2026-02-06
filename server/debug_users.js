const db = require('./database');

const run = async () => {
    console.log('--- CHECKING USERS ---');
    db.all("SELECT id, username, role, cadet_id FROM users", [], (err, rows) => {
        if (err) console.error(err);
        else console.table(rows);
    });
};

run();
