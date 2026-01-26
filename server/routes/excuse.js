const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateToken, isAdmin } = require('../middleware/auth');

// Submit Excuse Letter (Cadet)
router.post('/', authenticateToken, (req, res) => {
    const { date_absent, reason, file_url } = req.body;
    const cadet_id = req.user.cadetId;

    if (!cadet_id) return res.status(403).json({ message: 'Only cadets can submit excuse letters.' });

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
        
        // If approved, optionally update attendance record to 'excused'
        // We would need to find the attendance record for that date and cadet.
        // This is complex because we need the training_day_id.
        // For now, we just mark the letter as approved.
        
        res.json({ message: `Excuse letter ${status}` });
    });
});

module.exports = router;
