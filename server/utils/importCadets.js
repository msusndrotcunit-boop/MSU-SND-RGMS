const xlsx = require('xlsx');
const pdfParse = require('pdf-parse');
const axios = require('axios');
const db = require('../database');
const bcrypt = require('bcryptjs');

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
<<<<<<< HEAD
            cadet_course, semester, status,
            is_profile_completed
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        
        // Fix: Explicitly cast boolean to integer (0/1) for SQLite/Postgres compatibility if needed, 
        // OR use 'false'/'true' literals if using strict Postgres driver that requires boolean types.
        // However, the error says: "column is boolean but expression is integer".
        // This implies the DB expects TRUE/FALSE but we are sending 0/1 (or vice-versa depending on driver).
        // Postgres pg driver usually handles true/false -> boolean.
        // Let's use boolean literals.
        
=======
            cadet_course, semester, status, is_profile_completed
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
>>>>>>> d84a7e1793311a5b46d3a3dca2e515967d01d196
        const params = [
            cadet.rank || '', cadet.first_name || '', cadet.middle_name || '', cadet.last_name || '', cadet.suffix_name || '',
            cadet.student_id, cadet.email || '', cadet.contact_number || '', cadet.address || '',
            cadet.course || '', cadet.year_level || '', cadet.school_year || '',
            cadet.battalion || '', cadet.company || '', cadet.platoon || '',
<<<<<<< HEAD
            cadet.cadet_course || '', cadet.semester || '', 'Ongoing',
            false // Send boolean false instead of integer 0
=======
            cadet.cadet_course || '', cadet.semester || '', 'Ongoing', false
>>>>>>> d84a7e1793311a5b46d3a3dca2e515967d01d196
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
            
            // Generate username: Use customUsername (from CSV) -> firstName -> studentId
            const generateBaseUsername = () => {
                if (customUsername) return customUsername;
                if (firstName) return firstName;
                return studentId;
            };
            
            const baseUsername = generateBaseUsername();

            if (!existingUser) {
                const dummyHash = '$2a$10$DUMMYPASSWORDHASHDO_NOT_USE_OR_YOU_WILL_BE_HACKED';
                
                const insertUser = (uName) => {
                    db.run(`INSERT INTO users (username, password, role, cadet_id, is_approved, email) VALUES (?, ?, ?, ?, ?, ?)`, 
                    [uName, dummyHash, 'cadet', cadetId, 0, email], 
                    (err) => {
                            if (err) {
                                if (err.message.includes('UNIQUE constraint') || err.message.includes('duplicate key')) {
                                    const newUsername = uName + Math.floor(Math.random() * 1000);
                                    insertUser(newUsername);
                                } else {
                                    reject(err);
                                }
                            }
                            else {
                                db.run(`INSERT INTO grades (cadet_id) VALUES (?)`, [cadetId], (err) => {
                                    resolve();
                                });
                            }
                        }
                    );
                };
                insertUser(baseUsername);
            } else {
                let sql = `UPDATE users SET email = ?, is_approved = 0`;
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

const getCadetByName = (firstName, lastName, middleName) => {
    return new Promise((resolve, reject) => {
        let sql = 'SELECT * FROM cadets WHERE first_name = ? AND last_name = ?';
        let params = [firstName, lastName];
        
        if (middleName) {
            sql += ' AND middle_name = ?';
            params.push(middleName);
        }
        
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

const processCadetData = async (data) => {
    let successCount = 0;
    let failCount = 0;
    const errors = [];
    for (const row of data) {
        const email = findColumnValue(row, ['Email', 'email', 'E-mail']);
        let studentId = findColumnValue(row, ['Student ID', 'student_id', 'ID', 'StudentId']);
        let csvUsername = findColumnValue(row, ['Username', 'username', 'User Name']);

        if (!studentId && csvUsername) {
            studentId = csvUsername;
        }
        
        const customUsername = csvUsername;
        
        if (!studentId && email) {
            studentId = email;
        }
        
        let lastName = findColumnValue(row, ['Last Name', 'last_name', 'Surname', 'LName']);
        let firstName = findColumnValue(row, ['First Name', 'first_name', 'FName']);
        let middleName = findColumnValue(row, ['Middle Name', 'middle_name', 'MName']) || '';

        const capitalize = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : '';
        if (firstName) firstName = firstName.split(' ').map(capitalize).join(' ');
        if (lastName) lastName = lastName.split(' ').map(capitalize).join(' ');

        if (!studentId && (!firstName || !lastName)) {
            failCount++;
            const availableKeys = Object.keys(row).join(', ');
            errors.push(`Missing Student ID or Name. Found columns: ${availableKeys}`);
            continue;
        }

        if (!studentId && firstName && lastName) {
            const cleanFirst = firstName.toLowerCase().replace(/[^a-z0-9]/g, '');
            const cleanLast = lastName.toLowerCase().replace(/[^a-z0-9]/g, '');
            studentId = `${cleanFirst}.${cleanLast}`;
        }

        const cadetData = {
            student_id: studentId,
            last_name: lastName,
            first_name: firstName,
            middle_name: middleName,
            suffix_name: findColumnValue(row, ['Suffix', 'suffix_name']) || '',
            rank: findColumnValue(row, ['Rank', 'rank']) || 'Cdt',
            email: email || '',
            contact_number: findColumnValue(row, ['Contact Number', 'contact_number', 'Mobile', 'Phone']) || '',
            address: findColumnValue(row, ['Address', 'address']) || '',
            course: findColumnValue(row, ['Course', 'course']) || '',
            year_level: findColumnValue(row, ['Year Level', 'year_level', 'Year']) || '',
            school_year: findColumnValue(row, ['School Year', 'school_year', 'SY']) || '',
            battalion: findColumnValue(row, ['Battalion', 'battalion']) || '',
            company: findColumnValue(row, ['Company', 'company']) || '',
            platoon: findColumnValue(row, ['Platoon', 'platoon']) || '',
            cadet_course: findColumnValue(row, ['Cadet Course', 'cadet_course']) || '',
            semester: findColumnValue(row, ['Semester', 'semester']) || ''
        };
        
        try {
            let cadetId;
            let existingCadet = null;
            
            if (studentId) {
                existingCadet = await getCadetByStudentId(studentId);
            }
            
            if (!existingCadet && firstName && lastName) {
                existingCadet = await getCadetByName(firstName, lastName, middleName);
            }
            
            if (existingCadet) {
                cadetId = existingCadet.id;
                await updateCadet(cadetId, cadetData);
            } else {
                if (studentId) {
                    cadetId = await insertCadet(cadetData);
                } else {
                    throw new Error("Cannot create new cadet without Student ID");
                }
            }
            
            const effectiveStudentId = existingCadet ? existingCadet.student_id : studentId;
            if (effectiveStudentId) {
                 await upsertUser(cadetId, effectiveStudentId, cadetData.email, customUsername, firstName);
            }
            
            successCount++;
        } catch (err) {
            failCount++;
            errors.push(`${studentId || firstName + ' ' + lastName}: ${err.message}`);
        }
    }
    return { successCount, failCount, errors };
};

const getStaffByName = (firstName, lastName) => {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM training_staff WHERE first_name = ? AND last_name = ?', [firstName, lastName], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

const insertTrainingStaff = (staff) => {
    return new Promise((resolve, reject) => {
        const sql = `INSERT INTO training_staff (rank, first_name, middle_name, last_name, suffix_name, email, contact_number, role) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
        const params = [
            staff.rank || '', staff.first_name, staff.middle_name || '', staff.last_name, staff.suffix_name || '',
            staff.email || null, staff.contact_number || '', staff.role || 'Instructor'
        ];
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve(this.lastID);
        });
    });
};

const upsertStaffUser = (staffId, email, customUsername, firstName, lastName) => {
    return new Promise(async (resolve, reject) => {
        // Clean names for username generation
        const cleanLast = lastName ? lastName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() : '';
        const cleanFirst = firstName ? firstName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() : '';
        
        const dummyHash = await bcrypt.hash('staff@2026', 10);
        
        db.get('SELECT * FROM users WHERE staff_id = ?', [staffId], (err, row) => {
            if (err) return reject(err);
            
            if (!row) {
                // Recursive function to handle username collisions
                // Priority: Last Name -> First Name -> Last.First -> Last + Random
                const tryInsertUser = (attemptStage, currentUsername) => {
                    db.run(`INSERT INTO users (username, password, role, staff_id, is_approved, email) VALUES (?, ?, 'training_staff', ?, 1, ?)`, 
                        [currentUsername, dummyHash, staffId, email], 
                        (err) => {
                            if (err) {
                                if (err.message.includes('UNIQUE constraint') || err.message.includes('duplicate key')) {
                                    console.log(`Username ${currentUsername} taken. Trying next option...`);
                                    
                                    if (attemptStage === 1) {
                                        // Failed Last Name, try First Name
                                        tryInsertUser(2, cleanFirst);
                                    } else if (attemptStage === 2) {
                                        // Failed First Name, try First.Last
                                        tryInsertUser(3, `${cleanFirst}.${cleanLast}`);
                                    } else {
                                        // Failed all standard options, append random number to Last Name
                                        const newUsername = cleanLast + Math.floor(Math.random() * 1000);
                                        tryInsertUser(4, newUsername);
                                    }
                                } else {
                                    reject(err);
                                }
                            } else {
                                resolve();
                            }
                        }
                    );
                };
                
                // Start with Last Name (Stage 1)
                // Use custom username if provided in import, otherwise use Last Name
                const initialUsername = customUsername || cleanLast;
                tryInsertUser(customUsername ? 4 : 1, initialUsername);
                
            } else {
                if (email) {
                     db.run(`UPDATE users SET email = ? WHERE id = ?`, [email, row.id], (err) => {
                         if (err) reject(err);
                         else resolve();
                     });
                } else {
                    resolve();
                }
            }
        });
    });
};

const processStaffData = async (data) => {
    let successCount = 0;
    let failCount = 0;
    const errors = [];
    
    for (const row of data) {
        let firstName = findColumnValue(row, ['First Name', 'first_name', 'FName', 'Given Name']);
        
        // Strict requirement: Just Rank, First Name, Username, Email
        // If First Name is missing, we can try to derive it or skip.
        // Let's assume First Name is required as per user instruction.
        
        if (!firstName) {
             failCount++;
             errors.push(`Missing First Name. Found columns: ${Object.keys(row).join(', ')}`);
             continue;
        }
        
        // Default Last Name since we are not importing it
        let lastName = 'Staff';
        let middleName = '';
        
        const email = findColumnValue(row, ['Email', 'email', 'E-mail']);
        const username = findColumnValue(row, ['Username', 'username', 'User Name']);
        const rank = findColumnValue(row, ['Rank', 'rank']) || 'Mr/Ms';
        
        const staffData = {
            rank: rank,
            first_name: firstName,
            middle_name: middleName,
            last_name: lastName,
            suffix_name: '',
            email: email || null,
            contact_number: '',
            role: 'Instructor' // Default role
        };
        
        try {
            let staffId;
            // Check by First Name only (and Last Name = 'Staff') or maybe just assume new if unique?
            // The getStaffByName uses (first, last). If we use 'Staff' as last name for all, 
            // we effectively check by First Name + 'Staff'.
            const existingStaff = await getStaffByName(firstName, lastName);
            
            if (existingStaff) {
                staffId = existingStaff.id;
            } else {
                staffId = await insertTrainingStaff(staffData);
            }
            
            await upsertStaffUser(staffId, email, username, firstName, lastName);
            successCount++;
        } catch (err) {
            failCount++;
            errors.push(`${firstName}: ${err.message}`);
        }
    }
    
    return { successCount, failCount, errors };
};

const getDirectDownloadUrl = (url) => {
    try {
        const urlObj = new URL(url);
        if (urlObj.hostname.includes('google.com')) {
            if (urlObj.pathname.includes('/spreadsheets/')) {
                return url.replace(/\/edit.*$/, '/export?format=xlsx');
            }
        }
        if (urlObj.hostname.includes('dropbox.com')) {
            if (url.includes('dl=1')) return url;
            if (url.includes('dl=0')) return url.replace('dl=0', 'dl=1');
            const separator = url.includes('?') ? '&' : '?';
            return `${url}${separator}dl=1`;
        }
        if (urlObj.hostname.includes('onedrive.live.com') || 
            urlObj.hostname.includes('sharepoint.com') || 
            urlObj.hostname.includes('1drv.ms')) {
            if (url.includes('/embed')) {
                return url.replace('/embed', '/download');
            }
            if (url.includes('/view.aspx')) {
                return url.replace('/view.aspx', '/download');
            }
            if (url.includes('/redir')) {
                return url.replace('/redir', '/download');
            }
            if (!url.includes('download=1') && !url.includes('action=download')) {
                 const separator = url.includes('?') ? '&' : '?';
                 return `${url}${separator}action=download`;
            }
        }
        return url;
    } catch (e) {
        return url;
    }
};

const parsePdfBuffer = async (buffer) => {
    try {
        const data = await pdfParse(buffer);
        const text = data.text;
        const lines = text.split('\n');
        const cadets = [];
        
        for (const line of lines) {
             const cleanLine = line.trim();
             if (!cleanLine) continue;
             if (cleanLine.match(/page|date|report|list/i)) continue;

             // Remove numbers/bullets
             const namePart = cleanLine.replace(/^[\d.)\-\s]+/, '').trim();
             
             // Very basic name extraction: "Last, First" or "First Last"
             // Prefer "Last, First" if comma exists
             if (namePart.includes(',')) {
                 const [last, first] = namePart.split(',').map(s => s.trim());
                 if (last && first) {
                     cadets.push({
                         'Last Name': last,
                         'First Name': first
                     });
                 }
             } else {
                 const parts = namePart.split(' ');
                 if (parts.length >= 2) {
                     const last = parts.pop();
                     const first = parts.join(' ');
                     cadets.push({
                         'Last Name': last,
                         'First Name': first
                     });
                 }
             }
        }
        return cadets;
    } catch (err) {
        console.error("PDF Parse Error:", err);
        return [];
    }
};

module.exports = {
    processCadetData,
    processStaffData,
    getDirectDownloadUrl,
    parsePdfBuffer
};
