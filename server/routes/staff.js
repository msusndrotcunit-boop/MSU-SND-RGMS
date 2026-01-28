const express = require('express');
const router = express.Router();
const db = require('../database');
const bcrypt = require('bcryptjs');
const { authenticateToken } = require('../middleware/auth');

// Middleware to check if admin
const isAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied. Admins only.' });
    }
    next();
};

// GET All Staff (Admin)
router.get('/', authenticateToken, isAdmin, (req, res) => {
    db.all("SELECT * FROM training_staff ORDER BY last_name ASC", [], (err, rows) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json(rows);
    });
});

// GET Current Staff Profile (Me)
router.get('/me', authenticateToken, (req, res) => {
    if (!req.user.staffId) return res.status(404).json({ message: 'Not logged in as staff' });
    
    db.get("SELECT * FROM training_staff WHERE id = ?", [req.user.staffId], (err, row) => {
        if (err) return res.status(500).json({ message: err.message });
        if (!row) return res.status(404).json({ message: 'Staff profile not found' });
        res.json(row);
    });
});

// UPDATE Current Staff Profile (Me)
router.put('/profile', authenticateToken, (req, res) => {
    if (!req.user.staffId) return res.status(403).json({ message: 'Access denied.' });
    
    const { email, contact_number, profile_pic } = req.body;
    // Staff can only update contact info and picture
    const sql = `UPDATE training_staff SET email = ?, contact_number = ?, profile_pic = ? WHERE id = ?`;
    
    db.run(sql, [email, contact_number, profile_pic, req.user.staffId], function(err) {
        if (err) return res.status(500).json({ message: err.message });
        
        // Also update users table email if changed
        if (email || profile_pic) {
            db.run("UPDATE users SET email = ?, profile_pic = ? WHERE staff_id = ?", [email, profile_pic, req.user.staffId], (uErr) => {
               // ignore error
            });
        }
        
        res.json({ message: 'Profile updated successfully' });
    });
});

// GET Single Staff
router.get('/:id', authenticateToken, (req, res) => {
    // Check permissions: Admin or Self
    if (req.user.role !== 'admin' && req.user.staffId != req.params.id) {
         return res.status(403).json({ message: 'Access denied.' });
    }
    db.get("SELECT * FROM training_staff WHERE id = ?", [req.params.id], (err, row) => {
        if (err) return res.status(500).json({ message: err.message });
        if (!row) return res.status(404).json({ message: 'Staff not found' });
        res.json(row);
    });
});

// CREATE Staff (Admin)
router.post('/', authenticateToken, isAdmin, async (req, res) => {
    const { rank, first_name, middle_name, last_name, suffix_name, email, contact_number, role, profile_pic } = req.body;
    
    // 1. Create Staff Profile
    const sql = `INSERT INTO training_staff (rank, first_name, middle_name, last_name, suffix_name, email, contact_number, role, profile_pic) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const params = [rank, first_name, middle_name, last_name, suffix_name, email, contact_number, role || 'Instructor', profile_pic];

    db.run(sql, params, async function(err) {
        if (err) return res.status(500).json({ message: err.message });
        
        // Check if DB adapter returns ID directly or via this.lastID (SQLite)
        // In my adapter, INSERT returns ID if simulated, but for SQLite it's this.lastID.
        // The adapter in database.js for Postgres calls callback with context { lastID: ... }
        // So `this.lastID` should work.
        const staffId = this.lastID;

        // 2. Create User Account
        // Default password: 'staffpassword' (Should be changed)
        const username = email || `${first_name.toLowerCase()}.${last_name.toLowerCase()}`;
        const defaultPassword = 'staffpassword'; 
        
        try {
            const hashedPassword = await bcrypt.hash(defaultPassword, 10);
            
            // Insert into users
            // Note: role is 'training_staff'. This relies on the CHECK constraint being updated or ignored.
            const userSql = `INSERT INTO users (username, password, role, staff_id, is_approved, email, profile_pic) VALUES (?, ?, 'training_staff', ?, 1, ?, ?)`;
            
            db.run(userSql, [username, hashedPassword, staffId, email, profile_pic], (uErr) => {
                if (uErr) {
                    console.error('Error creating user for staff:', uErr);
                    // Don't fail the request, just warn
                    return res.json({ message: 'Staff profile created, but user account creation failed. ' + uErr.message, id: staffId });
                }
                res.json({ message: 'Staff created successfully. Default password is "staffpassword".', id: staffId });
            });
        } catch (hashErr) {
            res.status(500).json({ message: 'Error hashing password' });
        }
    });
});

// UPDATE Staff
router.put('/:id', authenticateToken, isAdmin, (req, res) => {
    const { rank, first_name, middle_name, last_name, suffix_name, email, contact_number, role, profile_pic } = req.body;
    const sql = `UPDATE training_staff SET rank = ?, first_name = ?, middle_name = ?, last_name = ?, suffix_name = ?, email = ?, contact_number = ?, role = ?, profile_pic = ? WHERE id = ?`;
    
    db.run(sql, [rank, first_name, middle_name, last_name, suffix_name, email, contact_number, role, profile_pic, req.params.id], function(err) {
        if (err) return res.status(500).json({ message: err.message });
        res.json({ message: 'Staff updated successfully' });
    });
});

// DELETE Staff
router.delete('/:id', authenticateToken, isAdmin, (req, res) => {
    db.run("DELETE FROM training_staff WHERE id = ?", [req.params.id], function(err) {
        if (err) return res.status(500).json({ message: err.message });
        res.json({ message: 'Staff deleted successfully' });
    });
});

module.exports = router;
