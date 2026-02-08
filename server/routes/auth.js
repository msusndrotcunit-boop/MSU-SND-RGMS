const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database');
const { SECRET_KEY, authenticateToken } = require('../middleware/auth');

const router = express.Router();


// Register (Sign Up) for Cadets - REMOVED
// router.post('/signup', ...);

router.post('/heartbeat', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const now = new Date().toISOString();
    db.run("UPDATE users SET last_seen = ? WHERE id = ?", [now, userId], (err) => {
        if (err) console.error("Heartbeat error:", err);
        // Fail silently to client
        res.sendStatus(200);
    });
});

router.post('/location', authenticateToken, (req, res) => {
    const { latitude, longitude } = req.body || {};
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
        return res.status(400).json({ message: 'Invalid location payload' });
    }
    const sql = `
        UPDATE users 
        SET last_latitude = ?, last_longitude = ?, last_location_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `;
    db.run(sql, [latitude, longitude, req.user.id], (err) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json({ message: 'Location updated' });
    });
});

// GET /api/auth/settings - Fetch user settings
router.get('/settings', authenticateToken, (req, res) => {
    const userId = req.user.id;
    db.get("SELECT * FROM user_settings WHERE user_id = ?", [userId], (err, row) => {
        if (err) {
            console.error("Error fetching settings:", err);
            return res.status(500).json({ message: err.message });
        }
        if (!row) {
            console.log(`No settings found for user ${userId}, returning defaults`);
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
        // console.log(`Settings for user ${userId}:`, settings);
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

    console.log(`Updating settings for user ${userId}:`, req.body);

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
        if (err) {
            console.error("Error checking settings existence:", err);
            return res.status(500).json({ message: err.message });
        }
        
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
                if (updateErr) {
                    console.error("Error updating settings:", updateErr);
                    return res.status(500).json({ message: updateErr.message });
                }
                res.json({ message: 'Settings updated' });
            });
        } else {
            // Insert
            const sql = `INSERT INTO user_settings (user_id, email_alerts, push_notifications, activity_updates, dark_mode, compact_mode, primary_color) VALUES (?, ?, ?, ?, ?, ?, ?)`;
            db.run(sql, [userId, e, p, a, d, c, col], (insertErr) => {
                if (insertErr) {
                    console.error("Error creating settings:", insertErr);
                    return res.status(500).json({ message: insertErr.message });
                }
                res.json({ message: 'Settings created' });
            });
        }
    });
});

// GET /api/auth/system-settings - Fetch system-wide settings (defaults applied to all users)
router.get('/system-settings', authenticateToken, (req, res) => {
    const keys = [
        'email_alerts_default',
        'push_notifications_default',
        'activity_updates_default',
        'dark_mode_default',
        'compact_mode_default',
        'primary_color'
    ];
    db.all("SELECT key, value FROM system_settings WHERE key IN (?, ?, ?, ?, ?, ?)", keys, (err, rows) => {
        if (err) return res.status(500).json({ message: err.message });
        const map = {};
        (rows || []).forEach(r => { map[r.key] = r.value; });
        const toBool = (v) => v === 1 || v === '1' || v === true || (typeof v === 'string' && v.toLowerCase() === 'true');
        const settings = {
            email_alerts: toBool(map.email_alerts_default ?? '1'),
            push_notifications: toBool(map.push_notifications_default ?? '1'),
            activity_updates: toBool(map.activity_updates_default ?? '1'),
            dark_mode: toBool(map.dark_mode_default ?? '0'),
            compact_mode: toBool(map.compact_mode_default ?? '0'),
            primary_color: map.primary_color ?? 'blue'
        };
        res.json(settings);
    });
});

// TEST ROUTE
router.get('/', (req, res) => {
    res.json({ message: 'Auth Router is mounted and working' });
});

// Login
router.post('/login', (req, res) => {
    let { username, password } = req.body;
    
    // DEBUG LOG
    console.log(`[Login Attempt] Username: ${username}, IP: ${req.ip}`);

    if (!username || !password) return res.status(400).json({ message: 'Username and password are required.' });
    
    username = username.trim(); // TRIM USERNAME

    db.get(`SELECT * FROM users WHERE username = ? OR email = ?`, [username, username], async (err, user) => {
        if (err) {
            console.error('[Login Error] Database:', err);
            return res.status(500).json({ message: `Database Error: ${err.message}` });
        }
        if (!user) {
            console.log('[Login Failed] User not found:', username);
            return res.status(400).json({ message: 'User not found. Please check your username.' });
        }

        // console.log('User found:', { id: user.id, role: user.role, is_approved: user.is_approved });

        if (user.is_approved === 0) {
            console.log('[Login Failed] User pending approval:', username);
            return res.status(403).json({ message: 'Your account is pending approval by the administrator.' });
        }

        try {
            if (!user.password) {
                console.error('[Login Failed] No password set for:', username);
                return res.status(500).json({ message: 'Account configuration error. Please contact support.' });
            }

            const validPassword = await bcrypt.compare(password, user.password);
            
            if (!validPassword) {
                console.log('[Login Failed] Invalid password for:', username);
                return res.status(400).json({ message: 'Invalid password. Please try again.' });
            }

            console.log('[Login Success] User:', username);

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

            let isProfileCompleted = true;
            
            if (user.role === 'cadet') {
                 // Fetch from cadets table
                 db.get("SELECT is_profile_completed FROM cadets WHERE id = ?", [user.cadet_id], (err, row) => {
                     if (!err && row) isProfileCompleted = !!row.is_profile_completed;
                     res.json({ token, role: user.role, cadetId: user.cadet_id, staffId: user.staff_id, isProfileCompleted });
                 });
            } else if (user.role === 'training_staff') {
                 // Fetch from training_staff table
                 db.get("SELECT is_profile_completed FROM training_staff WHERE id = ?", [user.staff_id], (err, row) => {
                     if (!err && row) isProfileCompleted = !!row.is_profile_completed;
                     res.json({ token, role: user.role, cadetId: user.cadet_id, staffId: user.staff_id, isProfileCompleted });
                 });
            } else {
                 res.json({ token, role: user.role, cadetId: user.cadet_id, staffId: user.staff_id, isProfileCompleted });
            }
        } catch (authError) {
            console.error('Login Auth Error:', authError);
            res.status(500).json({ message: 'Authentication failed due to server error.' });
        }
    });
});

