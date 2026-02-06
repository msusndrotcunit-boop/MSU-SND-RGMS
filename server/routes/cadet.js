const express = require('express');
const { upload } = require('../utils/cloudinary');
// const multer = require('multer'); // Removed local multer
const path = require('path');
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Multer Config Removed (Handled in utils/cloudinary)

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

    // Sync grade metrics from live data before returning
    db.get("SELECT COUNT(*) as total FROM training_days", [], (err, countRow) => {
        if (err) return res.status(500).json({ message: err.message });
        const totalTrainingDays = countRow.total || 15;
        
        db.get(`SELECT COUNT(*) as present FROM attendance_records WHERE cadet_id = ? AND status = 'present'`, [cadetId], (aErr, aRow) => {
            if (aErr) return res.status(500).json({ message: aErr.message });
            const attendancePresent = aRow?.present || 0;
            
            db.get(`SELECT COALESCE(SUM(points),0) as merit FROM merit_demerit_logs WHERE cadet_id = ? AND type = 'merit'`, [cadetId], (mErr, mRow) => {
                if (mErr) return res.status(500).json({ message: mErr.message });
                const meritPoints = mRow?.merit || 0;
                
                db.get(`SELECT COALESCE(SUM(points),0) as demerit FROM merit_demerit_logs WHERE cadet_id = ? AND type = 'demerit'`, [cadetId], (dErr, dRow) => {
                    if (dErr) return res.status(500).json({ message: dErr.message });
                    const demeritPoints = dRow?.demerit || 0;
                    
                    db.get(`SELECT * FROM grades WHERE cadet_id = ?`, [cadetId], (gErr, gradeRow) => {
                        if (gErr) return res.status(500).json({ message: gErr.message });
                        
                        const base = {
                            attendance_present: attendancePresent,
                            merit_points: meritPoints,
                            demerit_points: demeritPoints,
                            prelim_score: gradeRow?.prelim_score || 0,
                            midterm_score: gradeRow?.midterm_score || 0,
                            final_score: gradeRow?.final_score || 0,
                            status: gradeRow?.status || 'active'
                        };
                        
                        if (gradeRow) {
                            const updSql = `UPDATE grades SET attendance_present = ?, merit_points = ?, demerit_points = ? WHERE cadet_id = ?`;
                            db.run(updSql, [attendancePresent, meritPoints, demeritPoints, cadetId], (uErr) => {
                                if (uErr) return res.status(500).json({ message: uErr.message });
                                returnRespond(base, totalTrainingDays);
                            });
                        } else {
                            const insSql = `INSERT INTO grades (cadet_id, attendance_present, merit_points, demerit_points, prelim_score, midterm_score, final_score, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
                            db.run(insSql, [cadetId, attendancePresent, meritPoints, demeritPoints, 0, 0, 0, 'active'], (iErr) => {
                                if (iErr) return res.status(500).json({ message: iErr.message });
                                returnRespond(base, totalTrainingDays);
                            });
                        }
                    });
                });
            });
        });
        
        function returnRespond(gradeData, totalDays) {
            const safeTotalDays = totalDays > 0 ? totalDays : 1;
            const attendanceScore = (gradeData.attendance_present / safeTotalDays) * 30;
            
            let rawAptitude = 100 + (gradeData.merit_points || 0) - (gradeData.demerit_points || 0);
            if (rawAptitude > 100) rawAptitude = 100;
            if (rawAptitude < 0) rawAptitude = 0;
            const aptitudeScore = rawAptitude * 0.3;
            
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
        }
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

// Wrapper for upload middleware to handle errors gracefully
const uploadProfilePic = (req, res, next) => {
    upload.single('profilePic')(req, res, (err) => {
        if (err) {
            console.error("Profile Pic Upload Error:", err);
            // Return JSON error instead of 500 HTML
            const msg = err.message || 'Unknown upload error';
            return res.status(400).json({ message: `Image upload failed: ${msg}` });
        }
        next();
    });
};

router.put('/profile', uploadProfilePic, (req, res) => {
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

        // Ensure optional fields are null if undefined/empty strings (optional)
        // But mainly ensure they are NOT undefined for the DB driver
        const safeParam = (val) => val === undefined ? null : val;

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
                safeParam(firstName), safeParam(middleName), safeParam(lastName), safeParam(suffixName),
                safeParam(email), safeParam(contactNumber), safeParam(address),
                safeParam(course), safeParam(yearLevel), safeParam(schoolYear),
                safeParam(battalion), safeParam(company), safeParam(platoon),
                safeParam(cadetCourse), safeParam(semester)
            ];

            if (req.file) {
                sql += `, profile_pic=?`;
                let imageUrl = req.file.path; 
                
                // Normalize local path if needed (e.g. C:\Users\...\uploads\file.jpg -> /uploads/file.jpg)
                // But avoid modifying Cloudinary URLs which might contain 'uploads' in their path
                if (imageUrl.includes('uploads') && !imageUrl.startsWith('http')) {
                    const parts = imageUrl.split(/[\\/]/);
                    const uploadIndex = parts.indexOf('uploads');
                    if (uploadIndex !== -1) {
                        imageUrl = '/' + parts.slice(uploadIndex).join('/');
                    }
                }
                
                params.push(imageUrl);
            }
    
            // Set completion status if requested
            if (is_profile_completed === 'true') {
                sql += `, is_profile_completed=?`;
                // Use 1 for TRUE to be safe across SQLite/Postgres
                params.push(1);
            }
            
            sql += ` WHERE id=?`;
            params.push(cadetId);
    
            db.run(sql, params, (err) => {
                if (err) {
                    console.error("DB Update Error (Cadet Profile):", err);
                    return res.status(500).json({ message: "Database Error: " + err.message });
                }

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
                        
                        let returnPath = null;
                        if (req.file) {
                             returnPath = req.file.path;
                             // Apply same normalization for response
                             if (returnPath.includes('uploads')) {
                                 const parts = returnPath.split(/[\\/]/);
                                 const uploadIndex = parts.indexOf('uploads');
                                 if (uploadIndex !== -1) {
                                     returnPath = '/' + parts.slice(uploadIndex).join('/');
                                 }
                             }
                        }

                        res.json({ 
                            message: 'Profile updated successfully', 
                            profilePic: returnPath 
                        });
                    });
                } else {
                    let returnPath = null;
                    if (req.file) {
                         returnPath = req.file.path;
                         // Apply same normalization for response
                         if (returnPath.includes('uploads')) {
                             const parts = returnPath.split(/[\\/]/);
                             const uploadIndex = parts.indexOf('uploads');
                             if (uploadIndex !== -1) {
                                 returnPath = '/' + parts.slice(uploadIndex).join('/');
                             }
                         }
                    }

                    res.json({ 
                        message: 'Profile updated successfully', 
                        profilePic: returnPath 
                    });
                }
            });
        }
    });
});

router.get('/activities', (req, res) => {
    // Exclude image_path to reduce payload size
    db.all(`SELECT id, title, description, date FROM activities ORDER BY date DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json(rows);
    });
});

// Acknowledge User Guide
router.post('/acknowledge-guide', (req, res) => {
    const cadetId = req.user.cadetId;
    if (!cadetId) return res.status(403).json({ message: 'Access denied.' });
    
    db.run("UPDATE cadets SET has_seen_guide = TRUE WHERE id = ?", [cadetId], (err) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json({ message: 'User guide acknowledged' });
    });
});

// --- Notifications ---

// Get Notifications (Cadet)
router.get('/notifications', (req, res) => {
    // Fetch notifications where user_id is NULL (system/global) BUT only for relevant types (activity, announcement)
    // OR matches cadet's user ID (attendance, grades, etc.)
    const sql = `SELECT * FROM notifications WHERE (user_id IS NULL AND type IN ('activity', 'announcement')) OR user_id = ? ORDER BY created_at DESC LIMIT 50`;
    db.all(sql, [req.user.id], (err, rows) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json(rows);
    });
});

// Mark Notification as Read
router.put('/notifications/:id/read', (req, res) => {
    db.run(`UPDATE notifications SET is_read = TRUE WHERE id = ?`, [req.params.id], function(err) {
        if (err) return res.status(500).json({ message: err.message });
        res.json({ message: 'Marked as read' });
    });
});

// Mark All as Read
router.put('/notifications/read-all', (req, res) => {
    db.run(`UPDATE notifications SET is_read = TRUE WHERE ((user_id IS NULL AND type IN ('activity', 'announcement')) OR user_id = ?) AND is_read = FALSE`, [req.user.id], function(err) {
        if (err) return res.status(500).json({ message: err.message });
        res.json({ message: 'All marked as read' });
    });
});

module.exports = router;
