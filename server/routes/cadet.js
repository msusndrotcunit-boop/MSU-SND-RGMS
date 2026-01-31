const express = require('express');
const multer = require('multer');
const path = require('path');
const db = require('../database');
const bcrypt = require('bcryptjs'); // Added bcrypt
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Multer Config
const storage = multer.memoryStorage();
const upload = multer({ 
    storage,
    limits: { fileSize: 5 * 1024 * 1024 } // Limit 5MB
});

router.use(authenticateToken);

// Helper: Transmuted Grade Logic (Consistent with admin.js)
const calculateTransmutedGrade = (finalGrade, status) => {
    if (status && ['DO', 'INC', 'T'].includes(status)) {
        return { transmutedGrade: status, remarks: 'Failed' };
    }

    let transmutedGrade = 5.00;
    let remarks = 'Failed';

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

router.get('/my-grades', (req, res) => {
    const cadetId = req.user.cadetId;
    if (!cadetId) return res.status(403).json({ message: 'Not a cadet account' });

    // 1. Get Total Training Days first
    db.get("SELECT COUNT(*) as total FROM training_days", [], (err, countRow) => {
        if (err) return res.status(500).json({ message: err.message });
        const totalTrainingDays = countRow.total || 15; // Default to 15

        db.get(`SELECT * FROM grades WHERE cadet_id = ?`, [cadetId], (err, row) => {
            if (err) return res.status(500).json({ message: err.message });
            
            // If no grades found, return default initialized structure
            const gradeData = row || {
                attendance_present: 0,
                merit_points: 0,
                demerit_points: 0,
                prelim_score: 0,
                midterm_score: 0,
                final_score: 0,
                status: 'active'
            };

            // Calculate Grades
            const safeTotalDays = totalTrainingDays > 0 ? totalTrainingDays : 1;
            const attendanceScore = (gradeData.attendance_present / safeTotalDays) * 30;

            // Aptitude: (Merit - Demerit) * 30% (Merit capped at 100)
            const cappedMerit = Math.min(gradeData.merit_points || 0, 100);
            const rawAptitude = cappedMerit - (gradeData.demerit_points || 0);
            const aptitudeScore = Math.max(0, rawAptitude * 0.3);

            // Subject: (Sum / 300) * 40%
            const subjectScore = ((gradeData.prelim_score + gradeData.midterm_score + gradeData.final_score) / 300) * 40;
            
            const finalGrade = attendanceScore + aptitudeScore + subjectScore;

            const { transmutedGrade, remarks } = calculateTransmutedGrade(finalGrade, gradeData.status);

            res.json({
                ...gradeData,
                attendanceScore,
                aptitudeScore,
                subjectScore,
                finalGrade,
                transmutedGrade,
                remarks
            });
        });
    });
});

// Get My Merit/Demerit Logs
router.get('/my-merit-logs', (req, res) => {
    const cadetId = req.user.cadetId;
    if (!cadetId) return res.status(403).json({ message: 'Not a cadet account' });

    db.all(`SELECT * FROM merit_demerit_logs WHERE cadet_id = ? ORDER BY date_recorded DESC`, [cadetId], (err, rows) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json(rows);
    });
});


router.get('/profile', (req, res) => {
    const cadetId = req.user.cadetId;
    if (!cadetId) return res.status(403).json({ message: 'Not a cadet account' });

    db.get(`SELECT c.*, u.username 
            FROM cadets c 
            LEFT JOIN users u ON u.cadet_id = c.id 
            WHERE c.id = ?`, [cadetId], (err, row) => {
        if (err) return res.status(500).json({ message: err.message });
        if (!row) return res.status(404).json({ message: 'Cadet not found' });
        res.json(row);
    });
});

