const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateToken, isAdmin } = require('../middleware/auth');

// --- Training Days ---

// Get all training days
router.get('/days', authenticateToken, (req, res) => {
    db.all('SELECT * FROM training_days ORDER BY date DESC', [], (err, rows) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json(rows);
    });
});

// Create a training day
router.post('/days', authenticateToken, isAdmin, (req, res) => {
    const { date, title, description } = req.body;
    db.run('INSERT INTO training_days (date, title, description) VALUES (?, ?, ?)', 
        [date, title, description], 
        function(err) {
            if (err) return res.status(500).json({ message: err.message });
            res.json({ id: this.lastID, message: 'Training day created' });
        }
    );
});

// Delete a training day
router.delete('/days/:id', authenticateToken, isAdmin, (req, res) => {
    db.run('DELETE FROM training_days WHERE id = ?', [req.params.id], function(err) {
        if (err) return res.status(500).json({ message: err.message });
        res.json({ message: 'Training day deleted' });
    });
});

// --- Attendance Records ---

// Get attendance for a specific day (includes all cadets, even if not marked)
router.get('/records/:dayId', authenticateToken, isAdmin, (req, res) => {
    const dayId = req.params.dayId;
    const { company, platoon } = req.query;

    let sql = `
        SELECT 
            c.id as cadet_id, 
            c.last_name, 
            c.first_name, 
            c.rank,
            c.company,
            c.platoon,
            ar.status, 
            ar.remarks
        FROM cadets c
        LEFT JOIN attendance_records ar ON c.id = ar.cadet_id AND ar.training_day_id = ?
        WHERE 1=1
    `;
    const params = [dayId];

    if (company) {
        sql += ' AND c.company = ?';
        params.push(company);
    }
    if (platoon) {
        sql += ' AND c.platoon = ?';
        params.push(platoon);
    }

    sql += ' ORDER BY c.last_name ASC';

    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json(rows);
    });
});

// Mark attendance (Upsert)
router.post('/mark', authenticateToken, isAdmin, (req, res) => {
    const { dayId, cadetId, status, remarks } = req.body;

    // Check if record exists
    db.get('SELECT id FROM attendance_records WHERE training_day_id = ? AND cadet_id = ?', [dayId, cadetId], (err, row) => {
        if (err) return res.status(500).json({ message: err.message });

        if (row) {
            // Update
            db.run('UPDATE attendance_records SET status = ?, remarks = ? WHERE id = ?', 
                [status, remarks, row.id], 
                (err) => {
                    if (err) return res.status(500).json({ message: err.message });
                    updateTotalAttendance(cadetId, res);
                }
            );
        } else {
            // Insert
            db.run('INSERT INTO attendance_records (training_day_id, cadet_id, status, remarks) VALUES (?, ?, ?, ?)', 
                [dayId, cadetId, status, remarks], 
                (err) => {
                    if (err) return res.status(500).json({ message: err.message });
                    updateTotalAttendance(cadetId, res);
                }
            );
        }
    });
});

// Helper to update total attendance count in grades table
function updateTotalAttendance(cadetId, res) {
    // Count 'present' records
    db.get(`SELECT COUNT(*) as count FROM attendance_records WHERE cadet_id = ? AND status = 'present'`, [cadetId], (err, row) => {
        if (err) return res.status(500).json({ message: 'Error counting attendance' });
        
        const count = row.count;
        
        // Update grades table
        db.run('UPDATE grades SET attendance_present = ? WHERE cadet_id = ?', [count, cadetId], function(err) {
            if (err) return res.status(500).json({ message: 'Error updating grades' });
            
            if (this.changes === 0) {
                // Grade record might not exist, create it
                db.run('INSERT INTO grades (cadet_id, attendance_present) VALUES (?, ?)', [cadetId, count], (err) => {
                    if (err) return res.status(500).json({ message: 'Error creating grade record' });
                    res.json({ message: 'Attendance marked and total updated', totalPresent: count });
                });
            } else {
                res.json({ message: 'Attendance marked and total updated', totalPresent: count });
            }
        });
    });
}

// --- Cadet View ---

// Get my attendance history
router.get('/my-history', authenticateToken, (req, res) => {
    const cadetId = req.user.cadetId;
    if (!cadetId) return res.status(403).json({ message: 'Not a cadet' });

    const sql = `
        SELECT 
            td.date,
            td.title,
            ar.status,
            ar.remarks
        FROM training_days td
        LEFT JOIN attendance_records ar ON td.id = ar.training_day_id AND ar.cadet_id = ?
        ORDER BY td.date DESC
    `;

    db.all(sql, [cadetId], (err, rows) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json(rows);
    });
});

module.exports = router;
