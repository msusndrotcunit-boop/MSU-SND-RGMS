const db = require('./database');
// Attempt to load bcrypt from server modules or use dummy
let bcrypt;
try {
    bcrypt = require('./node_modules/bcryptjs');
} catch (e) {
    try {
        bcrypt = require('bcryptjs');
    } catch (e2) {
        console.log('bcryptjs not found, using dummy hash');
        bcrypt = { hashSync: () => '$2a$10$DUMMYPASSWORDHASHDO_NOT_USE_OR_YOU_WILL_BE_HACKED' };
    }
}

const cadetData = {
    rank: 'CDT 2LT',
    first_name: 'Harold',
    middle_name: 'Bancale',
    last_name: 'Lastimosa',
    suffix_name: '',
    student_id: 'LASTIMOSA-H', // Generated ID
    email: 'harold.lastimosa@example.com', // Placeholder
    contact_number: '',
    address: '',
    course: '',
    year_level: '',
    school_year: '2025-2026',
    battalion: '',
    company: '',
    platoon: '',
    cadet_course: '',
    semester: '',
    status: 'Ongoing'
};

const run = async () => {
    console.log('Adding cadet:', cadetData.first_name, cadetData.last_name);

    // 1. Insert Cadet
    const insertSql = `INSERT INTO cadets (
        rank, first_name, middle_name, last_name, suffix_name, 
        student_id, email, contact_number, address, 
        course, year_level, school_year, 
        battalion, company, platoon, 
        cadet_course, semester, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const params = [
        cadetData.rank, cadetData.first_name, cadetData.middle_name, cadetData.last_name, cadetData.suffix_name,
        cadetData.student_id, cadetData.email, cadetData.contact_number, cadetData.address,
        cadetData.course, cadetData.year_level, cadetData.school_year,
        cadetData.battalion, cadetData.company, cadetData.platoon,
        cadetData.cadet_course, cadetData.semester, cadetData.status
    ];

    db.run(insertSql, params, function(err) {
        if (err) {
            console.error('Error inserting cadet:', err.message);
            return;
        }
        
        const newCadetId = this.lastID;
        console.log('Cadet inserted with ID:', newCadetId);

        // 2. Create User Account
        const username = cadetData.student_id;
        const password = 'password123'; // Default password
        const hashedPassword = bcrypt.hashSync(password, 10);
        
        db.run(`INSERT INTO users (username, password, role, cadet_id, is_approved, email) VALUES (?, ?, ?, ?, ?, ?)`, 
            [username, hashedPassword, 'cadet', newCadetId, 1, cadetData.email], 
            (err) => {
                if (err) {
                    console.error("Error creating user:", err.message);
                    return;
                }
                console.log('User account created and approved.');

                // 3. Initialize Grades
                db.run(`INSERT INTO grades (cadet_id) VALUES (?)`, [newCadetId], (err) => {
                    if (err) console.error("Error initializing grades:", err);
                    else console.log('Grades initialized.');
                });
            }
        );
    });
};

// Wait for DB connection
setTimeout(run, 1000);
