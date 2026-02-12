const db = require('./database');

console.log('Checking profile pictures in database...\n');

// Query to get cadets with their profile pictures
const sql = `
    SELECT 
        c.id, 
        c.first_name, 
        c.last_name, 
        c.profile_pic,
        u.username
    FROM cadets c
    LEFT JOIN users u ON u.cadet_id = c.id
    WHERE c.first_name = 'Junjie' AND c.last_name = 'Bahian'
    LIMIT 1
`;

db.get(sql, [], (err, row) => {
    if (err) {
        console.error('Error querying database:', err.message);
        process.exit(1);
    }
    
    if (!row) {
        console.log('No cadet found with name Junjie Bahian');
        process.exit(0);
    }
    
    console.log('Cadet found:');
    console.log('ID:', row.id);
    console.log('Name:', row.first_name, row.last_name);
    console.log('Username:', row.username);
    console.log('Profile Pic:', row.profile_pic || '(NULL)');
    console.log('\nProfile Pic Type:', typeof row.profile_pic);
    
    if (row.profile_pic) {
        console.log('Profile Pic Length:', row.profile_pic.length);
        console.log('Starts with http:', row.profile_pic.startsWith('http'));
        console.log('Starts with /uploads:', row.profile_pic.startsWith('/uploads'));
        console.log('Starts with data:', row.profile_pic.startsWith('data:'));
        console.log('First 100 chars:', row.profile_pic.substring(0, 100));
    }
    
    // Close database connection
    if (db.pool) {
        db.pool.end(() => {
            console.log('\nDatabase connection closed.');
            process.exit(0);
        });
    } else {
        process.exit(0);
    }
});
