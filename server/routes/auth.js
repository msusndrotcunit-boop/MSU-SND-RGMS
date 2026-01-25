const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database');
const { SECRET_KEY } = require('../middleware/auth');

const router = express.Router();

// Register (Sign Up) for Cadets
router.post('/signup', async (req, res) => {
    const { 
        username, password, 
        rank, firstName, middleName, lastName, suffixName, 
        studentId, email, contactNumber, address, 
        course, yearLevel, schoolYear, 
        battalion, company, platoon, 
        cadetCourse, semester, status 
    } = req.body;

    if (!username || !password || !firstName || !lastName || !studentId) {
        return res.status(400).json({ message: 'Missing required fields' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Transaction-like approach (manual rollback on error ideally, but simplified here)
    db.serialize(() => {
        // 1. Insert Cadet
        const sql = `INSERT INTO cadets (
            rank, first_name, middle_name, last_name, suffix_name, 
            student_id, email, contact_number, address, 
            course, year_level, school_year, 
            battalion, company, platoon, 
            cadet_course, semester, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

        const params = [
            rank, firstName, middleName, lastName, suffixName, 
            studentId, email, contactNumber, address, 
            course, yearLevel, schoolYear, 
            battalion, company, platoon, 
            cadetCourse, semester, status || 'Ongoing'
        ];

        db.run(sql, params, function(err) {
            if (err) {
                return res.status(500).json({ message: 'Error creating cadet profile: ' + err.message });
            }
            const cadetId = this.lastID;

            // 2. Insert User
            // Default is_approved = 0 (false) for cadets
            // But if email is msusndrotcunit@gmail.com, auto-approve?
            // "Only msusndrotcunit@gmail.com account can only access unless approved"
            const isApproved = email === 'msusndrotcunit@gmail.com' ? 1 : 0;

            db.run(`INSERT INTO users (username, password, role, cadet_id, is_approved, email) VALUES (?, ?, ?, ?, ?, ?)`, 
                [username, hashedPassword, 'cadet', cadetId, isApproved, email], 
                function(err) {
                    if (err) {
                        // Ideally delete cadet here
                        return res.status(500).json({ message: 'Error creating user account: ' + err.message });
                    }

                    // 3. Initialize Grades
                    db.run(`INSERT INTO grades (cadet_id) VALUES (?)`, [cadetId], (err) => {
                        if (err) {
                            console.error("Error initializing grades", err);
                        }
                        console.log(`User created: ${username} (ID: ${this.lastID}, Cadet ID: ${cadetId}, Approved: ${isApproved})`);
                        res.status(201).json({ message: 'Cadet registered successfully' });
                    });
                }
            );
        });
    });
});

// Login
router.post('/login', (req, res) => {
    const { username, password } = req.body;

    db.get(`SELECT * FROM users WHERE username = ?`, [username], async (err, user) => {
        if (err) return res.status(500).json({ message: err.message });
        if (!user) return res.status(400).json({ message: 'User not found' });

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) return res.status(400).json({ message: 'Invalid credentials' });

        const token = jwt.sign({ id: user.id, role: user.role, cadetId: user.cadet_id }, SECRET_KEY, { expiresIn: '1h' });
        
        res.json({ token, role: user.role, cadetId: user.cadet_id });
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
