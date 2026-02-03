const express = require('express');
const router = express.Router();
const db = require('../database');
const bcrypt = require('bcryptjs');
const { authenticateToken } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const webpush = require('web-push');

// Configure Multer for image upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, 'staff-' + Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|gif/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        if (mimetype && extname) return cb(null, true);
        cb(new Error('Only images are allowed (jpeg, jpg, png, gif)'));
    }
});

// Middleware to check if admin
const isAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied. Admins only.' });
    }
    next();
};

// GET Staff Analytics (Admin)
router.get('/analytics/overview', authenticateToken, isAdmin, (req, res) => {
    const analytics = {};

    db.get("SELECT COUNT(*) as total FROM training_staff", [], (err, row) => {
        if (err) return res.status(500).json({ message: err.message });
        analytics.totalStaff = row.total;

        db.all("SELECT rank, COUNT(*) as count FROM training_staff GROUP BY rank", [], (err, rows) => {
            if (err) return res.status(500).json({ message: err.message });
            analytics.staffByRank = rows;

            db.all("SELECT status, COUNT(*) as count FROM staff_attendance_records GROUP BY status", [], (err, rows) => {
                if (err) return res.status(500).json({ message: err.message });
                analytics.attendanceStats = rows;
                
                res.json(analytics);
            });
        });
    });
});

// Edit a message
router.put('/chat/messages/:id', authenticateToken, (req, res) => {
    const { content } = req.body;
    const messageId = req.params.id;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
        return res.status(400).json({ message: 'Message content is required.' });
    }

    db.get('SELECT sender_staff_id FROM staff_messages WHERE id = ?', [messageId], (err, row) => {
        if (err) return res.status(500).json({ message: err.message });
        if (!row) return res.status(404).json({ message: 'Message not found.' });

        if (req.user.role !== 'admin' && row.sender_staff_id !== req.user.staffId) {
             return res.status(403).json({ message: 'You can only edit your own messages.' });
        }

        db.run('UPDATE staff_messages SET content = ? WHERE id = ?', [content.trim(), messageId], (err) => {
            if (err) return res.status(500).json({ message: err.message });
            res.json({ message: 'Message updated' });
        });
    });
});

// Delete a message
router.delete('/chat/messages/:id', authenticateToken, (req, res) => {
    const messageId = req.params.id;

    db.get('SELECT sender_staff_id FROM staff_messages WHERE id = ?', [messageId], (err, row) => {
        if (err) return res.status(500).json({ message: err.message });
        if (!row) return res.status(404).json({ message: 'Message not found.' });

        if (req.user.role !== 'admin' && row.sender_staff_id !== req.user.staffId) {
             return res.status(403).json({ message: 'You can only delete your own messages.' });
        }

        db.run('DELETE FROM staff_messages WHERE id = ?', [messageId], (err) => {
            if (err) return res.status(500).json({ message: err.message });
            res.json({ message: 'Message deleted' });
        });
    });
});

// GET All Staff (Admin)
router.get('/', authenticateToken, isAdmin, (req, res) => {
    const sql = `
        SELECT s.*, u.username 
        FROM training_staff s 
        LEFT JOIN users u ON u.staff_id = s.id 
        ORDER BY s.last_name ASC
    `;
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json(rows);
    });
});

