const db = require('./database');

console.log('Checking profile pictures in database...\n');

// Query to get cadets with their profile pictures
const sql = `SELECT id, first_name, last_name, profile_pic FROM cadets LIMIT 20`;

db.all(sql, [], (err, rows) => {
    if (err) {
        console.error('Error querying database:', err.message);
        process.exit(1);
    }
    
    if (!rows || rows.length === 0) {
        console.log('No cadets found in database');
    } else {
        console.log(`Found ${rows.length} cadets:`);
        rows.forEach(row => {
            console.log(`ID: ${row.id}, Name: ${row.first_name} ${row.last_name}, Pic: ${row.profile_pic}`);
        });
    }
    process.exit(0);
});
