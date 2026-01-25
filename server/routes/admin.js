const express = require('express');
const db = require('../database');
const { authenticateToken, isAdmin } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
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
            const aptitudeScore = (cadet.merit_points - cadet.demerit_points) * 0.3; 
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

module.exports = router;