// UPLOAD Profile Picture (Me)
router.post('/profile/photo', authenticateToken, upload.single('image'), (req, res) => {
    if (!req.user.staffId) return res.status(403).json({ message: 'Access denied.' });
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    const filePath = `/uploads/${req.file.filename}`;

    // Update both training_staff and users table
    db.run("UPDATE training_staff SET profile_pic = ? WHERE id = ?", [filePath, req.user.staffId], (err) => {
        if (err) {
            console.error("Error updating staff profile pic:", err);
            return res.status(500).json({ message: 'Database error' });
        }

        db.run("UPDATE users SET profile_pic = ? WHERE staff_id = ?", [filePath, req.user.staffId], (uErr) => {
             if (uErr) console.error("Error updating user profile pic:", uErr);
             
             res.json({ message: 'Profile picture updated', filePath });
        });
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
    let params = [rank, first_name, middle_name, last_name, suffix_name, email, contact_number, role || 'Instructor', profile_pic];

    const insertStaff = () => new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) return reject(err);
            resolve(this.lastID);
        });
    });
    
    let staffId;
    try {
        staffId = await insertStaff();
    } catch (e) {
        const msg = e.message || '';
        const isUniqueEmail = msg.includes('UNIQUE') || msg.includes('duplicate key') || msg.includes('unique constraint');
        if (isUniqueEmail) {
            params[5] = null;
            try {
                staffId = await insertStaff();
            } catch (e2) {
                return res.status(500).json({ message: e2.message });
            }
        } else {
            return res.status(500).json({ message: msg });
        }
    }
        
    db.get("SELECT COUNT(*) as count FROM training_staff WHERE first_name = ? COLLATE NOCASE", [first_name], async (err, row) => {
        if (err) {}

        const nameCount = row ? row.count : 1;
        const cleanFirst = first_name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        const cleanLast = last_name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

        let passwordStr = (nameCount > 1) ? cleanLast : cleanFirst;
        let usernameBase = (nameCount > 1) ? cleanLast : cleanFirst;

        try {
            const hashedPassword = await bcrypt.hash(passwordStr, 10);
            const tryInsertUser = (attemptStage, currentUsername) => {
                const userSql = `INSERT INTO users (username, password, role, staff_id, is_approved, email, profile_pic) VALUES (?, ?, 'training_staff', ?, 1, ?, ?)`;
                db.run(userSql, [currentUsername, hashedPassword, staffId, params[5] || null, profile_pic], (uErr) => {
                    if (uErr) {
                         if (uErr.message.includes('UNIQUE') || uErr.message.includes('duplicate key')) {
                             if (attemptStage === 1) {
                                 tryInsertUser(2, `${cleanFirst}.${cleanLast}`);
                             } else if (attemptStage === 2) {
                                 tryInsertUser(3, `${cleanLast}.${cleanFirst}`);
                             } else {
                                 const newUsername = usernameBase + Math.floor(Math.random() * 1000);
                                 tryInsertUser(4, newUsername);
                             }
                         } else {
                            return res.json({ message: 'Staff profile created, but user account creation failed. ' + uErr.message, id: staffId });
                         }
                    } else {
                        res.json({ message: `Staff created successfully. Username: ${currentUsername}, Password: "${passwordStr}"`, id: staffId });
                    }
                });
            };
            tryInsertUser(1, usernameBase);
        } catch (hashErr) {
            res.status(500).json({ message: 'Error hashing password' });
        }
    });

});

// UPDATE Staff
router.put('/:id', authenticateToken, isAdmin, (req, res) => {
    const { rank, first_name, middle_name, last_name, suffix_name, email, contact_number, role, profile_pic, username } = req.body;
    const sql = `UPDATE training_staff SET rank = ?, first_name = ?, middle_name = ?, last_name = ?, suffix_name = ?, email = ?, contact_number = ?, role = ?, profile_pic = ? WHERE id = ?`;
    
    db.run(sql, [rank, first_name, middle_name, last_name, suffix_name, email, contact_number, role, profile_pic, req.params.id], function(err) {
        if (err) return res.status(500).json({ message: err.message });

        // Update User Account (Username/Email)
        if (email || username) {
            let updateFields = [];
            let updateParams = [];

            if (email) {
                updateFields.push("email = ?");
                updateParams.push(email);
            }
            if (username) {
                updateFields.push("username = ?");
                updateParams.push(username);
            }

            if (updateFields.length > 0) {
                updateParams.push(req.params.id);
                const userSql = `UPDATE users SET ${updateFields.join(", ")} WHERE staff_id = ?`;
                
                db.run(userSql, updateParams, (uErr) => {
                    if (uErr) console.error("Error syncing staff user credentials:", uErr);
                });
            }
        }

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

// Acknowledge User Guide
router.post('/acknowledge-guide', authenticateToken, (req, res) => {
    if (!req.user.staffId) return res.status(403).json({ message: 'Access denied.' });
    
    db.run("UPDATE training_staff SET has_seen_guide = 1 WHERE id = ?", [req.user.staffId], (err) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json({ message: 'User guide acknowledged' });
    });
});

// --- Notifications ---

// Get Notifications (Staff)
router.get('/notifications', authenticateToken, (req, res) => {
    // Fetch notifications where user_id is NULL (system/global) or matches staff's user ID
    const sql = `SELECT * FROM notifications WHERE user_id IS NULL OR user_id = ? ORDER BY created_at DESC LIMIT 50`;
    db.all(sql, [req.user.id], (err, rows) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json(rows);
    });
});

// Mark Notification as Read
router.put('/notifications/:id/read', authenticateToken, (req, res) => {
    db.run(`UPDATE notifications SET is_read = 1 WHERE id = ?`, [req.params.id], function(err) {
        if (err) return res.status(500).json({ message: err.message });
        res.json({ message: 'Marked as read' });
    });
});

// Mark All as Read
router.put('/notifications/read-all', authenticateToken, (req, res) => {
    // Updates both global (NULL) and personal notifications visible to this user
    db.run(`UPDATE notifications SET is_read = 1 WHERE (user_id IS NULL OR user_id = ?) AND is_read = 0`, [req.user.id], function(err) {
        if (err) return res.status(500).json({ message: err.message });
        res.json({ message: 'All marked as read' });
    });
});

module.exports = router;
 
// --- Communication Panel for Training Staff ---
// List recent messages (last 100)
router.get('/chat/messages', authenticateToken, (req, res) => {
    // Allow admins and training_staff to read
    if (req.user.role !== 'training_staff' && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied.' });
    }
    const sql = `
        SELECT m.id, m.content, m.created_at, 
               s.id as staff_id, s.first_name, s.last_name, s.rank, s.profile_pic
        FROM staff_messages m
        JOIN training_staff s ON s.id = m.sender_staff_id
        ORDER BY m.id DESC
        LIMIT 100
    `;
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ message: err.message });
        // Return in ascending order by time for UI display
        res.json(rows.reverse());
    });
});

