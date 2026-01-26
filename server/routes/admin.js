const express = require('express');
const db = require('../database');
const { authenticateToken, isAdmin } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const xlsx = require('xlsx');
const pdfParse = require('pdf-parse');
const { sendEmail } = require('../utils/emailService');

const router = express.Router();

// Multer Setup (Memory Storage for Base64)
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

router.use(authenticateToken);
router.use(isAdmin);

// --- Import Official Cadet List ---

router.post('/import-cadets', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    try {
        let data = [];
        
        // Check file type
        if (req.file.mimetype === 'application/pdf' || req.file.originalname.toLowerCase().endsWith('.pdf')) {
            try {
                const dataBuffer = req.file.buffer;
                const pdfData = await pdfParse(dataBuffer);
                const text = pdfData.text;
                const lines = text.split('\n');
                
                lines.forEach(line => {
                    // Heuristic extraction
                    // Look for Student ID (Sequence of digits, possibly with dashes, e.g. 2023-0001 or 12345678)
                    // We assume Student ID is the primary identifier.
                    const idMatch = line.match(/\b\d{4}[-]?\d{3,}\b/);
                    
                    if (idMatch) {
                        const studentId = idMatch[0];
                        
                        // Look for Email
                        const emailMatch = line.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
                        const email = emailMatch ? emailMatch[0] : '';
                        
                        // Remove ID and Email to isolate Name
                        let cleanLine = line.replace(studentId, '').replace(email, '').trim();
                        
                        // Attempt to extract Name (Last, First format preferred)
                        let lastName = cleanLine;
                        let firstName = '';
                        let middleName = '';
                        
                        if (cleanLine.includes(',')) {
                            const parts = cleanLine.split(',');
                            lastName = parts[0].trim();
                            const rest = parts.slice(1).join(' ').trim();
                            // Split rest into First and Middle? 
                            // Simple heuristic: Last word is middle name if > 1 word? No, risky.
                            // Just put rest in First Name
                            firstName = rest;
                        } else {
                            // If no comma, assume "First Middle Last" or "Last First"? 
                            // Without comma, it's ambiguous. We'll put everything in Last Name to be safe, 
                            // or try to split by space.
                            // Let's assume standard "Last Name, First Name" is the ROTCMIS format. 
                            // If not, users should verify.
                        }

                        data.push({
                            'Student ID': studentId,
                            'Email': email,
                            'Last Name': lastName,
                            'First Name': firstName,
                            'Middle Name': middleName
                        });
                    }
                });

                if (data.length === 0) {
                    throw new Error("No cadet records detected in PDF. Ensure the PDF contains text lines with Student IDs (e.g., 2023-1234).");
                }

            } catch (err) {
                console.error("PDF Parse Error", err);
                return res.status(400).json({ message: 'Failed to parse PDF: ' + err.message });
            }
        } else {
            // Excel/CSV Parsing
            const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            data = xlsx.utils.sheet_to_json(sheet);
        }

        let successCount = 0;
        let failCount = 0;
        const errors = [];

        // DB Helpers (Promisified)
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
                    cadet_course, semester, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

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

        const upsertUser = (cadetId, studentId, email) => {
            return new Promise(async (resolve, reject) => {
                try {
                    const existingUser = await getUserByCadetId(cadetId);
                    // Use Student ID as username
                    const username = studentId;
                    
                    if (!existingUser) {
                        // Create User
                        // is_approved = 1 (Auto-approved since imported by admin)
                        // password = NULL (or a default hash if DB requires NOT NULL). 
                        // Since we are doing "no password login", we can set a dummy unguessable password 
                        // OR modify DB schema. Let's set a dummy hash for now to satisfy NOT NULL constraints if any.
                        // But wait, user schema might require password.
                        // Let's use a dummy password that no one knows.
                        const dummyHash = '$2a$10$DUMMYPASSWORDHASHDO_NOT_USE_OR_YOU_WILL_BE_HACKED'; 

                        db.run(`INSERT INTO users (username, password, role, cadet_id, is_approved, email) VALUES (?, ?, ?, ?, ?, ?)`, 
                            [username, dummyHash, 'cadet', cadetId, 1, email], 
                            (err) => {
                                if (err) reject(err);
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
                        // Update Email and Ensure Approved
                        db.run(`UPDATE users SET email = ?, is_approved = 1 WHERE id = ?`, [email, existingUser.id], (err) => {
                            if (err) reject(err);
                            else resolve();
                        });
                    }
                } catch (err) {
                    reject(err);
                }
            });
        };

        for (const row of data) {
            // Mapping Logic: Expect headers like "Student ID", "Last Name", etc.
            const studentId = row['Student ID'] || row['student_id'] || row['ID'];
            
            if (!studentId) {
                failCount++;
                errors.push("Missing Student ID");
                continue;
            }

            const cadetData = {
                student_id: studentId,
                last_name: row['Last Name'] || row['last_name'] || row['Surname'] || '',
                first_name: row['First Name'] || row['first_name'] || '',
                middle_name: row['Middle Name'] || row['middle_name'] || '',
                suffix_name: row['Suffix'] || row['suffix_name'] || '',
                rank: row['Rank'] || row['rank'] || '',
                email: row['Email'] || row['email'] || '',
                contact_number: row['Contact Number'] || row['contact_number'] || '',
                address: row['Address'] || row['address'] || '',
                course: row['Course'] || row['course'] || '',
                year_level: row['Year Level'] || row['year_level'] || '',
                school_year: row['School Year'] || row['school_year'] || '',
                battalion: row['Battalion'] || row['battalion'] || '',
                company: row['Company'] || row['company'] || '',
                platoon: row['Platoon'] || row['platoon'] || '',
                cadet_course: row['Cadet Course'] || row['cadet_course'] || '', // MS1, MS2...
                semester: row['Semester'] || row['semester'] || ''
            };

            const customUsername = row['Username'] || row['username'] || '';

            try {
                let cadetId;
                const existingCadet = await getCadetByStudentId(studentId);

                if (existingCadet) {
                    cadetId = existingCadet.id;
                    await updateCadet(cadetId, cadetData);
                } else {
                    cadetId = await insertCadet(cadetData);
                }

                // Ensure User account exists for login
                await upsertUser(cadetId, studentId, cadetData.email, customUsername);

                successCount++;
            } catch (err) {
                console.error(`Error processing ${studentId}:`, err);
                failCount++;
                errors.push(`${studentId}: ${err.message}`);
            }
        }

        res.json({ 
            message: `Import complete. Success: ${successCount}, Failed: ${failCount}`,
            errors: errors.slice(0, 10)
        });

    } catch (error) {
        console.error('Import error:', error);
        res.status(500).json({ message: 'Failed to process file' });
    }
});

// Helper: Transmuted Grade Logic
const calculateTransmutedGrade = (finalGrade, status) => {
    // Priority to status
    if (status && ['DO', 'INC', 'T'].includes(status)) {
        return { transmutedGrade: status, remarks: 'Failed' };
    }

    let transmutedGrade = 5.00;
    let remarks = 'Failed';

    // 98-100 = 1.00
    if (finalGrade >= 98) { transmutedGrade = 1.00; remarks = 'Passed'; }
    else if (finalGrade >= 95) { transmutedGrade = 1.25; remarks = 'Passed'; }
    else if (finalGrade >= 92) { transmutedGrade = 1.50; remarks = 'Passed'; }
    else if (finalGrade >= 89) { transmutedGrade = 1.75; remarks = 'Passed'; }
    else if (finalGrade >= 86) { transmutedGrade = 2.00; remarks = 'Passed'; }
    else if (finalGrade >= 83) { transmutedGrade = 2.25; remarks = 'Passed'; }
    else if (finalGrade >= 80) { transmutedGrade = 2.50; remarks = 'Passed'; }
    else if (finalGrade >= 77) { transmutedGrade = 2.75; remarks = 'Passed'; }
    else if (finalGrade >= 75) { transmutedGrade = 3.00; remarks = 'Passed'; }
    
    return { transmutedGrade: typeof transmutedGrade === 'number' ? transmutedGrade.toFixed(2) : transmutedGrade, remarks };
};

// --- Analytics ---

// Get Dashboard Analytics
router.get('/analytics', (req, res) => {
    const analyticsData = {
        attendance: [],
        grades: { passed: 0, failed: 0, incomplete: 0 }
    };

    // 1. Get Attendance Stats (Last 10 training days)
    const attendanceSql = `
        SELECT 
            td.date, 
            COUNT(CASE WHEN ar.status = 'Present' THEN 1 END) as present,
            COUNT(CASE WHEN ar.status = 'Absent' THEN 1 END) as absent
        FROM training_days td
        LEFT JOIN attendance_records ar ON td.id = ar.training_day_id
        GROUP BY td.id
        ORDER BY td.date DESC
        LIMIT 10
    `;

    db.all(attendanceSql, [], (err, attendanceRows) => {
        if (err) return res.status(500).json({ message: err.message });
        
        analyticsData.attendance = attendanceRows.reverse(); // Show oldest to newest in chart

        // 2. Get Grade Stats (Reuse cadet grade logic)
        const cadetsSql = `
            SELECT c.*, 
                   g.attendance_present, g.merit_points, g.demerit_points, 
                   g.prelim_score, g.midterm_score, g.final_score, g.status as grade_status
            FROM cadets c
            JOIN users u ON u.cadet_id = c.id
            LEFT JOIN grades g ON c.id = g.cadet_id
            WHERE u.is_approved = 1
        `;

        db.all(cadetsSql, [], (err, cadetRows) => {
            if (err) return res.status(500).json({ message: err.message });

            cadetRows.forEach(cadet => {
                const attendanceScore = (cadet.attendance_present / 15) * 30;
                const aptitudeScore = (cadet.merit_points - cadet.demerit_points) * 0.3;
                const subjectScore = ((cadet.prelim_score + cadet.midterm_score + cadet.final_score) / 300) * 40;
                const finalGrade = attendanceScore + aptitudeScore + subjectScore;
                
                const { remarks } = calculateTransmutedGrade(finalGrade, cadet.grade_status);

                if (remarks === 'Passed') analyticsData.grades.passed++;
                else if (remarks === 'Failed') analyticsData.grades.failed++;
                // Note: Logic implies 'Failed' catches INC/DO/T unless handled specifically, 
                // but calculateTransmutedGrade marks them as 'Failed'.
                // If we want separate INC counts, we need to check grade_status directly.
                if (['INC', 'DO', 'T'].includes(cadet.grade_status)) {
                    analyticsData.grades.incomplete++;
                    analyticsData.grades.failed--; // Adjust failed count if we want exclusive categories
                }
            });

            res.json(analyticsData);
        });
    });
});

// --- Cadet Management ---

// Create Single Cadet (Manual Add)
router.post('/cadets', async (req, res) => {
    const cadet = req.body;
    
    // Validate required fields
    if (!cadet.studentId || !cadet.lastName || !cadet.firstName) {
        return res.status(400).json({ message: 'Student ID, Last Name, and First Name are required' });
    }

    try {
        // Check if student ID exists
        const checkSql = 'SELECT id FROM cadets WHERE student_id = ?';
        db.get(checkSql, [cadet.studentId], (err, row) => {
            if (err) return res.status(500).json({ message: err.message });
            if (row) return res.status(400).json({ message: 'Cadet with this Student ID already exists' });

            // Insert Cadet
            const insertSql = `INSERT INTO cadets (
                rank, first_name, middle_name, last_name, suffix_name, 
                student_id, email, contact_number, address, 
                course, year_level, school_year, 
                battalion, company, platoon, 
                cadet_course, semester, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

            const params = [
                cadet.rank || '', cadet.firstName || '', cadet.middleName || '', cadet.lastName || '', cadet.suffixName || '',
                cadet.studentId, cadet.email || '', cadet.contactNumber || '', cadet.address || '',
                cadet.course || '', cadet.yearLevel || '', cadet.schoolYear || '',
                cadet.battalion || '', cadet.company || '', cadet.platoon || '',
                cadet.cadetCourse || '', cadet.semester || '', cadet.status || 'Ongoing'
            ];

            db.run(insertSql, params, function(err) {
                if (err) return res.status(500).json({ message: err.message });
                const newCadetId = this.lastID;

                // Create User Account (Auto-approved)
                const username = cadet.studentId; // Default username
                const dummyHash = '$2a$10$DUMMYPASSWORDHASHDO_NOT_USE_OR_YOU_WILL_BE_HACKED';
                
                db.run(`INSERT INTO users (username, password, role, cadet_id, is_approved, email) VALUES (?, ?, ?, ?, ?, ?)`, 
                    [username, dummyHash, 'cadet', newCadetId, 1, cadet.email || ''], 
                    (err) => {
                        if (err) console.error("Error creating user for new cadet:", err);
                        
                        // Initialize Grades
                        db.run(`INSERT INTO grades (cadet_id) VALUES (?)`, [newCadetId], (err) => {
                            if (err) console.error("Error initializing grades:", err);
                            res.status(201).json({ message: 'Cadet created successfully', id: newCadetId });
                        });
                    }
                );
            });
        });
    } catch (error) {
        console.error("Create cadet error:", error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Get All Cadets (with computed grades) - ONLY APPROVED
router.get('/cadets', (req, res) => {
    const sql = `
        SELECT c.*, 
               g.attendance_present, g.merit_points, g.demerit_points, 
               g.prelim_score, g.midterm_score, g.final_score, g.status as grade_status
        FROM cadets c
        JOIN users u ON u.cadet_id = c.id
        LEFT JOIN grades g ON c.id = g.cadet_id
        WHERE u.is_approved = 1
    `;
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ message: err.message });
        
        // Calculate grades for each cadet
        const cadetsWithGrades = rows.map(cadet => {
            const attendanceScore = (cadet.attendance_present / 15) * 30; // 30%
            // Base Aptitude 100
            const aptitudeScore = Math.max(0, (100 + cadet.merit_points - cadet.demerit_points)) * 0.3; 
            const subjectScore = ((cadet.prelim_score + cadet.midterm_score + cadet.final_score) / 300) * 40; // 40%

            const finalGrade = attendanceScore + aptitudeScore + subjectScore;
            
            // Use grade_status from join, not cadet.status (which is enrollment status)
            const { transmutedGrade, remarks } = calculateTransmutedGrade(finalGrade, cadet.grade_status);

            return {
                ...cadet,
                attendanceScore,
                aptitudeScore,
                subjectScore,
                finalGrade,
                transmutedGrade,
                remarks
            };
        });

        res.json(cadetsWithGrades);
    });
});

// Update Cadet Personal Info
router.put('/cadets/:id', (req, res) => {
    const { 
        rank, firstName, middleName, lastName, suffixName, 
        studentId, email, contactNumber, address, 
        course, yearLevel, schoolYear, 
        battalion, company, platoon, 
        cadetCourse, semester, status 
    } = req.body;

    const sql = `UPDATE cadets SET 
        rank=?, first_name=?, middle_name=?, last_name=?, suffix_name=?, 
        student_id=?, email=?, contact_number=?, address=?, 
        course=?, year_level=?, school_year=?, 
        battalion=?, company=?, platoon=?, 
        cadet_course=?, semester=?, status=? 
        WHERE id=?`;

    const params = [
        rank, firstName, middleName, lastName, suffixName, 
        studentId, email, contactNumber, address, 
        course, yearLevel, schoolYear, 
        battalion, company, platoon, 
        cadetCourse, semester, status, 
        req.params.id
    ];

    db.run(sql, params, (err) => {
            if (err) return res.status(500).json({ message: err.message });
            res.json({ message: 'Cadet updated' });
        }
    );
});

// Delete Cadet (Bulk)
router.post('/cadets/delete', (req, res) => {
    const { ids } = req.body; // Expecting array of IDs
    if (!ids || !Array.isArray(ids)) return res.status(400).json({ message: 'Invalid IDs' });

    const placeholders = ids.map(() => '?').join(',');
    const sql = `DELETE FROM cadets WHERE id IN (${placeholders})`;

    db.run(sql, ids, function(err) {
        if (err) return res.status(500).json({ message: err.message });
        res.json({ message: `Deleted ${this.changes} cadets` });
    });
});

// --- Grading Management ---

// Update Grades for a Cadet
router.put('/grades/:cadetId', (req, res) => {
    const { attendancePresent, meritPoints, demeritPoints, prelimScore, midtermScore, finalScore, status } = req.body;
    const cadetId = req.params.cadetId;

    db.run(`UPDATE grades SET 
            attendance_present = ?, 
            merit_points = ?, 
            demerit_points = ?, 
            prelim_score = ?, 
            midterm_score = ?, 
            final_score = ?,
            status = ?
            WHERE cadet_id = ?`,
        [attendancePresent, meritPoints, demeritPoints, prelimScore, midtermScore, finalScore, status || 'active', cadetId],
        function(err) {
            if (err) return res.status(500).json({ message: err.message });
            
            // Send Email Notification
            db.get(`SELECT email, first_name, last_name FROM cadets WHERE id = ?`, [cadetId], async (err, cadet) => {
                if (!err && cadet && cadet.email) {
                    const subject = 'ROTC Grading System - Grades Updated';
                    const text = `Dear ${cadet.first_name} ${cadet.last_name},\n\nYour grades have been updated by the admin.\n\nPlease log in to the portal to view your latest standing.\n\nRegards,\nROTC Admin`;
                    const html = `<p>Dear <strong>${cadet.first_name} ${cadet.last_name}</strong>,</p><p>Your grades have been updated by the admin.</p><p>Please log in to the portal to view your latest standing.</p><p>Regards,<br>ROTC Admin</p>`;
                    
                    await sendEmail(cadet.email, subject, text, html);
                }
                res.json({ message: 'Grades updated' });
            });
        }
    );
});

// --- Activity Management ---

// Upload Activity
router.post('/activities', upload.single('image'), (req, res) => {
    const { title, description, date } = req.body;
    
    // Convert buffer to Base64 Data URI if file exists
    let imagePath = null;
    if (req.file) {
        imagePath = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    }

    db.run(`INSERT INTO activities (title, description, date, image_path) VALUES (?, ?, ?, ?)`,
        [title, description, date, imagePath],
        function(err) {
            if (err) return res.status(500).json({ message: err.message });
            res.json({ id: this.lastID, message: 'Activity created' });
        }
    );
});

// Delete Activity
router.delete('/activities/:id', (req, res) => {
    db.run(`DELETE FROM activities WHERE id = ?`, [req.params.id], function(err) {
        if (err) return res.status(500).json({ message: err.message });
        res.json({ message: 'Activity deleted' });
    });
});

// --- User Management (Approvals) ---

// Get Users (filter by pending)
router.get('/users', (req, res) => {
    const { pending } = req.query;
    let sql = `SELECT u.id, u.username, u.role, u.is_approved, u.email, u.profile_pic, 
                      c.first_name, c.last_name, c.student_id 
               FROM users u
               LEFT JOIN cadets c ON u.cadet_id = c.id`;
    
    // Debug log to check database queries
    console.log(`Fetching users with pending=${pending}`);

    const params = [];
    if (pending === 'true') {
        sql += ` WHERE u.is_approved = 0`;
    }

    db.all(sql, params, (err, rows) => {
        if (err) {
            console.error('Error fetching users:', err);
            return res.status(500).json({ message: err.message });
        }
        console.log(`Found ${rows.length} users`);
        res.json(rows);
    });
});

// Approve User
router.put('/users/:id/approve', (req, res) => {
    db.run(`UPDATE users SET is_approved = 1 WHERE id = ?`, [req.params.id], function(err) {
        if (err) return res.status(500).json({ message: err.message });
        
        // Ensure grades record exists for the approved cadet
        db.get("SELECT cadet_id, email FROM users WHERE id = ?", [req.params.id], (err, user) => {
            if (user && user.cadet_id) {
                db.run("INSERT OR IGNORE INTO grades (cadet_id) VALUES (?)", [user.cadet_id], (err) => {
                    if (err) console.error("Error creating grades record:", err);
                });
                
                // Optional: Send welcome email
                if (user.email) {
                    sendEmail(
                        user.email, 
                        'Account Approved - ROTC Grading System',
                        'Your account has been approved. You can now login.',
                        '<p>Your account has been approved. You can now login.</p>'
                    );
                }
            }
        });

        res.json({ message: 'User approved' });
    });
});

// Delete User (Reject)
router.delete('/users/:id', (req, res) => {
    db.get("SELECT cadet_id FROM users WHERE id = ?", [req.params.id], (err, row) => {
        if (err) return res.status(500).json({ message: err.message });
        
        db.run(`DELETE FROM users WHERE id = ?`, [req.params.id], function(err) {
            if (err) return res.status(500).json({ message: err.message });
            
            if (row && row.cadet_id) {
                db.run(`DELETE FROM cadets WHERE id = ?`, [row.cadet_id], (err) => {
                   if (err) console.error("Error deleting cadet info", err);
                });
            }
            res.json({ message: 'User rejected/deleted' });
        });
    });
});

// --- Admin Profile ---

// Get Current Admin Profile
router.get('/profile', (req, res) => {
    db.get(`SELECT id, username, email, profile_pic FROM users WHERE id = ?`, [req.user.id], (err, row) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json(row);
    });
});

// Update Admin Profile (Pic)
router.put('/profile', upload.single('profilePic'), (req, res) => {
    const profilePic = req.file ? `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}` : null;
    
    if (profilePic) {
        db.run(`UPDATE users SET profile_pic = ? WHERE id = ?`, [profilePic, req.user.id], function(err) {
            if (err) return res.status(500).json({ message: err.message });
            res.json({ message: 'Profile updated', profilePic });
        });
    } else {
        res.status(400).json({ message: 'No file uploaded' });
    }
});

// --- Merit/Demerit Ledger ---

// Get Logs for a Cadet
router.get('/merit-logs/:cadetId', (req, res) => {
    const sql = `SELECT * FROM merit_demerit_logs WHERE cadet_id = ? ORDER BY date_recorded DESC`;
    db.all(sql, [req.params.cadetId], (err, rows) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json(rows);
    });
});

// Add Log Entry (and update Total)
router.post('/merit-logs', (req, res) => {
    const { cadetId, type, points, reason } = req.body;
    
    // 1. Insert Log
    db.run(`INSERT INTO merit_demerit_logs (cadet_id, type, points, reason) VALUES (?, ?, ?, ?)`, 
        [cadetId, type, points, reason], 
        function(err) {
            if (err) return res.status(500).json({ message: err.message });
            
            // 2. Update Total in Grades
            const column = type === 'merit' ? 'merit_points' : 'demerit_points';
            
            const updateGrades = () => {
                db.run(`UPDATE grades SET ${column} = ${column} + ? WHERE cadet_id = ?`, [points, cadetId], (err) => {
                    if (err) return res.status(500).json({ message: err.message });
                    
                    // 3. Send Email Notification
                    db.get(`SELECT email, first_name, last_name FROM cadets WHERE id = ?`, [cadetId], async (err, cadet) => {
                        if (!err && cadet && cadet.email) {
                            const subject = `ROTC System - New ${type === 'merit' ? 'Merit' : 'Demerit'} Record`;
                            const text = `Dear ${cadet.first_name} ${cadet.last_name},\n\nA new ${type} record has been added to your profile.\nPoints: ${points}\nReason: ${reason}\n\nPlease check your dashboard for details.\n\nRegards,\nROTC Admin`;
                            const html = `<p>Dear <strong>${cadet.first_name} ${cadet.last_name}</strong>,</p><p>A new <strong>${type}</strong> record has been added to your profile.</p><ul><li><strong>Points:</strong> ${points}</li><li><strong>Reason:</strong> ${reason}</li></ul><p>Please check your dashboard for details.</p><p>Regards,<br>ROTC Admin</p>`;
                            
                            await sendEmail(cadet.email, subject, text, html);
                        }
                        res.json({ message: 'Log added and points updated' });
                    });
                });
            };
            
            db.get(`SELECT id FROM grades WHERE cadet_id = ?`, [cadetId], (err, row) => {
                if (!row) {
                    // Create grade row first
                    db.run(`INSERT INTO grades (cadet_id) VALUES (?)`, [cadetId], (err) => {
                        if (err) return res.status(500).json({ message: 'Failed to init grades' });
                        updateGrades();
                    });
                } else {
                    updateGrades();
                }
            });
        }
    );
});

// Delete Merit/Demerit Log
router.delete('/merit-logs/:id', (req, res) => {
    const logId = req.params.id;

    // 1. Get the log details first to know what to subtract
    db.get(`SELECT * FROM merit_demerit_logs WHERE id = ?`, [logId], (err, log) => {
        if (err) return res.status(500).json({ message: err.message });
        if (!log) return res.status(404).json({ message: 'Log not found' });

        // 2. Delete the log
        db.run(`DELETE FROM merit_demerit_logs WHERE id = ?`, [logId], (err) => {
            if (err) return res.status(500).json({ message: err.message });

            // 3. Reverse the points in grades table
            const column = log.type === 'merit' ? 'merit_points' : 'demerit_points';
            
            db.run(`UPDATE grades SET ${column} = ${column} - ? WHERE cadet_id = ?`, [log.points, log.cadet_id], (err) => {
                if (err) console.error("Error updating grades after log deletion", err);
                res.json({ message: 'Log deleted and points reverted' });
            });
        });
    });
});

module.exports = router;
