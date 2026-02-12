const db = require('./database');

// Check what's stored for cadet ID 292
const cadetId = 292;

db.get('SELECT id, first_name, last_name, profile_pic FROM cadets WHERE id = ?', [cadetId], (err, row) => {
    if (err) {
        console.error('Error:', err);
        process.exit(1);
    }
    
    if (!row) {
        console.log(`Cadet ${cadetId} not found`);
        process.exit(1);
    }
    
    console.log('\n=== Cadet Profile Picture Storage ===');
    console.log('ID:', row.id);
    console.log('Name:', row.first_name, row.last_name);
    console.log('Profile Pic Field:', row.profile_pic);
    console.log('Profile Pic Type:', typeof row.profile_pic);
    console.log('Profile Pic Length:', row.profile_pic ? row.profile_pic.length : 0);
    
    if (row.profile_pic) {
        if (row.profile_pic.startsWith('http')) {
            console.log('Type: Cloudinary URL');
        } else if (row.profile_pic.startsWith('data:')) {
            console.log('Type: Base64 Data URL');
        } else if (row.profile_pic.startsWith('/uploads/')) {
            console.log('Type: Local Path');
        } else {
            console.log('Type: Unknown format');
        }
    } else {
        console.log('Type: NULL or empty');
    }
    
    process.exit(0);
});