router.put('/profile', upload.single('profilePic'), (req, res) => {
    const cadetId = req.user.cadetId;
    if (!cadetId) return res.status(403).json({ message: 'Not a cadet account' });

    // 1. Check if profile is already locked
    db.get('SELECT profile_completed, profile_pic FROM cadets WHERE id = ?', [cadetId], (err, row) => {
        if (err) return res.status(500).json({ message: err.message });
        if (!row) return res.status(404).json({ message: 'Cadet not found' });
        
        if (row.profile_completed === 1) {
            return res.status(403).json({ message: 'Profile is locked. Please contact an administrator to make changes.' });
        }

        // 2. Allow Update
        const { 
            firstName, middleName, lastName, suffixName, 
            email, contactNumber, address, 
            course, yearLevel, schoolYear, 
            battalion, company, platoon, 
            cadetCourse, semester,
            username
        } = req.body;

        // Check completion status
        const hasProfilePic = req.file || row.profile_pic;
        const requiredFields = [
            firstName, lastName, email, contactNumber, address, 
            course, yearLevel, schoolYear, 
            battalion, company, platoon, 
            cadetCourse, semester, username
        ];
        
        // Ensure all required fields are present and not empty strings
        const isComplete = hasProfilePic && requiredFields.every(f => f && f.toString().trim().length > 0);

        const performUpdate = () => {
            let sql = `UPDATE cadets SET 
                first_name = ?, middle_name = ?, last_name = ?, suffix_name = ?, 
                email = ?, contact_number = ?, address = ?, 
                course = ?, year_level = ?, school_year = ?, 
                battalion = ?, company = ?, platoon = ?, 
                cadet_course = ?, semester = ?,
                profile_completed = ?`;
            
            const params = [
                firstName, middleName || '', lastName, suffixName || '',
                email, contactNumber || '', address || '',
                course || '', yearLevel || '', schoolYear || '',
                battalion || '', company || '', platoon || '',
                cadetCourse || '', semester || '',
                isComplete ? 1 : 0
            ];

            if (req.file) {
                sql += `, profile_pic = ?`;
                params.push(req.file.filename); // Assuming storage engine gives filename
            }

            sql += ` WHERE id = ?`;
            params.push(cadetId);

            db.run(sql, params, function(err) {
                if (err) return res.status(500).json({ message: err.message });
                
                // Update users table (email and username)
                if (email || username) {
                    let uSql = "UPDATE users SET ";
                    let uParams = [];
                    
                    if (email) {
                        uSql += "email = ?";
                        uParams.push(email);
                    }
                    
                    if (username) {
                        if (email) uSql += ", ";
                        uSql += "username = ?";
                        uParams.push(username);
                    }
                    
                    uSql += " WHERE cadet_id = ?";
                    uParams.push(cadetId);
                    
                    db.run(uSql, uParams, (uErr) => {
                        if (uErr) console.error("Error syncing users table:", uErr);
                    });
                }

                if (isComplete) {
                    res.json({ message: 'Profile updated and locked successfully. You must now login with your new credentials.' });
                } else {
                    res.json({ message: 'Profile updated. Please complete all fields and upload a profile picture to finalize registration.' });
                }
            });
        };

        if (username) {
            // Check if username is taken by another user
            db.get('SELECT id FROM users WHERE username = ? AND cadet_id != ?', [username, cadetId], (uErr, uRow) => {
                if (uErr) return res.status(500).json({ message: uErr.message });
                if (uRow) return res.status(400).json({ message: 'Username already taken.' });
                performUpdate();
            });
        } else {
            performUpdate();
        }
    });
});

router.get('/activities', (req, res) => {
    db.all(`SELECT * FROM activities ORDER BY date DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json(rows);
    });
});

router.post('/onboard', async (req, res) => {
    // This endpoint creates a NEW cadet and NEW user account from the onboarding form
    const { 
        firstName, lastName, studentId, email, 
        username, password, 
        middleName, suffixName, contactNumber, address,
        course, yearLevel, schoolYear,
        battalion, company, platoon,
        cadetCourse, semester
    } = req.body;

    if (!firstName || !lastName || !studentId || !email || !username || !password) {
        return res.status(400).json({ message: 'Missing required fields' });
    }

    try {
        // 1. Check if username or student ID or email already exists
        const checkSql = `SELECT * FROM users WHERE username = ? OR email = ?`;
        const checkCadetSql = `SELECT * FROM cadets WHERE student_id = ? OR email = ?`;
        
        // Helper for check
        const checkExists = (sql, params) => {
            return new Promise((resolve, reject) => {
                db.get(sql, params, (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });
        };

        const existingUser = await checkExists(checkSql, [username, email]);
        if (existingUser) {
            return res.status(400).json({ message: 'Username or Email already taken' });
        }

        const existingCadet = await checkExists(checkCadetSql, [studentId, email]);
        if (existingCadet) {
            return res.status(400).json({ message: 'Student ID or Email already registered' });
        }

        // 2. Insert New Cadet
        const insertCadetSql = `INSERT INTO cadets (
            student_id, first_name, middle_name, last_name, suffix_name, 
            email, contact_number, address, 
            course, year_level, school_year, 
            battalion, company, platoon, 
            cadet_course, semester, status, rank
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

        const cadetParams = [
            studentId, firstName, middleName || '', lastName, suffixName || '',
            email, contactNumber || '', address || '',
            course || '', yearLevel || '', schoolYear || '',
            battalion || '', company || '', platoon || '',
            cadetCourse || '', semester || '', 'Ongoing', 'CDT'
        ];

        // Wrap db.run for async
        const runQuery = (sql, params) => {
            return new Promise((resolve, reject) => {
                db.run(sql, params, function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                });
            });
        };

        const newCadetId = await runQuery(insertCadetSql, cadetParams);

        // 3. Insert New User
        const hashedPassword = await bcrypt.hash(password, 10);
        const insertUserSql = `INSERT INTO users (
            username, password, role, cadet_id, is_approved, email
        ) VALUES (?, ?, 'cadet', ?, 1, ?)`;

        await runQuery(insertUserSql, [username, hashedPassword, newCadetId, email]);
        
        // 4. Initialize Grades (optional but good practice)
        await runQuery(`INSERT INTO grades (cadet_id) VALUES (?)`, [newCadetId]);

        res.status(201).json({ message: 'Registration successful. Please login with your new credentials.' });

    } catch (err) {
        console.error('Onboarding Error:', err);
        res.status(500).json({ message: 'Server error during registration: ' + err.message });
    }
});

module.exports = router;
