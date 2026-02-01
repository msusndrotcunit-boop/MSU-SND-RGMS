const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');
const path = require('path');
const bcrypt = require('bcryptjs');

const isPostgres = !!process.env.DATABASE_URL;

// Removed strict placeholder check to prevent immediate crash on Render if env var is default.
// The connection will fail naturally if the URL is invalid.

let db;

// DB Adapter to unify SQLite and Postgres
if (isPostgres) {
    const connectionString = process.env.DATABASE_URL.trim();
    // console.log('Using DB URL:', connectionString.replace(/:[^:@]*@/, ':****@')); // Debug log

    const pool = new Pool({
        connectionString: connectionString,
        ssl: { rejectUnauthorized: false }
    });

    console.log('Connected to PostgreSQL database.');

    db = {
        pool: pool, // Expose pool if needed
        run: function(sql, params, callback) {
            if (typeof params === 'function') {
                callback = params;
                params = [];
            }
            
            // Convert ? to $1, $2, etc.
            let paramIndex = 1;
            let pgSql = sql.replace(/\?/g, () => `$${paramIndex++}`);
            
            // Handle INSERT to return ID (simulating this.lastID)
            const isInsert = sql.trim().toUpperCase().startsWith('INSERT');
            if (isInsert && !pgSql.toLowerCase().includes('returning')) {
                pgSql += ' RETURNING id';
            }

            pool.query(pgSql, params, (err, res) => {
                if (err) {
                    if (callback) callback(err);
                    return;
                }
                const context = {
                    lastID: isInsert && res.rows.length > 0 ? res.rows[0].id : 0,
                    changes: res.rowCount
                };
                if (callback) callback.call(context, null);
            });
        },
        all: function(sql, params, callback) {
            if (typeof params === 'function') {
                callback = params;
                params = [];
            }
            let paramIndex = 1;
            const pgSql = sql.replace(/\?/g, () => `$${paramIndex++}`);
            
            pool.query(pgSql, params, (err, res) => {
                if (callback) callback(err, res ? res.rows : []);
            });
        },
        get: function(sql, params, callback) {
            if (typeof params === 'function') {
                callback = params;
                params = [];
            }
            let paramIndex = 1;
            const pgSql = sql.replace(/\?/g, () => `$${paramIndex++}`);
            
            pool.query(pgSql, params, (err, res) => {
                if (callback) callback(err, res && res.rows.length > 0 ? res.rows[0] : undefined);
            });
        },
        serialize: function(callback) {
            if (callback) callback();
        }
    };
    
    // Initialize Postgres Tables
    initPgDb();

    // Migration: Add is_profile_completed if missing
    pool.query(`
        DO $$ 
        BEGIN 
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cadets' AND column_name='is_profile_completed') THEN 
                ALTER TABLE cadets ADD COLUMN is_profile_completed BOOLEAN DEFAULT FALSE; 
            END IF; 
        END $$;
    `).catch(err => console.log('Migration info:', err.message));

    // Migration: Add last_seen to users
    pool.query(`
        DO $$ 
        BEGIN 
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='last_seen') THEN 
                ALTER TABLE users ADD COLUMN last_seen TIMESTAMP; 
            END IF; 
        END $$;
    `).catch(err => console.log('Migration info:', err.message));

} else {
    const dbPath = path.resolve(__dirname, 'rotc.db');
    db = new sqlite3.Database(dbPath, (err) => {
        if (err) console.error('Error opening database', err.message);
        else {
            console.log('Connected to SQLite database.');
            // Enable Foreign Keys for ON DELETE CASCADE
            db.run("PRAGMA foreign_keys = ON");
            
            initSqliteDb();
            
            // Migration: Add is_profile_completed if missing
            db.run("ALTER TABLE cadets ADD COLUMN is_profile_completed INTEGER DEFAULT 0", (err) => {
                if (err && !err.message.includes('duplicate column')) {
                    console.log('Migration info:', err.message);
                }
            });

            // Migration: Add last_seen to users
            db.run("ALTER TABLE users ADD COLUMN last_seen TEXT", (err) => {
                if (err && !err.message.includes('duplicate column')) {
                    console.log('Migration info:', err.message);
                }
            });
        }
    });
}

