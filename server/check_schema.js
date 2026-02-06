const db = require('./database');

const run = async () => {
    console.log('--- CHECKING USERS TABLE SCHEMA ---');
    db.serialize(() => {
        db.all("PRAGMA table_info(users)", [], (err, rows) => {
            if (err) {
                console.error('Error:', err);
            } else {
                console.log('Columns:', rows.map(r => r.name).join(', '));
                const hasLastSeen = rows.some(r => r.name === 'last_seen');
                console.log(`Has last_seen: ${hasLastSeen}`);
            }
        });
    });
};

run();
