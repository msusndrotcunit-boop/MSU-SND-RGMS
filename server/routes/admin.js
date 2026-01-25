const express = require('express');
const db = require('../database');
const { authenticateToken, isAdmin } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');

const router = express.Router();

// Multer Setup
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

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
    
    db.run(`UPDATE grades SET 
            attendance_present = ?, 
            merit_points = ?, 
            demerit_points = ?, 
            prelim_score = ?, 
            midterm_score = ?, 
            final_score = ?,
            status = ?
            WHERE cadet_id = ?`,
        [attendancePresent, meritPoints, demeritPoints, prelimScore, midtermScore, finalScore, status || 'active', req.params.cadetId],
        function(err) {
            if (err) return res.status(500).json({ message: err.message });
            res.json({ message: 'Grades updated' });
        }
    );
});

// --- Activity Management ---

// Upload Activity
router.post('/activities', upload.single('image'), (req, res) => {
    const { title, description, date } = req.body;
    const imagePath = req.file ? `/uploads/${req.file.filename}` : null;

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
    const profilePic = req.file ? `/uploads/${req.file.filename}` : null;
    
    if (profilePic) {
        db.run(`UPDATE users SET profile_pic = ? WHERE id = ?`, [profilePic, req.user.id], function(err) {
            if (err) return res.status(500).json({ message: err.message });
            res.json({ message: 'Profile updated', profilePic });
        });
    } else {
        res.status(400).json({ message: 'No file uploaded' });
    }
});

module.exports = router;