function initPgDb() {
    const queries = [
        `CREATE TABLE IF NOT EXISTS cadets (
            id SERIAL PRIMARY KEY,
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
            profile_pic TEXT,
            is_profile_completed BOOLEAN DEFAULT FALSE
        )`,
        `CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT CHECK(role IN ('admin', 'cadet', 'training_staff')) NOT NULL,
            cadet_id INTEGER REFERENCES cadets(id) ON DELETE CASCADE,
            is_approved INTEGER DEFAULT 0,
            email TEXT,
            profile_pic TEXT
        )`,
        `CREATE TABLE IF NOT EXISTS grades (
            id SERIAL PRIMARY KEY,
            cadet_id INTEGER UNIQUE NOT NULL REFERENCES cadets(id) ON DELETE CASCADE,
            attendance_present INTEGER DEFAULT 0,
            merit_points INTEGER DEFAULT 0,
            demerit_points INTEGER DEFAULT 0,
            prelim_score INTEGER DEFAULT 0,
            midterm_score INTEGER DEFAULT 0,
            final_score INTEGER DEFAULT 0,
            status TEXT DEFAULT 'active'
        )`,
        `CREATE TABLE IF NOT EXISTS activities (
            id SERIAL PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT,
            date TEXT,
            image_path TEXT
        )`,
        `CREATE TABLE IF NOT EXISTS merit_demerit_logs (
            id SERIAL PRIMARY KEY,
            cadet_id INTEGER REFERENCES cadets(id) ON DELETE CASCADE,
            type TEXT CHECK(type IN ('merit', 'demerit')) NOT NULL,
            points INTEGER NOT NULL,
            reason TEXT,
            date_recorded TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS training_days (
            id SERIAL PRIMARY KEY,
            date TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT
        )`,
        `CREATE TABLE IF NOT EXISTS attendance_records (
            id SERIAL PRIMARY KEY,
            training_day_id INTEGER NOT NULL REFERENCES training_days(id) ON DELETE CASCADE,
            cadet_id INTEGER NOT NULL REFERENCES cadets(id) ON DELETE CASCADE,
            status TEXT CHECK(status IN ('present', 'absent', 'late', 'excused')) NOT NULL,
            remarks TEXT,
            UNIQUE(training_day_id, cadet_id)
        )`,
        `CREATE TABLE IF NOT EXISTS excuse_letters (
            id SERIAL PRIMARY KEY,
            cadet_id INTEGER REFERENCES cadets(id) ON DELETE CASCADE,
            training_day_id INTEGER REFERENCES training_days(id) ON DELETE CASCADE,
            date_absent DATE NOT NULL,
            reason TEXT,
            file_url TEXT,
            status TEXT DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS system_settings (
            id SERIAL PRIMARY KEY,
            key TEXT UNIQUE NOT NULL,
            value TEXT
        )`,
        `CREATE TABLE IF NOT EXISTS training_staff (
            id SERIAL PRIMARY KEY,
            rank TEXT,
            first_name TEXT NOT NULL,
            middle_name TEXT,
            last_name TEXT NOT NULL,
            suffix_name TEXT,
            email TEXT UNIQUE,
            contact_number TEXT,
            role TEXT DEFAULT 'Instructor',
            profile_pic TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS staff_attendance_records (
            id SERIAL PRIMARY KEY,
            training_day_id INTEGER NOT NULL REFERENCES training_days(id) ON DELETE CASCADE,
            staff_id INTEGER NOT NULL REFERENCES training_staff(id) ON DELETE CASCADE,
            status TEXT CHECK(status IN ('present', 'absent', 'late', 'excused')) NOT NULL,
            remarks TEXT,
            UNIQUE(training_day_id, staff_id)
        )`,
        `CREATE TABLE IF NOT EXISTS notifications (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            message TEXT NOT NULL,
            type TEXT NOT NULL,
            is_read BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS user_settings (
            user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            email_alerts BOOLEAN DEFAULT TRUE,
            push_notifications BOOLEAN DEFAULT TRUE,
            activity_updates BOOLEAN DEFAULT TRUE,
            dark_mode BOOLEAN DEFAULT FALSE,
            compact_mode BOOLEAN DEFAULT FALSE,
            primary_color TEXT DEFAULT 'blue'
        )`
    ];

    const runQueries = async () => {
        try {
            for (const q of queries) {
                await db.pool.query(q);
            }
            
            // Migration: Add staff_id to users if not exists
            try {
                await db.pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS staff_id INTEGER REFERENCES training_staff(id) ON DELETE CASCADE`);
            } catch (e) { console.log('Migration note: staff_id column might already exist or error', e.message); }

            // Migration: Update role check constraint (Postgres)
            try {
                // Drop old constraint
                await db.pool.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check`);
                // Add new constraint
                await db.pool.query(`ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'cadet', 'training_staff'))`);
            } catch (e) { console.log('Migration note: Could not update users_role_check constraint', e.message); }

            seedAdmin();
        } catch (err) {
            console.error('Error initializing PG DB:', err);
        }
    };
    runQueries();
}

