const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const dbPath = path.resolve(__dirname, 'rotc.db');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        initDb();
    }
});

function initDb() {
    db.serialize(() => {
        // Cadets Table
        db.run(`CREATE TABLE IF NOT EXISTS cadets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            rank TEXT,
            first_name TEXT NOT NULL,
            middle_name TEXT,
            last_name TEXT NOT NULL,
            suffix_name TEXT,
            email TEXT,
            contact_number TEXT,
            address TEXT,
            course TEXT,
            year_level TEXT,
            school_year TEXT,
            battalion TEXT,
            company TEXT,
            platoon TEXT,
            cadet_course TEXT,
            semester TEXT,
            status TEXT DEFAULT 'Ongoing',
            student_id TEXT UNIQUE NOT NULL,
            profile_pic TEXT
        )`);

        // Users Table
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT CHECK(role IN ('admin', 'cadet')) NOT NULL,
            cadet_id INTEGER,
            is_approved INTEGER DEFAULT 0,
            email TEXT,
            profile_pic TEXT,
            FOREIGN KEY (cadet_id) REFERENCES cadets(id) ON DELETE CASCADE
        )`);

        // Grades Table
        db.run(`CREATE TABLE IF NOT EXISTS grades (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cadet_id INTEGER UNIQUE NOT NULL,
            attendance_present INTEGER DEFAULT 0,
            merit_points INTEGER DEFAULT 0,
            demerit_points INTEGER DEFAULT 0,
            prelim_score INTEGER DEFAULT 0,
            midterm_score INTEGER DEFAULT 0,
            final_score INTEGER DEFAULT 0,
            status TEXT DEFAULT 'active',
            FOREIGN KEY (cadet_id) REFERENCES cadets(id) ON DELETE CASCADE
        )`);

        // Activities Table
        db.run(`CREATE TABLE IF NOT EXISTS activities (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT,
            date TEXT,
            image_path TEXT
        )`);

        // Check for admin and seed if missing
        db.get("SELECT * FROM users WHERE username = 'msu-sndrotc_admin'", async (err, row) => {
            if (!row) {
                console.log('Admin not found. Seeding admin...');
                const username = 'msu-sndrotc_admin';
                const password = 'admingrading@2026';
                const email = 'msusndrotcunit@gmail.com';
                
                try {
                    const hashedPassword = await bcrypt.hash(password, 10);
                    db.run(`INSERT INTO users (username, password, role, is_approved, email) VALUES (?, ?, 'admin', 1, ?)`, 
                        [username, hashedPassword, email], 
                        (err) => {
                            if (err) console.error('Error seeding admin:', err.message);
                            else console.log('Admin seeded successfully.');
                        }
                    );
                } catch (hashErr) {
                    console.error('Error hashing password:', hashErr);
                }
            }
        });
    });
}

module.exports = db;
