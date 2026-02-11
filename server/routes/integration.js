const express = require('express');
const db = require('../database');
const router = express.Router();

// Middleware to check API Key
const verifyApiKey = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    const validApiKey = process.env.INTEGRATION_KEY || 'rotc-secret-key-123'; // Default fallback

    if (!apiKey || apiKey !== validApiKey) {
        return res.status(401).json({ message: 'Unauthorized: Invalid API Key' });
    }
    next();
};

router.use(verifyApiKey);

// POST /api/integration/sync-attendance
// Expects: { "data": [ { "studentId": "2023-001", "totalAttendance": 10 }, ... ] }
router.post('/sync-attendance', (req, res) => {
    const { data } = req.body;

    if (!data || !Array.isArray(data)) {
        return res.status(400).json({ message: 'Invalid data format. Expected array of { studentId, totalAttendance }' });
    }

    let updatedCount = 0;
    let errorCount = 0;

    // Get current total training days to cap attendance
    db.get("SELECT COUNT(*) as total FROM training_days", [], (err, countRow) => {
        const maxDays = (countRow && countRow.total) || 15; // Default to 15 if table is empty

        // Process each record
        // Note: We use a loop with promises to handle async DB calls
        const updates = data.map(record => {
            return new Promise((resolve, reject) => {
                const { studentId, totalAttendance } = record;

                // 1. Find Cadet ID by Student ID
                const findSql = `SELECT c.id FROM cadets c WHERE c.student_id = ?`;
                
                db.get(findSql, [studentId], (err, row) => {
                    if (err || !row) {
                        errorCount++;
                        return resolve(); // Skip if not found
                    }

                    const cadetId = row.id;

                    // 2. Update Grade Attendance
                    // Ensure attendance doesn't exceed max training days
                    const safeAttendance = Math.min(Math.max(parseInt(totalAttendance) || 0, 0), maxDays);

                    // Check if grade record exists, if not create it (upsert-ish)
                    const checkGradeSql = `SELECT id FROM grades WHERE cadet_id = ?`;
                    db.get(checkGradeSql, [cadetId], (err, gradeRow) => {
                        if (gradeRow) {
                            // Update
                            db.run(`UPDATE grades SET attendance_present = ? WHERE cadet_id = ?`, 
                                [safeAttendance, cadetId], 
                                (err) => {
                                    if (!err) updatedCount++;
                                    resolve();
                                }
                            );
                        } else {
                            // Insert (if missing)
                            db.run(`INSERT INTO grades (cadet_id, attendance_present) VALUES (?, ?)`, 
                                [cadetId, safeAttendance], 
                                (err) => {
                                    if (!err) updatedCount++;
                                    resolve();
                                }
                            );
                        }
                    });
                });
            });
        });

        Promise.all(updates).then(() => {
            res.json({ 
                message: 'Sync complete', 
                updated: updatedCount, 
                errors: errorCount 
            });
        }).catch(err => {
            res.status(500).json({ message: 'Sync failed', error: err.message });
        });
    });
});

module.exports = router;