// DEBUG: Check user existence
router.get('/debug-check-user/:username', (req, res) => {
    const { username } = req.params;
    db.get("SELECT id, username, role, is_approved, email FROM users WHERE username = ? OR email = ?", [username, username], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ message: 'User not found in DB' });
        res.json(row);
    });
});


// Cadet Login (No Password)
router.post('/cadet-login', (req, res) => {
    let { identifier } = req.body; // Can be Student ID or Email

    if (!identifier) {
        return res.status(400).json({ message: 'Please enter your Username or Email.' });
    }
    
    identifier = identifier.trim();

    // Check by Username (Student ID) or Email
    // Only for role = 'cadet'
    // Join with cadets to get is_profile_completed status and Name
    const sql = `
        SELECT u.*, c.is_profile_completed, c.first_name, c.last_name
        FROM users u 
        LEFT JOIN cadets c ON u.cadet_id = c.id 
        WHERE (u.username = ? OR u.email = ?)
    `;
    
    db.get(sql, [identifier, identifier], (err, user) => {
        if (err) return res.status(500).json({ message: err.message });
        
        if (!user) {
            return res.status(400).json({ message: 'User not found. Please contact your administrator if you believe this is an error.' });
        }

        // SMART ERROR: Wrong Role
        if (user.role !== 'cadet') {
            return res.status(400).json({ 
                message: `You are trying to login as a Cadet, but this account belongs to a ${user.role === 'training_staff' ? 'Staff' : 'Admin'}. Please switch to the correct login tab.` 
            });
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
    let { identifier } = req.body; 

    if (!identifier) {
        return res.status(400).json({ message: 'Please enter your Username or Email.' });
    }
    
    identifier = identifier.trim();

    const sql = `
        SELECT u.*, s.is_profile_completed, s.first_name, s.last_name
        FROM users u 
        LEFT JOIN training_staff s ON u.staff_id = s.id 
        WHERE (u.username = ? OR u.email = ?)
    `;
    
    db.get(sql, [identifier, identifier], (err, user) => {
        if (err) return res.status(500).json({ message: err.message });
        
        if (!user) {
            return res.status(400).json({ message: 'Staff user not found.' });
        }

        // SMART ERROR: Wrong Role
        if (user.role !== 'training_staff') {
            return res.status(400).json({ 
                message: `You are trying to login as Staff, but this account belongs to a ${user.role === 'cadet' ? 'Cadet' : 'Admin'}. Please switch to the correct login tab.` 
            });
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

// EMERGENCY ROUTE: Force Reset Admin Password
// This is a GET request so it can be triggered easily via browser
router.get('/force-admin-reset', async (req, res) => {
    const username = 'msu-sndrotc_admin';
    const password = 'admingrading@2026';
    
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        
        db.get("SELECT * FROM users WHERE username = ?", [username], (err, row) => {
            if (err) return res.status(500).json({ message: 'DB Error finding admin', error: err.message });
            
            if (row) {
                 db.run("UPDATE users SET password = ?, is_approved = 1 WHERE username = ?", [hashedPassword, username], (err) => {
                     if (err) return res.status(500).json({ message: 'DB Error updating admin', error: err.message });
                     res.json({ 
                         message: 'SUCCESS: Admin password has been reset.', 
                         details: 'You can now login with: msu-sndrotc_admin / admingrading@2026' 
                     });
                 });
            } else {
                // Create if missing
                db.run(`INSERT INTO users (username, password, role, is_approved) VALUES (?, ?, 'admin', 1)`, 
                    [username, hashedPassword], 
                    (err) => {
                        if (err) return res.status(500).json({ message: 'DB Error creating admin', error: err.message });
                        res.json({ 
                            message: 'SUCCESS: Admin account created.', 
                            details: 'You can now login with: msu-sndrotc_admin / admingrading@2026' 
                        });
                    }
                );
            }
        });
    } catch (e) {
        res.status(500).json({ message: 'Server Error', error: e.message });
    }
});

module.exports = router;