// Get latest message for polling/notifications
router.get('/chat/latest', authenticateToken, (req, res) => {
    if (req.user.role !== 'training_staff' && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied.' });
    }
    const sql = `
        SELECT m.id, m.content, m.created_at, 
               s.first_name, s.last_name, s.rank
        FROM staff_messages m
        JOIN training_staff s ON s.id = m.sender_staff_id
        ORDER BY m.id DESC
        LIMIT 1
    `;
    db.get(sql, [], (err, row) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json(row || null);
    });
});

// Post a new message
router.post('/chat/messages', authenticateToken, (req, res) => {
    if (req.user.role !== 'training_staff' && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied.' });
    }
    const { content } = req.body || {};
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
        return res.status(400).json({ message: 'Message content is required.' });
    }
    if (!req.user.staffId && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Staff identity required.' });
    }
    const senderId = req.user.staffId || null;
    if (!senderId && req.user.role === 'admin') {
        // For admin messages, we can optionally store sender_staff_id as NULL
        // But schema requires NOT NULL, so disallow admin without staffId for now
        return res.status(403).json({ message: 'Admin must have a staff profile to post.' });
    }
    db.run(`INSERT INTO staff_messages (sender_staff_id, content) VALUES (?, ?)`, [senderId, content.trim()], function(err) {
        if (err) return res.status(500).json({ message: err.message });
        res.json({ id: this.lastID, message: 'Message posted' });

        // Send Push Notifications
        db.get(`SELECT rank, last_name FROM training_staff WHERE id = ?`, [senderId], (err, sender) => {
            if (err || !sender) return;

            const notificationPayload = JSON.stringify({
                title: `${sender.rank} ${sender.last_name}`,
                body: content.trim(),
                url: '/staff/communication',
                icon: '/pwa-192x192.png'
            });

            // Get all subscriptions except the sender
            db.all(`SELECT * FROM push_subscriptions WHERE user_id != ?`, [req.user.id], (err, subscriptions) => {
                if (err) return console.error('Error fetching subscriptions:', err);

                subscriptions.forEach(sub => {
                    let pushSubscription;
                    try {
                        pushSubscription = {
                            endpoint: sub.endpoint,
                            keys: JSON.parse(sub.keys)
                        };
                    } catch (e) {
                        return;
                    }

                    webpush.sendNotification(pushSubscription, notificationPayload)
                        .catch(error => {
                            // console.error('Error sending notification:', error);
                            if (error.statusCode === 410 || error.statusCode === 404) {
                                db.run('DELETE FROM push_subscriptions WHERE id = ?', [sub.id]);
                            }
                        });
                });
            });
        });
    });
});
