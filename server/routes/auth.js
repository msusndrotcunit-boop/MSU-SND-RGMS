const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database');
const { SECRET_KEY, authenticateToken } = require('../middleware/auth');

const router = express.Router();


// Register (Sign Up) for Cadets - REMOVED
// router.post('/signup', ...);

// Heartbeat for Online Status
router.post('/heartbeat', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const now = new Date().toISOString();
    db.run("UPDATE users SET last_seen = ? WHERE id = ?", [now, userId], (err) => {
        if (err) console.error("Heartbeat error:", err);
        // Fail silently to client
        res.sendStatus(200);
    });
});

// GET /api/auth/settings - Fetch user settings
router.get('/settings', authenticateToken, (req, res) => {
    const userId = req.user.id;
    db.get("SELECT * FROM user_settings WHERE user_id = ?", [userId], (err, row) => {
        if (err) return res.status(500).json({ message: err.message });
        if (!row) {
            // Return defaults if no settings found
            return res.json({
                email_alerts: true,
                push_notifications: true,
                activity_updates: true,
                dark_mode: false,
                compact_mode: false,
                primary_color: 'blue'
            });
        }
        
        // Convert integer booleans (SQLite) to JS booleans if needed
        const settings = {
            email_alerts: !!row.email_alerts,
            push_notifications: !!row.push_notifications,
            activity_updates: !!row.activity_updates,
            dark_mode: !!row.dark_mode,
            compact_mode: !!row.compact_mode,
            primary_color: row.primary_color
        };
        res.json(settings);
    });
});

// PUT /api/auth/settings - Update user settings
router.put('/settings', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const { 
        email_alerts, 
        push_notifications, 
        activity_updates, 
        dark_mode, 
        compact_mode, 
        primary_color 
    } = req.body;

    // Pass booleans directly. 
    // SQLite driver converts true/false to 1/0.
    // Postgres driver converts true/false to BOOLEAN true/false.
    
    const e = email_alerts;
    const p = push_notifications;
    const a = activity_updates;
    const d = dark_mode;
    const c = compact_mode;
    const col = primary_color || 'blue';

    db.get("SELECT 1 FROM user_settings WHERE user_id = ?", [userId], (err, row) => {
        if (err) return res.status(500).json({ message: err.message });
        
        if (row) {
            // Update
            const sql = `UPDATE user_settings SET 
                email_alerts = ?, 
                push_notifications = ?, 
                activity_updates = ?, 
                dark_mode = ?, 
                compact_mode = ?, 
                primary_color = ? 
                WHERE user_id = ?`;
            db.run(sql, [e, p, a, d, c, col, userId], (updateErr) => {
                if (updateErr) return res.status(500).json({ message: updateErr.message });
                res.json({ message: 'Settings updated' });
            });
        } else {
            // Insert
            const sql = `INSERT INTO user_settings (user_id, email_alerts, push_notifications, activity_updates, dark_mode, compact_mode, primary_color) VALUES (?, ?, ?, ?, ?, ?, ?)`;
            db.run(sql, [userId, e, p, a, d, c, col], (insertErr) => {
                if (insertErr) return res.status(500).json({ message: insertErr.message });
                res.json({ message: 'Settings created' });
            });
        }
    });
});

// Login
router.post('/login', (req, res) => {
    const { username, password } = req.body;

    db.get(`SELECT * FROM users WHERE username = ?`, [username], async (err, user) => {
        if (err) return res.status(500).json({ message: err.message });
        if (!user) return res.status(400).json({ message: 'User not found' });

        if (user.is_approved === 0) {
            return res.status(403).json({ message: 'Your account is pending approval by the administrator.' });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) return res.status(400).json({ message: 'Invalid credentials' });

        const token = jwt.sign({ id: user.id, role: user.role, cadetId: user.cadet_id, staffId: user.staff_id }, SECRET_KEY, { expiresIn: '1h' });
        
        // Notify Admin of Login if it's a cadet (or staff?)
        if (user.role === 'cadet' || user.role === 'training_staff') {
            const displayName = user.username; // Or fetch name if available
            const notifMsg = `${displayName} (${user.role}) has logged in.`;
            db.run(`INSERT INTO notifications (user_id, message, type) VALUES (NULL, ?, ?)`, 
                [notifMsg, 'login'], 
                (nErr) => {
                    if (nErr) console.error("Error creating login notification:", nErr);
                }
            );
        }

        // Update last_seen
        const now = new Date().toISOString();
        db.run("UPDATE users SET last_seen = ? WHERE id = ?", [now, user.id], (err) => { if(err) console.error(err); });

        res.json({ token, role: user.role, cadetId: user.cadet_id, staffId: user.staff_id, isProfileCompleted });
    });
});

