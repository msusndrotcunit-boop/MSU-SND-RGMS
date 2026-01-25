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

    db.get(`SELECT * FROM grades WHERE cadet_id = ?`, [cadetId], (err, row) => {
        if (err) return res.status(500).json({ message: err.message });
        if (!row) return res.status(404).json({ message: 'Grades not found' });

        // Calculate Grades
        const attendanceScore = (row.attendance_present / 15) * 30;
        const aptitudeScore = (row.merit_points - row.demerit_points) * 0.3;
        const subjectScore = ((row.prelim_score + row.midterm_score + row.final_score) / 300) * 40;
        const finalGrade = attendanceScore + aptitudeScore + subjectScore;

        const { transmutedGrade, remarks } = calculateTransmutedGrade(finalGrade, row.status);

        res.json({
            ...row,
            attendanceScore,
            aptitudeScore,
            subjectScore,
            finalGrade,
            transmutedGrade,
            remarks
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

    const { 
        rank, firstName, middleName, lastName, suffixName, 
        email, contactNumber, address, 
        course, yearLevel, schoolYear, 
        battalion, company, platoon, 
        cadetCourse, semester, status 
    } = req.body;

    let sql = `UPDATE cadets SET 
        rank=?, first_name=?, middle_name=?, last_name=?, suffix_name=?, 
        email=?, contact_number=?, address=?, 
        course=?, year_level=?, school_year=?, 
        battalion=?, company=?, platoon=?, 
        cadet_course=?, semester=?, status=?`;
    
    const params = [
        rank, firstName, middleName, lastName, suffixName, 
        email, contactNumber, address, 
        course, yearLevel, schoolYear, 
        battalion, company, platoon, 
        cadetCourse, semester, status
    ];

    if (req.file) {
        sql += `, profile_pic=?`;
        // Convert buffer to Base64 Data URI
        const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
        params.push(base64Image);
    }

    sql += ` WHERE id=?`;
    params.push(cadetId);

    db.run(sql, params, (err) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json({ 
            message: 'Profile updated', 
            profilePic: req.file ? `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}` : null 
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
