const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateToken, isAdminOrPrivilegedStaff } = require('../middleware/auth');
const { upload } = require('../utils/cloudinary');
const path = require('path');
const fs = require('fs');

// Submit Excuse Letter (Cadet)
router.post('/', authenticateToken, upload.single('file'), (req, res) => {
    const { date_absent, reason } = req.body;
    const cadet_id = req.user.cadetId;

    if (!cadet_id) return res.status(403).json({ message: 'Only cadets can submit excuse letters.' });

    let file_url = '';
    if (req.file) {
        // Use Cloudinary URL if available, otherwise fall back to local path or filename
        file_url = req.file.path || req.file.secure_url || (`/uploads/${req.file.filename}`);
        
        // Normalize local paths if needed (though cloudinary utils handles this logic mostly)
        if (!file_url.startsWith('http') && !file_url.startsWith('/')) {
             file_url = '/uploads/' + req.file.filename;
        }
    }

    const sql = `INSERT INTO excuse_letters (cadet_id, date_absent, reason, file_url) VALUES (?, ?, ?, ?)`;
    db.run(sql, [cadet_id, date_absent, reason, file_url], function(err) {
        if (err) return res.status(500).json({ message: err.message });
        res.json({ id: this.lastID, message: 'Excuse letter submitted successfully.' });
    });
});

// Get Excuse Letters (Admin/Privileged Staff: All, Cadet: Own)
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
            return res.json(rows);
        });
    }

    if (req.user.role === 'training_staff' && req.user.staffId) {
        const sql = `
            SELECT el.*, c.first_name, c.last_name, c.company, c.platoon
            FROM excuse_letters el
            JOIN cadets c ON el.cadet_id = c.id
            ORDER BY el.created_at DESC
        `;
        return db.all(sql, [], (err, rows) => {
            if (err) return res.status(500).json({ message: err.message });
            return res.json(rows);
        });
    }

    if (req.user.cadetId) {
        const sql = `SELECT * FROM excuse_letters WHERE cadet_id = ? ORDER BY created_at DESC`;
        db.all(sql, [req.user.cadetId], (err, rows) => {
            if (err) return res.status(500).json({ message: err.message });
            res.json(rows);
        });
    }
    else {
        res.status(403).json({ message: 'Access denied' });
    }
});

// Update Excuse Status (Admin/Privileged Staff)
router.put('/:id', authenticateToken, isAdminOrPrivilegedStaff, (req, res) => {
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

// Delete Excuse Letter (Admin/Privileged Staff)
router.delete('/:id', authenticateToken, isAdminOrPrivilegedStaff, (req, res) => {
    const id = req.params.id;
    
    // Optional: Delete the file from filesystem/cloudinary if needed. 
    // For now, we just remove the database record.
    
    db.run(`DELETE FROM excuse_letters WHERE id = ?`, [id], function(err) {
        if (err) return res.status(500).json({ message: err.message });
        if (this.changes === 0) return res.status(404).json({ message: 'Excuse letter not found' });
        
        res.json({ message: 'Excuse letter deleted successfully' });
    });
});

// Helper to update total attendance count in grades table (Duplicated from attendance.js)
function updateTotalAttendance(cadetId) {
    // Count 'present' and 'excused' records
    db.get(`SELECT COUNT(*) as count FROM attendance_records WHERE cadet_id = ? AND lower(status) IN ('present', 'excused')`, [cadetId], (err, row) => {
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
