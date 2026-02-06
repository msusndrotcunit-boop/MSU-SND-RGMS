const db = require('./database');

const run = async () => {
    console.log('--- ADDING last_seen COLUMN TO USERS TABLE ---');
    
    db.serialize(() => {
        db.run("ALTER TABLE users ADD COLUMN last_seen TEXT", (err) => {
            if (err) {
                if (err.message.includes('duplicate column name')) {
                    console.log('Column last_seen already exists.');
                } else {
                    console.error('Error adding last_seen column:', err);
                }
            } else {
                console.log('Successfully added last_seen column to users table.');
            }
        });
    });
};

run();
