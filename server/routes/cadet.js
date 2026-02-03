const express = require('express');
const multer = require('multer');
const path = require('path');
const db = require('../database');
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

    const sql = `
        SELECT c.*, u.username 
        FROM cadets c 
        LEFT JOIN users u ON u.cadet_id = c.id 
        WHERE c.id = ?
    `;

    db.get(sql, [cadetId], (err, row) => {
        if (err) return res.status(500).json({ message: err.message });
        if (!row) return res.status(404).json({ message: 'Cadet not found' });
        res.json(row);
    });
});

router.put('/profile', upload.single('profilePic'), (req, res) => {
    const cadetId = req.user.cadetId;
    if (!cadetId) return res.status(403).json({ message: 'Not a cadet account' });

    // 1. Check if profile is already locked
    db.get("SELECT is_profile_completed FROM cadets WHERE id = ?", [cadetId], (err, row) => {
        if (err) return res.status(500).json({ message: err.message });
        if (row && row.is_profile_completed) {
            return res.status(403).json({ message: 'Profile is locked and cannot be edited. Contact your administrator.' });
        }

        const { 
            username, // New credential
            firstName, middleName, lastName, suffixName,
            email, contactNumber, address,
            course, yearLevel, schoolYear,
            battalion, company, platoon,
            cadetCourse, semester,
            is_profile_completed // Frontend sends this as 'true'
        } = req.body;

        // 2. Mandatory Field Validation (Only if completing profile)
        if (is_profile_completed === 'true') {
            const requiredFields = [
                'username', 'firstName', 'lastName', 'email', 'contactNumber', 'address',
                'course', 'yearLevel', 'schoolYear', 'battalion', 'company', 'platoon',
                'cadetCourse', 'semester'
            ];
            
            const missing = requiredFields.filter(field => !req.body[field]);
            if (missing.length > 0) {
                return res.status(400).json({ message: `Missing required fields: ${missing.join(', ')}` });
            }

            // Check for duplicate username/email BEFORE updating
            // We need to check if the NEW username/email is already taken by ANOTHER user
            const checkSql = `SELECT id, cadet_id FROM users WHERE (username = ? OR email = ?)`;
            db.all(checkSql, [username, email], (checkErr, rows) => {
                if (checkErr) return res.status(500).json({ message: checkErr.message });
                
                const conflict = rows.find(r => r.cadet_id != cadetId);
                if (conflict) {
                    return res.status(400).json({ message: 'Username or Email is already taken by another user.' });
                }

                proceedWithUpdate();
            });
        } else {
            proceedWithUpdate();
        }

        function proceedWithUpdate() {
            let sql = `UPDATE cadets SET 
                first_name=?, middle_name=?, last_name=?, suffix_name=?,
                email=?, contact_number=?, address=?,
                course=?, year_level=?, school_year=?,
                battalion=?, company=?, platoon=?,
                cadet_course=?, semester=?`;
            
            const params = [
                firstName, middleName, lastName, suffixName,
                email, contactNumber, address,
                course, yearLevel, schoolYear,
                battalion, company, platoon,
                cadetCourse, semester
            ];

            if (req.file) {
                sql += `, profile_pic=?`;
                const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
                params.push(base64Image);
            }
    
            // Set completion status if requested
            if (is_profile_completed === 'true') {
                sql += `, is_profile_completed=?`;
                params.push(true);
            }
            
            sql += ` WHERE id=?`;
            params.push(cadetId);
    
            db.run(sql, params, (err) => {
                if (err) return res.status(500).json({ message: err.message });

                // Notify Admin
                const notifMsg = `${firstName} ${lastName} has updated their profile.`;
                db.run(`INSERT INTO notifications (user_id, message, type) VALUES (NULL, ?, ?)`, 
                    [notifMsg, 'profile_update'], 
                    (nErr) => {
                         if (nErr) console.error("Error creating profile update notification:", nErr);
                    }
                );
    
                // 3. Update Users Table (Username/Email sync)
                if (username && email) {
                    const userSql = `UPDATE users SET username=?, email=? WHERE cadet_id=?`;
                    db.run(userSql, [username, email, cadetId], (uErr) => {
                        if (uErr) console.error("Error updating user credentials:", uErr);
                        // If this fails now, it's likely a DB constraint we missed or connection issue.
                        // Since we checked for conflicts, it should pass.
                        
                        res.json({ 
                            message: 'Profile updated successfully', 
                            profilePic: req.file ? `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}` : null 
                        });
                    });
                } else {
                    res.json({ 
                        message: 'Profile updated successfully', 
                        profilePic: req.file ? `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}` : null 
                    });
                }
            });
        }
    });
});

router.get('/activities', (req, res) => {
    db.all(`SELECT * FROM activities ORDER BY date DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json(rows);
    });
});

// Acknowledge User Guide
router.post('/acknowledge-guide', (req, res) => {
    const cadetId = req.user.cadetId;
    if (!cadetId) return res.status(403).json({ message: 'Access denied.' });
    
    db.run("UPDATE cadets SET has_seen_guide = 1 WHERE id = ?", [cadetId], (err) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json({ message: 'User guide acknowledged' });
    });
});

// --- Notifications ---

// Get Notifications (Cadet)
router.get('/notifications', (req, res) => {
    // Fetch notifications where user_id is NULL (system/global) or matches cadet's user ID
    const sql = `SELECT * FROM notifications WHERE user_id IS NULL OR user_id = ? ORDER BY created_at DESC LIMIT 50`;
    db.all(sql, [req.user.id], (err, rows) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json(rows);
    });
});

// Mark Notification as Read
router.put('/notifications/:id/read', (req, res) => {
    db.run(`UPDATE notifications SET is_read = 1 WHERE id = ?`, [req.params.id], function(err) {
        if (err) return res.status(500).json({ message: err.message });
        res.json({ message: 'Marked as read' });
    });
});

// Mark All as Read
router.put('/notifications/read-all', (req, res) => {
    db.run(`UPDATE notifications SET is_read = 1 WHERE (user_id IS NULL OR user_id = ?) AND is_read = 0`, [req.user.id], function(err) {
        if (err) return res.status(500).json({ message: err.message });
        res.json({ message: 'All marked as read' });
    });
});

module.exports = router;
