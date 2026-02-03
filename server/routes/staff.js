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
    
    // Join with users table to get username
    const sql = `SELECT s.*, u.username 
                 FROM training_staff s 
                 LEFT JOIN users u ON u.staff_id = s.id 
                 WHERE s.id = ?`;

    db.get(sql, [req.user.staffId], (err, row) => {
        if (err) return res.status(500).json({ message: err.message });
        if (!row) return res.status(404).json({ message: 'Staff profile not found' });
        res.json(row);
    });
});

// UPDATE Current Staff Profile (Me) - Complete Profile
router.put('/profile', authenticateToken, (req, res) => {
    if (!req.user.staffId) return res.status(403).json({ message: 'Access denied.' });
    
    const { 
        rank, first_name, middle_name, last_name, suffix_name, email, contact_number, 
        profile_pic, afpsn, birthdate, birthplace, age, height, weight, blood_type, 
        address, civil_status, nationality, gender, language_spoken, 
        combat_boots_size, uniform_size, bullcap_size, facebook_link, 
        rotc_unit, mobilization_center, username, is_profile_completed
    } = req.body;

    // Helper to proceed with update
    const proceedUpdate = () => {
        // Build the SQL dynamically based on provided fields
        const sql = `UPDATE training_staff SET 
            rank = COALESCE(?, rank), 
            first_name = COALESCE(?, first_name), 
            middle_name = COALESCE(?, middle_name), 
            last_name = COALESCE(?, last_name), 
            suffix_name = COALESCE(?, suffix_name), 
            email = COALESCE(?, email), 
            contact_number = COALESCE(?, contact_number), 
            profile_pic = COALESCE(?, profile_pic),
            afpsn = COALESCE(?, afpsn),
            birthdate = COALESCE(?, birthdate),
            birthplace = COALESCE(?, birthplace),
            age = COALESCE(?, age),
            height = COALESCE(?, height),
            weight = COALESCE(?, weight),
            blood_type = COALESCE(?, blood_type),
            address = COALESCE(?, address),
            civil_status = COALESCE(?, civil_status),
            nationality = COALESCE(?, nationality),
            gender = COALESCE(?, gender),
            language_spoken = COALESCE(?, language_spoken),
            combat_boots_size = COALESCE(?, combat_boots_size),
            uniform_size = COALESCE(?, uniform_size),
            bullcap_size = COALESCE(?, bullcap_size),
            facebook_link = COALESCE(?, facebook_link),
            rotc_unit = COALESCE(?, rotc_unit),
            mobilization_center = COALESCE(?, mobilization_center),
            is_profile_completed = COALESCE(?, is_profile_completed)
            WHERE id = ?`;
        
        const params = [
            rank, first_name, middle_name, last_name, suffix_name, email, contact_number, 
            profile_pic, afpsn, birthdate, birthplace, age, height, weight, blood_type, 
            address, civil_status, nationality, gender, language_spoken, 
            combat_boots_size, uniform_size, bullcap_size, facebook_link, 
            rotc_unit, mobilization_center,
            is_profile_completed !== undefined ? is_profile_completed : null,
            req.user.staffId
        ];
        
        db.run(sql, params, function(err) {
            if (err) return res.status(500).json({ message: err.message });
            
            // Also update users table email, profile_pic, and username if changed
            if (email || profile_pic || username) {
                let updateFields = [];
                let updateParams = [];
                
                if (email) {
                    updateFields.push("email = ?");
                    updateParams.push(email);
                    
                    // FORCE Username to be Email when updating profile
                    updateFields.push("username = ?");
                    updateParams.push(email);
                }
                if (profile_pic) {
                    updateFields.push("profile_pic = ?");
                    updateParams.push(profile_pic);
                }
                // Ignore provided username if email is present, otherwise use it (fallback)
                if (username && !email) {
                    updateFields.push("username = ?");
                    updateParams.push(username);
                }
                
                if (updateFields.length > 0) {
                    const userSql = `UPDATE users SET ${updateFields.join(", ")} WHERE staff_id = ?`;
                    updateParams.push(req.user.staffId);
                    
                    db.run(userSql, updateParams, (uErr) => {
                       if (uErr) {
                           console.error("Error updating user table:", uErr);
                           // If unique constraint failed here, it's problematic because staff table is already updated.
                           // ideally we check before, which we do below.
                       }
                    });
                }
            }
            
            res.json({ message: 'Profile updated successfully', isProfileCompleted: is_profile_completed });
        });
    };

    // Check email uniqueness if email is changing
    if (email) {
        db.get("SELECT id FROM users WHERE (email = ? OR username = ?) AND staff_id != ?", [email, email, req.user.staffId], (err, row) => {
            if (err) return res.status(500).json({ message: err.message });
            if (row) {
                return res.status(400).json({ message: 'Email/Username is already in use by another account.' });
            }
            proceedUpdate();
        });
    } else {
        proceedUpdate();
    }
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
        const defaultPassword = 'staffpassword'; 
        
        try {
            const hashedPassword = await bcrypt.hash(defaultPassword, 10);
            
            // Clean names for username generation
            const cleanLast = last_name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
            const cleanFirst = first_name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

            // Recursive function to handle username collisions
            // Priority: Last Name -> First Name -> Last.First -> Last + Random
            const tryInsertUser = (attemptStage, currentUsername) => {
                const userSql = `INSERT INTO users (username, password, role, staff_id, is_approved, email, profile_pic) VALUES (?, ?, 'training_staff', ?, 1, ?, ?)`;
                
                db.run(userSql, [currentUsername, hashedPassword, staffId, email, profile_pic], (uErr) => {
                    if (uErr) {
                         if (uErr.message.includes('UNIQUE constraint') || uErr.message.includes('duplicate key')) {
                             console.log(`Username ${currentUsername} taken. Trying next option...`);
                             
                             if (attemptStage === 1) {
                                 // Failed Last Name, try First Name
                                 tryInsertUser(2, cleanFirst);
                             } else if (attemptStage === 2) {
                                 // Failed First Name, try First.Last
                                 tryInsertUser(3, `${cleanFirst}.${cleanLast}`);
                             } else {
                                 // Failed all standard options, append random number to Last Name
                                 const newUsername = cleanLast + Math.floor(Math.random() * 1000);
                                 tryInsertUser(4, newUsername);
                             }
                         } else {
                            console.error('Error creating user for staff:', uErr);
                            // Don't fail the request, just warn
                            return res.json({ message: 'Staff profile created, but user account creation failed. ' + uErr.message, id: staffId });
                         }
                    } else {
                        res.json({ message: `Staff created successfully. Username: ${currentUsername}, Password: "${defaultPassword}"`, id: staffId });
                    }
                });
            };

            // Start with Last Name (Stage 1)
            tryInsertUser(1, cleanLast);

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
    const staffId = req.params.id;
    
    // First delete the user account associated with this staff
    db.run("DELETE FROM users WHERE staff_id = ?", [staffId], (err) => {
        if (err) {
            console.error('Error deleting user account for staff:', err);
            // Proceed to delete staff profile anyway? Or fail?
            // Better to proceed so we don't get stuck with undeletable staff.
        }
        
        // Then delete the staff profile
        db.run("DELETE FROM training_staff WHERE id = ?", [staffId], function(err) {
            if (err) return res.status(500).json({ message: err.message });
            res.json({ message: 'Staff deleted successfully' });
        });
    });
});

module.exports = router;