function initSqliteDb() {
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
            profile_pic TEXT,
            is_profile_completed INTEGER DEFAULT 0
        )`);

        // Users Table
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT CHECK(role IN ('admin', 'cadet', 'training_staff')) NOT NULL,
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

        // Merit/Demerit Ledger Table
        db.run(`CREATE TABLE IF NOT EXISTS merit_demerit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cadet_id INTEGER,
            type TEXT CHECK(type IN ('merit', 'demerit')) NOT NULL,
            points INTEGER NOT NULL,
            reason TEXT,
            date_recorded TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (cadet_id) REFERENCES cadets(id) ON DELETE CASCADE
        )`);

        // Training Days Table
        db.run(`CREATE TABLE IF NOT EXISTS training_days (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT
        )`);

        // Attendance Records Table
        db.run(`CREATE TABLE IF NOT EXISTS attendance_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            training_day_id INTEGER NOT NULL,
            cadet_id INTEGER NOT NULL,
            status TEXT CHECK(status IN ('present', 'absent', 'late', 'excused')) NOT NULL,
            remarks TEXT,
            UNIQUE(training_day_id, cadet_id),
            FOREIGN KEY(training_day_id) REFERENCES training_days(id) ON DELETE CASCADE,
            FOREIGN KEY(cadet_id) REFERENCES cadets(id) ON DELETE CASCADE
        )`);

        // Excuse Letters Table
        db.run(`CREATE TABLE IF NOT EXISTS excuse_letters (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cadet_id INTEGER,
            training_day_id INTEGER,
            date_absent TEXT NOT NULL,
            reason TEXT,
            file_url TEXT,
            status TEXT DEFAULT 'pending',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(cadet_id) REFERENCES cadets(id) ON DELETE CASCADE,
            FOREIGN KEY(training_day_id) REFERENCES training_days(id) ON DELETE CASCADE
        )`);

        // System Settings Table
        db.run(`CREATE TABLE IF NOT EXISTS system_settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key TEXT UNIQUE NOT NULL,
            value TEXT
        )`);

        // Training Staff Table
        db.run(`CREATE TABLE IF NOT EXISTS training_staff (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            rank TEXT,
            first_name TEXT NOT NULL,
            middle_name TEXT,
            last_name TEXT NOT NULL,
            suffix_name TEXT,
            email TEXT UNIQUE,
            contact_number TEXT,
            role TEXT DEFAULT 'Instructor',
            profile_pic TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )`);

        // Staff Attendance Records Table
        db.run(`CREATE TABLE IF NOT EXISTS staff_attendance_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            training_day_id INTEGER NOT NULL,
            staff_id INTEGER NOT NULL,
            status TEXT CHECK(status IN ('present', 'absent', 'late', 'excused')) NOT NULL,
            remarks TEXT,
            UNIQUE(training_day_id, staff_id),
            FOREIGN KEY(training_day_id) REFERENCES training_days(id) ON DELETE CASCADE,
            FOREIGN KEY(staff_id) REFERENCES training_staff(id) ON DELETE CASCADE
        )`);

        // Notifications Table
        db.run(`CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            message TEXT NOT NULL,
            type TEXT NOT NULL,
            is_read INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
        )`);

        // Migration for SQLite: Add staff_id to users
        db.run(`PRAGMA foreign_keys=OFF;`);
        db.run(`ALTER TABLE users ADD COLUMN staff_id INTEGER REFERENCES training_staff(id) ON DELETE CASCADE`, (err) => {
            // Ignore error if column exists
        });
        
        // Note: SQLite CHECK constraint update requires table recreation, skipping for now as it's complex.
        // Ensure new users table creation has correct check.


        // User Settings Table
        db.run(`CREATE TABLE IF NOT EXISTS user_settings (
            user_id INTEGER PRIMARY KEY,
            email_alerts INTEGER DEFAULT 1,
            push_notifications INTEGER DEFAULT 1,
            activity_updates INTEGER DEFAULT 1,
            dark_mode INTEGER DEFAULT 0,
            compact_mode INTEGER DEFAULT 0,
            primary_color TEXT DEFAULT 'blue',
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        )`);

        seedAdmin();
    });
}

function seedAdmin() {
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
                        if (err) console.error('Error seeding admin:', err ? err.message : err);
                        else {
                            console.log('Admin seeded successfully.');
                            seedDefaultStaff();
                        }
                    }
                );
            } catch (hashErr) {
                console.error('Error hashing password:', hashErr);
            }
        } else {
            seedDefaultStaff();
        }
    });
}

function seedDefaultStaff() {
    // Check if ANY training staff exists. If so, do not seed default staff to prevent security risk.
    db.get("SELECT COUNT(*) as count FROM users WHERE role = 'training_staff'", [], async (err, row) => {
        if (err) return console.error("Error checking staff count:", err);
        
        if (row && row.count === 0) {
            const username = 'staff';
            const password = 'staff@2026';
            const email = 'staff2026@default.com'; // Placeholder email

            // Double check if the specific user exists (in case count is 0 but user is there? unlikely if role is training_staff)
            // But if user exists with DIFFERENT role, we might have collision.
            
            db.get("SELECT * FROM users WHERE username = ?", [username], async (err, userRow) => {
                if (!userRow) {
                    console.log('No training staff found. Seeding default staff user...');
                    try {
                        const hashedPassword = await bcrypt.hash(password, 10);
                        db.run(`INSERT INTO users (username, password, role, is_approved, email) VALUES (?, ?, 'training_staff', 1, ?)`, 
                            [username, hashedPassword, email], 
                            (err) => {
                                if (err) console.error('Error seeding default staff:', err ? err.message : err);
                                else console.log('Default staff seeded successfully (staff@2026).');
                            }
                        );
                    } catch (e) {
                        console.error('Error hashing staff password:', e);
                    }
                }
            });
        }
    });
}

module.exports = db;