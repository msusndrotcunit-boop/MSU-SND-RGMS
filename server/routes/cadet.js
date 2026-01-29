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
            
            // Aptitude: Base 100 + Merits - Demerits (Capped at 100)
            let rawAptitude = 100 + (gradeData.merit_points || 0) - (gradeData.demerit_points || 0);
            if (rawAptitude > 100) rawAptitude = 100;
            if (rawAptitude < 0) rawAptitude = 0;
            const aptitudeScore = rawAptitude * 0.3;

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

    db.get(`SELECT * FROM cadets WHERE id = ?`, [cadetId], (err, row) => {
        if (err) return res.status(500).json({ message: err.message });
        if (!row) return res.status(404).json({ message: 'Cadet not found' });
        res.json(row);
    });
});

router.put('/profile', upload.single('profilePic'), (req, res) => {
    const cadetId = req.user.cadetId;
    if (!cadetId) return res.status(403).json({ message: 'Not a cadet account' });

    // Check if profile is already locked
    db.get('SELECT profile_completed FROM cadets WHERE id = ?', [cadetId], (err, row) => {
        if (err) return res.status(500).json({ message: err.message });
        if (row && row.profile_completed === 1) {
            return res.status(403).json({ message: 'Profile is locked. You cannot edit it anymore.' });
        }

        const { 
            firstName, middleName, lastName, suffixName,
            email, contactNumber, address,
            course, yearLevel, schoolYear,
            battalion, company, platoon,
            cadetCourse, semester,
            studentId, username, password // New fields
        } = req.body;

        let sql = `UPDATE cadets SET 
            first_name=?, middle_name=?, last_name=?, suffix_name=?,
            email=?, contact_number=?, address=?,
            course=?, year_level=?, school_year=?,
            battalion=?, company=?, platoon=?,
            cadet_course=?, semester=?,
            profile_completed=1`;
        
        const params = [
            firstName, middleName, lastName, suffixName,
            email, contactNumber, address,
            course, yearLevel, schoolYear,
            battalion, company, platoon,
            cadetCourse, semester
        ];

        // Update Student ID if provided
        if (studentId) {
            sql += `, student_id=?`;
            params.push(studentId);
        }

        if (req.file) {
            sql += `, profile_pic=?`;
            // Convert buffer to Base64 Data URI
            const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
            params.push(base64Image);
        }

        sql += ` WHERE id=?`;
        params.push(cadetId);

        db.run(sql, params, async (err) => {
            if (err) return res.status(500).json({ message: err.message });

            // Update Users Table (Username / Password)
            if (username || password) {
                let userSql = `UPDATE users SET email = ?`;
                const userParams = [email]; // Always sync email

                if (username) {
                    userSql += `, username = ?`;
                    userParams.push(username);
                }

                if (password) {
                    try {
                        const hashedPassword = await bcrypt.hash(password, 10);
                        userSql += `, password = ?`;
                        userParams.push(hashedPassword);
                    } catch (hashErr) {
                        console.error("Password hashing error", hashErr);
                    }
                }

                userSql += ` WHERE cadet_id = ?`;
                userParams.push(cadetId);

                db.run(userSql, userParams, (uErr) => {
                    if (uErr) console.error("Error updating user credentials:", uErr);
                });
            }

            res.json({ 
                message: 'Profile updated', 
                profilePic: req.file ? `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}` : null,
                profileCompleted: 1
            });
        });
    });
});

router.get('/activities', (req, res) => {
    db.all(`SELECT * FROM activities ORDER BY date DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json(rows);
    });
});

module.exports = router;
