const db = require('./database');
const bcrypt = require('bcryptjs');

const run = async () => {
    console.log('Inserting Staff...');
    const staff = {
        rank: 'SSg',
        first_name: 'Test',
        middle_name: 'M',
        last_name: 'Staff',
        suffix_name: '',
        email: 'teststaff@example.com',
        contact_number: '1234567890',
        role: 'Instructor',
        profile_pic: null
    };

    const sql = `INSERT INTO training_staff (rank, first_name, middle_name, last_name, suffix_name, email, contact_number, role, profile_pic) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const params = [staff.rank, staff.first_name, staff.middle_name, staff.last_name, staff.suffix_name, staff.email, staff.contact_number, staff.role, staff.profile_pic];

    db.run(sql, params, function(err) {
        if (err) {
            console.error('Insert Staff Error:', err);
            return;
        }
        console.log('Staff inserted with ID:', this.lastID);
        const staffId = this.lastID;

        const userSql = `INSERT INTO users (username, password, role, staff_id, is_approved, email, profile_pic) VALUES (?, ?, 'training_staff', ?, 1, ?, ?)`;
        const dummyHash = '$2a$10$DUMMYPASSWORDHASHDO_NOT_USE_OR_YOU_WILL_BE_HACKED';
        
        db.run(userSql, ['teststaff', dummyHash, staffId, staff.email, staff.profile_pic], (uErr) => {
            if (uErr) console.error('Insert User Error:', uErr);
            else console.log('User inserted successfully');
        });
    });
};

run();
