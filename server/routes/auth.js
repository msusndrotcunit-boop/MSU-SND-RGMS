const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database');
const { SECRET_KEY, authenticateToken } = require('../middleware/auth');
const admin = require('../utils/firebaseAdmin');

const router = express.Router();

// Get Firebase Custom Token
router.get('/firebase-token', authenticateToken, async (req, res) => {
    try {
        const uid = req.user.id.toString();
        const additionalClaims = {
            role: req.user.role,
            cadetId: req.user.cadetId,
            admin: req.user.role === 'admin'
        };

        if (admin.apps.length === 0) {
            return res.status(503).json({ message: "Firebase not initialized on server" });
        }

        const customToken = await admin.auth().createCustomToken(uid, additionalClaims);
        res.json({ token: customToken });
    } catch (error) {
        console.error("Error creating custom token:", error);
        res.status(500).json({ message: "Failed to create Firebase token" });
    }
});

// Register (Sign Up) for Cadets - REMOVED
// router.post('/signup', ...);

// Login
router.post('/login', (req, res) => {
    const { username, password } = req.body;
    console.log(`Login attempt for username: ${username}`);

    db.get(`SELECT * FROM users WHERE username = ?`, [username], async (err, user) => {
        if (err) {
            console.error('Login DB Error:', err);
            return res.status(500).json({ message: err.message });
        }
        if (!user) {
            console.log('User not found');
            return res.status(400).json({ message: 'User not found' });
        }

        if (user.is_approved === 0) {
            console.log('User not approved');
            return res.status(403).json({ message: 'Your account is pending approval by the administrator.' });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            console.log('Invalid password');
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        console.log('Login successful');
        const token = jwt.sign({ id: user.id, role: user.role, cadetId: user.cadet_id, staffId: user.staff_id }, SECRET_KEY, { expiresIn: '1h' });
        
        res.json({ token, role: user.role, cadetId: user.cadet_id, staffId: user.staff_id });
    });
});

// Cadet Login (No Password)
router.post('/cadet-login', (req, res) => {
    const { identifier } = req.body; // Can be Student ID, Username, or Email

    if (!identifier) {
        return res.status(400).json({ message: 'Please enter your Student ID, Username, or Email.' });
    }

    // Check by Username, Email, OR Student ID (via join with cadets table)
    // Only for role = 'cadet'
    const sql = `
        SELECT u.* 
        FROM users u 
        LEFT JOIN cadets c ON u.cadet_id = c.id 
        WHERE (u.username = ? OR u.email = ? OR c.student_id = ?) 
        AND u.role = 'cadet'
    `;
    
    db.get(sql, [identifier, identifier, identifier], (err, user) => {
        if (err) return res.status(500).json({ message: err.message });
        
        if (!user) {
            return res.status(400).json({ message: 'User not found. Please contact your administrator if you believe this is an error.' });
        }

        if (user.is_approved === 0) {
            return res.status(403).json({ message: 'Your account is not authorized.' });
        }

        // Generate Token
        const token = jwt.sign({ id: user.id, role: user.role, cadetId: user.cadet_id }, SECRET_KEY, { expiresIn: '24h' });
        
        res.json({ token, role: user.role, cadetId: user.cadet_id });
    });
});

// Staff Login (Same as Cadet Login but checks training_staff role)
// User requested "login route for training staff in the cadet login route"
router.post('/staff-login-no-pass', (req, res) => {
    const { identifier } = req.body; 

    if (!identifier) {
        return res.status(400).json({ message: 'Please enter your Username or Email.' });
    }

    const sql = `SELECT * FROM users WHERE (username = ? OR email = ?) AND role = 'training_staff'`;
    
    db.get(sql, [identifier, identifier], (err, user) => {
        if (err) return res.status(500).json({ message: err.message });
        
        if (!user) {
            return res.status(400).json({ message: 'Staff user not found.' });
        }

        const token = jwt.sign({ id: user.id, role: user.role, staffId: user.staff_id }, SECRET_KEY, { expiresIn: '24h' });
        
        res.json({ token, role: user.role, staffId: user.staff_id });
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