// Cadet Login (No Password)
router.post('/cadet-login', (req, res) => {
    const { identifier } = req.body; // Can be Student ID or Email

    if (!identifier) {
        return res.status(400).json({ message: 'Please enter your Username or Email.' });
    }

    // Check by Username (Student ID) or Email
    // Only for role = 'cadet'
    // Join with cadets to get is_profile_completed status and Name
    const sql = `
        SELECT u.*, c.is_profile_completed, c.first_name, c.last_name
        FROM users u 
        LEFT JOIN cadets c ON u.cadet_id = c.id 
        WHERE (u.username = ? OR u.email = ?) AND u.role = 'cadet'
    `;
    
    db.get(sql, [identifier, identifier], (err, user) => {
        if (err) return res.status(500).json({ message: err.message });
        
        if (!user) {
            return res.status(400).json({ message: 'User not found. Please contact your administrator if you believe this is an error.' });
        }

        if (user.is_approved === 0) {
            // Should be rare if imported, but safe check
            return res.status(403).json({ message: 'Your account is not authorized.' });
        }

        // Generate Token
        const token = jwt.sign({ id: user.id, role: user.role, cadetId: user.cadet_id }, SECRET_KEY, { expiresIn: '24h' }); // Longer session for cadets?
        
        // Notify Admin of Login
        const displayName = (user.first_name && user.last_name) ? `${user.first_name} ${user.last_name}` : user.username;
        const notifMsg = `${displayName} has accessed the portal.`;
        db.run(`INSERT INTO notifications (user_id, message, type) VALUES (NULL, ?, ?)`, 
            [notifMsg, 'login'], 
            (nErr) => {
                if (nErr) console.error("Error creating login notification:", nErr);
            }
        );

        // Update last_seen
        const now = new Date().toISOString();
        db.run("UPDATE users SET last_seen = ? WHERE id = ?", [now, user.id], (err) => { if(err) console.error(err); });

        res.json({ 
            token, 
            role: user.role, 
            cadetId: user.cadet_id,
            isProfileCompleted: user.is_profile_completed // Return this flag
        });
    });
});

// Staff Login (Same as Cadet Login but checks training_staff role)
// User requested "login route for training staff in the cadet login route"
router.post('/staff-login-no-pass', (req, res) => {
    const { identifier } = req.body; 

    if (!identifier) {
        return res.status(400).json({ message: 'Please enter your Username or Email.' });
    }

    const sql = `
        SELECT u.*, s.is_profile_completed, s.first_name, s.last_name
        FROM users u 
        LEFT JOIN training_staff s ON u.staff_id = s.id 
        WHERE (u.username = ? OR u.email = ?) AND u.role = 'training_staff'
    `;
    
    db.get(sql, [identifier, identifier], (err, user) => {
        if (err) return res.status(500).json({ message: err.message });
        
        if (!user) {
            return res.status(400).json({ message: 'Staff user not found.' });
        }

        const token = jwt.sign({ id: user.id, role: user.role, staffId: user.staff_id }, SECRET_KEY, { expiresIn: '24h' });
        
        // Update last_seen
        const now = new Date().toISOString();
        db.run("UPDATE users SET last_seen = ? WHERE id = ?", [now, user.id], (err) => { if(err) console.error(err); });

        res.json({ 
            token, 
            role: user.role, 
            staffId: user.staff_id,
            isProfileCompleted: user.is_profile_completed
        });
    });
});

// Seed Admin (Manual or specific admin)
router.post('/seed-admin', async (req, res) => {
    // Specific credentials from requirements
    const username = 'msu-sndrotc_admin';
    const password = 'admingrading@2026';
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Check if exists
    db.get("SELECT * FROM users WHERE username = ?", [username], (err, row) => {
        if (row) {
             // Update password if exists
             db.run("UPDATE users SET password = ?, is_approved = 1 WHERE username = ?", [hashedPassword, username], (err) => {
                 if (err) return res.status(500).json({ message: err.message });
                 res.json({ message: 'Admin updated' });
             });
        } else {
            // Create
            db.run(`INSERT INTO users (username, password, role, is_approved) VALUES (?, ?, ?, 1)`, 
                [username, hashedPassword, 'admin'], 
                (err) => {
                    if (err) return res.status(500).json({ message: err.message });
                    res.json({ message: 'Admin seeded' });
                }
            );
        }
    });
});

module.exports = router;