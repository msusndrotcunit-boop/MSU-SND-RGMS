const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateToken, isAdmin } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../../client/public/uploads/excuse_letters');
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer config
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage: storage });

// Submit Excuse Letter (Cadet)
router.post('/', authenticateToken, upload.single('file'), (req, res) => {
    const { date_absent, reason } = req.body;
    const cadet_id = req.user.cadetId;

    if (!cadet_id) return res.status(403).json({ message: 'Only cadets can submit excuse letters.' });

    let file_url = '';
    if (req.file) {
        // Save relative path for frontend access
        file_url = '/uploads/excuse_letters/' + req.file.filename;
    }

    const sql = `INSERT INTO excuse_letters (cadet_id, date_absent, reason, file_url) VALUES (?, ?, ?, ?)`;
    db.run(sql, [cadet_id, date_absent, reason, file_url], function(err) {
        if (err) return res.status(500).json({ message: err.message });
        res.json({ id: this.lastID, message: 'Excuse letter submitted successfully.' });
    });
});

// Get Excuse Letters (Admin: All, Cadet: Own)
router.get('/', authenticateToken, (req, res) => {
    if (req.user.role === 'admin') {
        const sql = `
            SELECT el.*, c.first_name, c.last_name, c.company, c.platoon
            FROM excuse_letters el
            JOIN cadets c ON el.cadet_id = c.id
            ORDER BY el.created_at DESC
        `;
        db.all(sql, [], (err, rows) => {
            if (err) return res.status(500).json({ message: err.message });
            res.json(rows);
        });
    } else {
        const sql = `SELECT * FROM excuse_letters WHERE cadet_id = ? ORDER BY created_at DESC`;
        db.all(sql, [req.user.cadetId], (err, rows) => {
            if (err) return res.status(500).json({ message: err.message });
            res.json(rows);
        });
    }
});

// Update Excuse Status (Admin)
router.put('/:id', authenticateToken, isAdmin, (req, res) => {
    const { status } = req.body; // 'approved' or 'rejected'
    const id = req.params.id;

    if (!['approved', 'rejected', 'pending'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status' });
    }

    db.run(`UPDATE excuse_letters SET status = ? WHERE id = ?`, [status, id], function(err) {
        if (err) return res.status(500).json({ message: err.message });
        
        if (status === 'approved') {
            // Find the letter details
            db.get(`SELECT cadet_id, date_absent FROM excuse_letters WHERE id = ?`, [id], (err, letter) => {
                if (err || !letter) return;

                // Find the training day
                db.get(`SELECT id FROM training_days WHERE date = ?`, [letter.date_absent], (err, day) => {
                    if (err || !day) return; // No training day matches

                    const newStatus = 'excused';
                    const remarks = 'Approved Excuse Letter';

                    // Check if attendance record exists
                    db.get(`SELECT id FROM attendance_records WHERE training_day_id = ? AND cadet_id = ?`, [day.id, letter.cadet_id], (err, record) => {
                        if (record) {
                             db.run('UPDATE attendance_records SET status = ?, remarks = ? WHERE id = ?', [newStatus, remarks, record.id], () => {
                                 updateTotalAttendance(letter.cadet_id);
                             });
                        } else {
                             db.run('INSERT INTO attendance_records (training_day_id, cadet_id, status, remarks) VALUES (?, ?, ?, ?)', [day.id, letter.cadet_id, newStatus, remarks], () => {
                                 updateTotalAttendance(letter.cadet_id);
                             });
                        }
                    });
                });
            });
        }
        
        res.json({ message: `Excuse letter ${status}` });
    });
});

// Helper to update total attendance count in grades table (Duplicated from attendance.js)
function updateTotalAttendance(cadetId) {
    // Count 'present' and 'excused' records
    db.get(`SELECT COUNT(*) as count FROM attendance_records WHERE cadet_id = ? AND status IN ('present', 'excused')`, [cadetId], (err, row) => {
        if (err) {
            console.error(`Error counting attendance for cadet ${cadetId}:`, err);
            return;
        }
        
        const count = row.count;
        
        // Update grades table
        db.run('UPDATE grades SET attendance_present = ? WHERE cadet_id = ?', [count, cadetId], function(err) {
            if (err) console.error(`Error updating grades for cadet ${cadetId}:`, err);
            
            if (this.changes === 0) {
                // Grade record might not exist, create it
                db.run('INSERT INTO grades (cadet_id, attendance_present) VALUES (?, ?)', [cadetId, count], (err) => {
                    if (err) console.error(`Error creating grade record for cadet ${cadetId}:`, err);
                });
            }
        });
    });
}

module.exports = router;
