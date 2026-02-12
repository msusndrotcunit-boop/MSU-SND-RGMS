const db = require('./database');

// Unlock profile for cadet ID 292
const cadetId = 292;

console.log(`\nUnlocking profile for cadet ID: ${cadetId}...`);

db.run('UPDATE cadets SET is_profile_completed = FALSE WHERE id = ?', [cadetId], function(err) {
    if (err) {
        console.error('Error:', err);
        process.exit(1);
    }
    
    console.log(`Profile unlocked successfully! (${this.changes} row(s) affected)`);
    
    // Verify the change
    db.get('SELECT id, first_name, last_name, is_profile_completed FROM cadets WHERE id = ?', [cadetId], (err, row) => {
        if (err) {
            console.error('Verification error:', err);
            process.exit(1);
        }
        
        console.log('\nVerification:');
        console.log('ID:', row.id);
        console.log('Name:', row.first_name, row.last_name);
        console.log('Profile Completed:', row.is_profile_completed);
        console.log('\nYou can now update the profile!');
        
        process.exit(0);
    });
});
