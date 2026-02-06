const db = require('./database');

// --- Helpers from admin.js ---
const getCadetByStudentId = (studentId) => {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM cadets WHERE student_id = ?', [studentId], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

const getUserByCadetId = (cadetId) => {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM users WHERE cadet_id = ?', [cadetId], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

const insertCadet = (cadet) => {
    return new Promise((resolve, reject) => {
        const sql = `INSERT INTO cadets (
            rank, first_name, middle_name, last_name, suffix_name, 
            student_id, email, contact_number, address, 
            course, year_level, school_year, 
            battalion, company, platoon, 
            cadet_course, semester, status,
            is_profile_completed, is_archived
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)`;

        const params = [
            cadet.rank || '', cadet.first_name || '', cadet.middle_name || '', cadet.last_name || '', cadet.suffix_name || '',
            cadet.student_id, cadet.email || '', cadet.contact_number || '', cadet.address || '',
            cadet.course || '', cadet.year_level || '', cadet.school_year || '',
            cadet.battalion || '', cadet.company || '', cadet.platoon || '',
            cadet.cadet_course || '', cadet.semester || '', 'Ongoing'
        ];

        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve(this.lastID);
        });
    });
};

const updateCadet = (id, cadet) => {
    return new Promise((resolve, reject) => {
        const sql = `UPDATE cadets SET 
            rank = ?, first_name = ?, middle_name = ?, last_name = ?, suffix_name = ?, 
            email = ?, contact_number = ?, address = ?, 
            course = ?, year_level = ?, school_year = ?, 
            battalion = ?, company = ?, platoon = ?, 
            cadet_course = ?, semester = ?
            WHERE id = ?`;

        const params = [
            cadet.rank || '', cadet.first_name || '', cadet.middle_name || '', cadet.last_name || '', cadet.suffix_name || '',
            cadet.email || '', cadet.contact_number || '', cadet.address || '',
            cadet.course || '', cadet.year_level || '', cadet.school_year || '',
            cadet.battalion || '', cadet.company || '', cadet.platoon || '',
            cadet.cadet_course || '', cadet.semester || '',
            id
        ];

        db.run(sql, params, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
};

const upsertUser = (cadetId, studentId, email, customUsername, firstName) => {
    return new Promise(async (resolve, reject) => {
        try {
            const existingUser = await getUserByCadetId(cadetId);
            // Priority: Custom Username -> First Name -> Student ID
            const username = customUsername || firstName || studentId;
            
            if (!existingUser) {
                const dummyHash = '$2a$10$DUMMYPASSWORDHASHDO_NOT_USE_OR_YOU_WILL_BE_HACKED'; 
                db.run(`INSERT INTO users (username, password, role, cadet_id, is_approved, email) VALUES (?, ?, ?, ?, ?, ?)`, 
                    [username, dummyHash, 'cadet', cadetId, 1, email], 
                    (err) => {
                        if (err) {
                            if (err.message.includes('UNIQUE constraint failed')) {
                                console.warn(`Username ${username} already exists. Skipping user creation for ${studentId}.`);
                                resolve();
                            } else {
                                reject(err);
                            }
                        }
                        else {
                            // Initialize Grades
                            db.run(`INSERT INTO grades (cadet_id) VALUES (?)`, [cadetId], (err) => {
                                if (err) console.error("Error initializing grades", err);
                                resolve();
                            });
                        }
                    }
                );
            } else {
                let sql = `UPDATE users SET email = ?, is_approved = 1`;
                const params = [email];
                if (customUsername && customUsername !== existingUser.username) {
                    sql += `, username = ?`;
                    params.push(customUsername);
                }
                sql += ` WHERE id = ?`;
                params.push(existingUser.id);

                db.run(sql, params, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            }
        } catch (err) {
            reject(err);
        }
    });
};

const findColumnValue = (row, possibleNames) => {
    const keys = Object.keys(row);
    for (const key of keys) {
        const normalizedKey = key.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
        for (const name of possibleNames) {
            const normalizedName = name.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
            if (normalizedKey === normalizedName) return row[key];
        }
    }
    return undefined;
};

const processCadetData = async (data) => {
    let successCount = 0;
    let failCount = 0;
    const errors = [];

    for (const row of data) {
        const customUsername = findColumnValue(row, ['Username', 'username', 'User Name']);
        const email = findColumnValue(row, ['Email', 'email', 'E-mail']);
        let firstName = findColumnValue(row, ['First Name', 'first_name', 'FName', 'Given Name']);
        let lastName = findColumnValue(row, ['Last Name', 'last_name', 'LName', 'Surname']);
        let middleName = findColumnValue(row, ['Middle Name', 'middle_name', 'MName']) || '';
        const rank = findColumnValue(row, ['Rank', 'rank']) || 'Cdt';
        let rawStudentId = findColumnValue(row, ['Student ID', 'student_id', 'ID', 'Student Number']);
        
        // Handle "Name" or "Full Name" if separate fields are missing
        if (!firstName || !lastName) {
            const fullName = findColumnValue(row, ['Name', 'name', 'Full Name', 'Cadet Name']);
            if (fullName) {
                const parts = fullName.split(',').map(s => s.trim());
                if (parts.length >= 2) {
                    // Format: Last, First Middle
                    lastName = parts[0];
                    const rest = parts[1].split(' ');
                    firstName = rest[0];
                    middleName = rest.slice(1).join(' ');
                } else {
                    // Format: First Last (assuming last word is surname)
                    const spaceParts = fullName.split(' ');
                    if (spaceParts.length >= 2) {
                        lastName = spaceParts.pop();
                        firstName = spaceParts.join(' ');
                    } else {
                        firstName = fullName;
                        lastName = 'Unknown';
                    }
                }
            }
        }

        // Determine unique ID (Student ID > Username > Email > First Name hash)
        let studentId = rawStudentId || customUsername || email;
        
        if (!studentId && firstName) {
             studentId = firstName.trim().toLowerCase().replace(/[^a-z0-9]/g, '') + Math.floor(Math.random() * 1000);
        }

        if (!studentId) {
            failCount++;
            const availableKeys = Object.keys(row).join(', ');
            errors.push(`Could not determine identity (Missing Student ID, Username, Email, or Name). Found columns: ${availableKeys}`);
            continue;
        }

        const tempUsername = (studentId || '').toString().replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

        const cadetData = {
            student_id: studentId,
            last_name: lastName || 'Cadet',
            first_name: firstName || 'Unknown',
            middle_name: middleName,
            suffix_name: '',
            rank: rank,
            email: email || '',
            contact_number: '',
            address: '',
            course: '',
            year_level: '',
            school_year: '',
            battalion: '',
            company: '',
            platoon: '',
            cadet_course: '', 
            semester: ''
        };

        try {
            let cadetId;
            const existingCadet = await getCadetByStudentId(studentId);

            if (existingCadet) {
                cadetId = existingCadet.id;
                await updateCadet(cadetId, cadetData);
            } else {
                cadetId = await insertCadet(cadetData);
            }

            await upsertUser(cadetId, studentId, cadetData.email, customUsername, tempUsername);
            successCount++;
        } catch (err) {
            console.error(`Error processing ${studentId}:`, err);
            failCount++;
            errors.push(`${studentId}: ${err.message}`);
        }
    }
    return { successCount, failCount, errors };
};

// --- Test Execution ---

const mockData = [
    { 'Full Name': 'Doe, John', 'Email': 'john@example.com' }, // Should work
    { 'Name': 'Jane Smith', 'Student ID': '2023-0001' }, // Should work
    { 'First Name': 'Bob', 'Last Name': 'Builder', 'username': 'bob123' }, // Should work
    { 'Garbage': 'Data' } // Should fail gracefully
];

setTimeout(async () => {
    console.log('--- STARTING IMPORT SIMULATION ---');
    try {
        const result = await processCadetData(mockData);
        console.log('Result:', result);
    } catch (err) {
        console.error('Test Failed:', err);
    }
}, 1000); // Wait for DB connection
