const express = require('express');
const { upload, isCloudinaryConfigured } = require('../utils/cloudinary');
// const multer = require('multer'); // Removed local multer
const path = require('path');
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');
const { broadcastEvent } = require('../utils/sseHelper');
const { calculateTransmutedGrade } = require('../utils/gradesHelper');

const router = express.Router();

// Multer Config Removed (Handled in utils/cloudinary)

router.use(authenticateToken);

// Portal Access Telemetry
router.post('/access', (req, res) => {
    broadcastEvent({ type: 'portal_access', role: 'cadet', userId: req.user.id, cadetId: req.user.cadetId, at: Date.now() });
    db.run('INSERT INTO notifications (user_id, message, type) VALUES (NULL, ?, ?)', ['Cadet portal accessed', 'portal_access']);
    res.json({ message: 'access recorded' });
});
 

router.get('/my-grades', async (req, res) => {
    let cadetId = req.user.cadetId;
    
    // JWT Consistency fallback: If cadetId is missing in JWT, try to fetch it from DB using user.id
    if (!cadetId && req.user.role === 'cadet') {
        const userRow = await new Promise(resolve => {
            db.get(`SELECT cadet_id FROM users WHERE id = ?`, [req.user.id], (err, row) => resolve(row));
        });
        if (userRow && userRow.cadet_id) {
            cadetId = userRow.cadet_id;
        }
    }

    console.log(`[Cadet/Dashboard] User ID: ${req.user.id}, Role: ${req.user.role}, Resolved Cadet ID: ${cadetId}`);

    if (!cadetId) return res.status(403).json({ message: 'Not a cadet account' });
    const pGet = (sql, params = []) => new Promise(resolve => {
        db.get(sql, params, (err, row) => resolve(err ? undefined : row));
    });
    const pRun = (sql, params = []) => new Promise((resolve) => {
        db.run(sql, params, (err) => resolve(!err));
    });
    try {
        const countRow = await pGet("SELECT COUNT(*) as total FROM training_days", []);
        const totalTrainingDays = (countRow && (countRow.total ?? countRow.count)) ? Number(countRow.total ?? countRow.count) : 0;
        const aRow = await pGet(`SELECT COUNT(*) as present FROM attendance_records WHERE cadet_id = ? AND lower(status) IN ('present','excused')`, [cadetId]);
        const attendancePresent = aRow && (aRow.present ?? aRow.count) ? Number(aRow.present ?? aRow.count) : 0;
        const mRow = await pGet(`SELECT COALESCE(SUM(points),0) as merit FROM merit_demerit_logs WHERE cadet_id = ? AND type = 'merit'`, [cadetId]);
        const meritPoints = mRow && (mRow.merit ?? mRow.count) ? Number(mRow.merit ?? mRow.count) : 0;
        const dRow = await pGet(`SELECT COALESCE(SUM(points),0) as demerit FROM merit_demerit_logs WHERE cadet_id = ? AND type = 'demerit'`, [cadetId]);
        const demeritPoints = dRow && (dRow.demerit ?? dRow.count) ? Number(dRow.demerit ?? dRow.count) : 0;
        const gradeRow = await pGet(`SELECT * FROM grades WHERE cadet_id = ?`, [cadetId]);
        const base = {
            // Prioritize Admin's manual entry (gradeRow) over raw logs (calculated)
            attendance_present: gradeRow ? gradeRow.attendance_present : attendancePresent,
            merit_points: gradeRow ? gradeRow.merit_points : meritPoints,
            demerit_points: gradeRow ? gradeRow.demerit_points : demeritPoints,
            prelim_score: gradeRow?.prelim_score || 0,
            midterm_score: gradeRow?.midterm_score || 0,
            final_score: gradeRow?.final_score || 0,
            status: gradeRow?.status || 'active'
        };
        if (gradeRow) {
            // SYNC FIX: Do NOT overwrite Admin's manual edits with raw counts.
            // The Admin 'Grading Management' is the source of truth.
            // await pRun(`UPDATE grades SET attendance_present = ?, merit_points = ?, demerit_points = ? WHERE cadet_id = ?`, [attendancePresent, meritPoints, demeritPoints, cadetId]);
        } else {
            // Only insert if missing
            await pRun(`INSERT INTO grades (cadet_id, attendance_present, merit_points, demerit_points, prelim_score, midterm_score, final_score, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [cadetId, attendancePresent, meritPoints, demeritPoints, 0, 0, 0, 'active']);
        }
        const safeTotalDays = totalTrainingDays > 0 ? totalTrainingDays : 0;
        const attendanceScore = safeTotalDays > 0 ? (base.attendance_present / safeTotalDays) * 30 : 0;
        let rawAptitude = 100 + (base.merit_points || 0) - (base.demerit_points || 0);
        if (rawAptitude > 100) rawAptitude = 100;
        if (rawAptitude < 0) rawAptitude = 0;
        const aptitudeScore = rawAptitude * 0.3;
        const subjectScore = ((base.prelim_score + base.midterm_score + base.final_score) / 300) * 40;
        const finalGrade = attendanceScore + aptitudeScore + subjectScore;
        const { transmutedGrade, remarks } = calculateTransmutedGrade(finalGrade, base.status);
        res.json({
            ...base,
            totalTrainingDays: safeTotalDays,
            attendanceScore,
            aptitudeScore,
            subjectScore,
            finalGrade,
            transmutedGrade,
            remarks
        });
    } catch (e) {
        const safeTotalDays = 0;
        const base = {
            attendance_present: 0,
            merit_points: 0,
            demerit_points: 0,
            prelim_score: 0,
            midterm_score: 0,
            final_score: 0,
            status: 'active'
        };
        const attendanceScore = 0;
        const aptitudeScore = 100 * 0.3;
        const subjectScore = 0;
        const finalGrade = attendanceScore + aptitudeScore + subjectScore;
        const { transmutedGrade, remarks } = calculateTransmutedGrade(finalGrade, base.status);
        res.json({
            ...base,
            totalTrainingDays: safeTotalDays,
            attendanceScore,
            aptitudeScore,
            subjectScore,
            finalGrade,
            transmutedGrade,
            remarks
        });
    }
});

// Get My Merit/Demerit Logs
router.get('/my-merit-logs', async (req, res) => {
    let cadetId = req.user.cadetId;
    if (!cadetId && req.user.role === 'cadet') {
        const userRow = await new Promise(resolve => {
            db.get(`SELECT cadet_id FROM users WHERE id = ?`, [req.user.id], (err, row) => resolve(row));
        });
        if (userRow && userRow.cadet_id) cadetId = userRow.cadet_id;
    }
    if (!cadetId) return res.status(403).json({ message: 'Not a cadet account' });

    const sql = `SELECT * FROM merit_demerit_logs WHERE cadet_id = ? ORDER BY date_recorded DESC`;
    db.all(sql, [cadetId], async (err, rows) => {
        if (err) {
            console.error('[cadet/my-merit-logs] Query error, falling back to grade totals only:', err.message, { sql, cadetId });
        }
        const logs = (!err && Array.isArray(rows)) ? rows : [];

        // Ensure displayed totals stay in sync with Admin Grading
        const gradeTotals = await new Promise(resolve => {
            db.get(
                `SELECT merit_points, demerit_points FROM grades WHERE cadet_id = ?`,
                [cadetId],
                (gErr, gRow) => resolve(gErr ? null : gRow)
            );
        });

        if (gradeTotals) {
            const ledgerMerit = logs.filter(l => l.type === 'merit').reduce((a, b) => a + Number(b.points || 0), 0);
            const ledgerDemerit = logs.filter(l => l.type === 'demerit').reduce((a, b) => a + Number(b.points || 0), 0);
            const meritDiff = Math.max(0, Number(gradeTotals.merit_points || 0) - ledgerMerit);
            const demeritDiff = Math.max(0, Number(gradeTotals.demerit_points || 0) - ledgerDemerit);

            const nowIso = new Date().toISOString();
            if (meritDiff > 0) {
                logs.unshift({
                    id: null,
                    cadet_id: cadetId,
                    type: 'merit',
                    points: meritDiff,
                    reason: 'Admin Grade Total (not yet ledgered)',
                    issued_by_user_id: null,
                    issued_by_name: 'Admin',
                    date_recorded: nowIso
                });
            }
            if (demeritDiff > 0) {
                logs.unshift({
                    id: null,
                    cadet_id: cadetId,
                    type: 'demerit',
                    points: demeritDiff,
                    reason: 'Admin Grade Total (not yet ledgered)',
                    issued_by_user_id: null,
                    issued_by_name: 'Admin',
                    date_recorded: nowIso
                });
            }
        }

        res.json(logs);
    });
});

// Notifications (Cadet scope)
router.get('/notifications', (req, res) => {
    const userId = req.user.id;
    const sql = `SELECT * FROM notifications WHERE (user_id IS NULL OR user_id = ?) ORDER BY created_at DESC LIMIT 50`;
    db.all(sql, [userId], (err, rows) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json(rows);
    });
});

router.put('/notifications/:id/read', (req, res) => {
    db.run(`UPDATE notifications SET is_read = TRUE WHERE id = ?`, [req.params.id], function(err) {
        if (err) return res.status(500).json({ message: err.message });
        res.json({ message: 'Marked as read' });
    });
});

router.put('/notifications/read-all', (req, res) => {
    const userId = req.user.id;
    db.run(`UPDATE notifications SET is_read = TRUE WHERE (user_id IS NULL OR user_id = ?) AND is_read = FALSE`, [userId], function(err) {
        if (err) return res.status(500).json({ message: err.message });
        res.json({ message: 'All marked as read' });
    });
});

router.delete('/notifications/:id', (req, res) => {
    db.run(`DELETE FROM notifications WHERE id = ?`, [req.params.id], function(err) {
        if (err) return res.status(500).json({ message: err.message });
        res.json({ message: 'Notification deleted' });
    });
});

router.delete('/notifications/delete-all', (req, res) => {
    const userId = req.user.id;
    db.run(`DELETE FROM notifications WHERE (user_id IS NULL OR user_id = ?)`, [userId], function(err) {
        if (err) return res.status(500).json({ message: err.message });
        res.json({ message: 'All notifications deleted' });
    });
});

router.get('/profile', (req, res) => {
    const tryFetch = (id) => {
        const sql = `
            SELECT c.*, u.username 
            FROM cadets c 
            LEFT JOIN users u ON u.cadet_id = c.id 
            WHERE c.id = ?
        `;
        db.get(sql, [id], (err, row) => {
            if (err) return res.status(500).json({ message: err.message });
            if (!row) return res.status(404).json({ message: 'Cadet not found' });
            
            // Log what's in the database for debugging
            console.log('[Profile GET] Cadet ID:', id);
            console.log('[Profile GET] profile_pic field:', row.profile_pic);
            console.log('[Profile GET] profile_pic type:', typeof row.profile_pic);
            
            res.json(row);
        });
    };
    let cadetId = req.user.cadetId;
    if (cadetId) return tryFetch(cadetId);
    db.get(`SELECT cadet_id FROM users WHERE id = ? AND role = 'cadet'`, [req.user.id], (err, row) => {
        if (err) return res.status(500).json({ message: err.message });
        if (!row || !row.cadet_id) return res.status(403).json({ message: 'Not a cadet account' });
        tryFetch(row.cadet_id);
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

router.put('/profile', uploadProfilePic, async (req, res) => {
    const cadetId = req.user.cadetId;
    if (!cadetId) return res.status(403).json({ message: 'Not a cadet account' });

    try {
        console.log('[Profile Update] Starting update for cadet:', cadetId);
        
        // 1. Check if profile is already locked
        const row = await new Promise((resolve, reject) => {
            db.get("SELECT is_profile_completed FROM cadets WHERE id = ?", [cadetId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        console.log('[Profile Update] Profile lock status:', row);
        
        // Handle both PostgreSQL (true/false) and SQLite (1/0) boolean values
        const isLocked = row && (row.is_profile_completed === true || row.is_profile_completed === 1 || row.is_profile_completed === '1');
        
        if (isLocked) {
            console.log('[Profile Update] Profile is locked, rejecting update');
            return res.status(403).json({ message: 'Profile is locked and cannot be edited. Contact your administrator.' });
        }

        const { 
            username, firstName, middleName, lastName, suffixName,
            email, contactNumber, address,
            course, yearLevel, schoolYear,
            battalion, company, platoon,
            cadetCourse, semester, gender,
            is_profile_completed
        } = req.body;
        
        const isComplete = (is_profile_completed === 'true' || is_profile_completed === true || is_profile_completed === 1 || is_profile_completed === '1');
        const safeParam = (val) => val === undefined ? null : val;

        console.log('[Profile Update] Is completing profile:', isComplete);

        // 2. Mandatory Field Validation (Only if completing profile)
        if (isComplete) {
            const requiredFields = [
                'username', 'firstName', 'lastName', 'email', 'contactNumber', 'address',
                'gender', 'course', 'yearLevel', 'schoolYear', 'battalion', 'company', 'platoon',
                'cadetCourse', 'semester'
            ];
            
            const missing = requiredFields.filter(field => !req.body[field]);
            if (missing.length > 0) {
                console.log('[Profile Update] Missing fields:', missing);
                return res.status(400).json({ message: `Missing required fields: ${missing.join(', ')}` });
            }

            // Check for duplicate username/email
            const checkUsername = await new Promise((resolve, reject) => {
                db.get(`SELECT id, cadet_id FROM users WHERE username = ? LIMIT 1`, [username], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });
            
            const checkEmail = await new Promise((resolve, reject) => {
                db.get(`SELECT id, cadet_id FROM users WHERE email = ? LIMIT 1`, [email], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });
            
            const usernameConflict = checkUsername && checkUsername.cadet_id != cadetId;
            const emailConflict = checkEmail && checkEmail.cadet_id != cadetId;
            
            if (usernameConflict || emailConflict) {
                const conflictFields = [
                    usernameConflict ? 'username' : null,
                    emailConflict ? 'email' : null
                ].filter(Boolean);
                console.log('[Profile Update] Conflict detected:', conflictFields);
                return res.status(409).json({
                    message: `The following fields are already taken: ${conflictFields.join(', ')}`
                });
            }
        }

        // 3. Build UPDATE query
        let sql = `UPDATE cadets SET 
            first_name=?, middle_name=?, last_name=?, suffix_name=?,
            email=?, contact_number=?, address=?,
            course=?, year_level=?, school_year=?,
            battalion=?, company=?, platoon=?,
            cadet_course=?, semester=?, gender=?, corp_position=?`;
        
        const params = [
            safeParam(firstName), safeParam(middleName), safeParam(lastName), safeParam(suffixName),
            safeParam(email), safeParam(contactNumber), safeParam(address),
            safeParam(course), safeParam(yearLevel), safeParam(schoolYear),
            safeParam(battalion), safeParam(company), safeParam(platoon),
            safeParam(cadetCourse), safeParam(semester), safeParam(gender), safeParam(req.body.corpPosition)
        ];

        let imageUrl = null;
        if (req.file) {
            imageUrl = req.file.secure_url || req.file.url || req.file.path || '';
            
            // Normalize local paths
            if (imageUrl && !imageUrl.startsWith('http')) {
                imageUrl = imageUrl.replace(/\\/g, '/');
                const uploadsIndex = imageUrl.indexOf('/uploads/');
                if (uploadsIndex !== -1) {
                    imageUrl = imageUrl.substring(uploadsIndex);
                } else if (imageUrl.includes('uploads/')) {
                    const parts = imageUrl.split('uploads/');
                    imageUrl = '/uploads/' + parts[parts.length - 1];
                }
            }
            
            sql += `, profile_pic=?`;
            params.push(imageUrl);
            
            console.log('[Profile Update] Image uploaded:', imageUrl);
        }

        // Set completion status if requested
        if (isComplete) {
            sql += `, is_profile_completed=?, status=?`;
            params.push(true, 'Verified');
        }
        
        sql += ` WHERE id=?`;
        params.push(cadetId);

        console.log('[Profile Update] Executing SQL update...');

        // 4. Execute UPDATE
        await new Promise((resolve, reject) => {
            db.run(sql, params, (err) => {
                if (err) {
                    console.error("[Profile Update] DB Update Error:", err);
                    reject(err);
                } else {
                    console.log('[Profile Update] SQL update successful');
                    resolve();
                }
            });
        });

        // 5. Update Users Table
        if (username && email) {
            console.log('[Profile Update] Updating users table...');
            await new Promise((resolve, reject) => {
                db.run(`UPDATE users SET username=?, email=?, is_approved=? WHERE cadet_id=?`, 
                    [username, email, 1, cadetId], 
                    (err) => {
                        if (err) {
                            console.error("[Profile Update] Error updating user credentials:", err);
                            reject(err);
                        } else {
                            console.log('[Profile Update] Users table updated');
                            resolve();
                        }
                    }
                );
            });
        }

        // 6. Notify Admin
        const notifMsg = `${firstName} ${lastName} has updated their profile.`;
        db.run(`INSERT INTO notifications (user_id, message, type) VALUES (NULL, ?, ?)`, 
            [notifMsg, 'profile_update'], 
            (err) => {
                if (err) console.error("[Profile Update] Error creating notification:", err);
            }
        );

        // 7. Broadcast event
        try {
            broadcastEvent({ type: 'cadet_profile_updated', cadetId });
        } catch (e) {
            console.error('[Profile Update] Broadcast error:', e);
        }

        console.log('[Profile Update] Update complete, sending response');

        // 8. Return success with the image path
        res.json({ 
            message: 'Profile updated successfully', 
            profilePic: imageUrl,
            success: true
        });
        
    } catch (err) {
        console.error("[Profile Update] Error:", err);
        res.status(500).json({ message: "Error updating profile: " + err.message });
    }
});

router.get('/activities', (req, res) => {
    db.all(
        `SELECT id, title, description, date, type, image_path, images 
         FROM activities 
         ORDER BY date DESC`,
        [],
        (err, rows) => {
            if (err) return res.status(500).json({ message: err.message });
            res.json(rows);
        }
    );
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
