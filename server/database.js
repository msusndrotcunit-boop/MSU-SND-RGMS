const { Pool } = require('pg');
const path = require('path');
const bcrypt = require('bcryptjs');

const isPostgres = !!process.env.DATABASE_URL || !!process.env.SUPABASE_URL;

// Removed strict placeholder check to prevent immediate crash on Render if env var is default.
// The connection will fail naturally if the URL is invalid.

let db;
let sqlite3;

// DB Adapter to unify SQLite and Postgres
if (isPostgres) {
    const connectionString = (process.env.DATABASE_URL || process.env.SUPABASE_URL).trim();
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
                pgSql += ' RETURNING *';
            }

            pool.query(pgSql, params, (err, res) => {
                if (err) {
                    if (callback) callback(err);
                    return;
                }
                const context = {
                    lastID: isInsert && res.rows.length > 0 ? (res.rows[0].id || 0) : 0,
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
    db.initialize = initPgDb;

} else {
    sqlite3 = require('sqlite3').verbose();
    const dbPath = path.resolve(__dirname, 'rotc.db');
    db = new sqlite3.Database(dbPath, (err) => {
        if (err) console.error('Error opening database', err.message);
        else {
            console.log('Connected to SQLite database.');
            // Enable Foreign Keys for ON DELETE CASCADE
            db.run("PRAGMA foreign_keys = ON");
            
            initSqliteDb();
            
            // Migration: Add extra columns to training_staff if missing
            const staffColumns = [
                { name: 'afpsn', type: 'TEXT' },
                { name: 'birthdate', type: 'TEXT' },
                { name: 'birthplace', type: 'TEXT' },
                { name: 'age', type: 'INTEGER' },
                { name: 'height', type: 'TEXT' },
                { name: 'weight', type: 'TEXT' },
                { name: 'blood_type', type: 'TEXT' },
                { name: 'address', type: 'TEXT' },
                { name: 'civil_status', type: 'TEXT' },
                { name: 'nationality', type: 'TEXT' },
                { name: 'gender', type: 'TEXT' },
                { name: 'language_spoken', type: 'TEXT' },
                { name: 'combat_boots_size', type: 'TEXT' },
                { name: 'uniform_size', type: 'TEXT' },
                { name: 'bullcap_size', type: 'TEXT' },
                { name: 'facebook_link', type: 'TEXT' },
                { name: 'rotc_unit', type: 'TEXT' },
                { name: 'mobilization_center', type: 'TEXT' },
                { name: 'is_profile_completed', type: 'INTEGER DEFAULT 0' }
            ];

            staffColumns.forEach(col => {
                db.run(`ALTER TABLE training_staff ADD COLUMN ${col.name} ${col.type}`, (err) => {
                    if (err && !err.message.includes('duplicate column')) {
                        // console.log(`Migration info: ${err.message}`);
                    }
                });
            });

            // Migration: Add is_profile_completed if missing
            db.run("ALTER TABLE cadets ADD COLUMN is_profile_completed INTEGER DEFAULT 0", (err) => {
                if (err && !err.message.includes('duplicate column')) {
                    console.log('Migration info:', err.message);
                }
            });

            // Migration: Add has_seen_guide if missing
            db.run("ALTER TABLE cadets ADD COLUMN has_seen_guide INTEGER DEFAULT 0", (err) => {
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
    db.initialize = async () => {};
}

async function initPgDb() {
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
            is_profile_completed BOOLEAN DEFAULT FALSE,
            is_archived BOOLEAN DEFAULT FALSE
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
            time_in TEXT,
            time_out TEXT,
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
            afpsn TEXT,
            birthdate TEXT,
            birthplace TEXT,
            age INTEGER,
            height TEXT,
            weight TEXT,
            blood_type TEXT,
            address TEXT,
            civil_status TEXT,
            nationality TEXT,
            gender TEXT,
            language_spoken TEXT,
            combat_boots_size TEXT,
            uniform_size TEXT,
            bullcap_size TEXT,
            facebook_link TEXT,
            rotc_unit TEXT,
            mobilization_center TEXT,
            is_profile_completed BOOLEAN DEFAULT FALSE,
            has_seen_guide BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            is_archived BOOLEAN DEFAULT FALSE
        )`,
        `CREATE TABLE IF NOT EXISTS staff_attendance_records (
            id SERIAL PRIMARY KEY,
            training_day_id INTEGER NOT NULL REFERENCES training_days(id) ON DELETE CASCADE,
            staff_id INTEGER NOT NULL REFERENCES training_staff(id) ON DELETE CASCADE,
            status TEXT CHECK(status IN ('present', 'absent', 'late', 'excused')) NOT NULL,
            remarks TEXT,
            time_in TEXT,
            time_out TEXT,
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
        `CREATE TABLE IF NOT EXISTS staff_messages (
            id SERIAL PRIMARY KEY,
            sender_staff_id INTEGER NOT NULL REFERENCES training_staff(id) ON DELETE CASCADE,
            content TEXT NOT NULL,
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
        )`,
        `CREATE TABLE IF NOT EXISTS push_subscriptions (
            id SERIAL PRIMARY KEY,
            user_id INTEGER,
            endpoint TEXT NOT NULL UNIQUE,
            keys TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`
    ];

    try {
        console.log(`Starting Postgres initialization with ${queries.length} tables...`);
        for (const q of queries) {
            try {
                // Log table creation to identify which one hangs/fails
                const tableName = q.match(/CREATE TABLE IF NOT EXISTS (\w+)/)?.[1] || 'unknown';
                // console.log(`Creating table: ${tableName}`);
                await db.pool.query(q);
            } catch (err) {
                console.error(`Error creating table (query: ${q.substring(0, 50)}...):`, err);
                throw err; // Re-throw to stop init if critical table fails
            }
        }
        console.log('Tables created successfully.');

        // Consolidated Migrations
        console.log('Running consolidated migrations...');
        const staffColumns = [
            { name: 'afpsn', type: 'TEXT' },
            { name: 'birthdate', type: 'TEXT' },
            { name: 'birthplace', type: 'TEXT' },
            { name: 'age', type: 'INTEGER' },
            { name: 'height', type: 'TEXT' },
            { name: 'weight', type: 'TEXT' },
            { name: 'blood_type', type: 'TEXT' },
            { name: 'address', type: 'TEXT' },
            { name: 'civil_status', type: 'TEXT' },
            { name: 'nationality', type: 'TEXT' },
            { name: 'gender', type: 'TEXT' },
            { name: 'language_spoken', type: 'TEXT' },
            { name: 'combat_boots_size', type: 'TEXT' },
            { name: 'uniform_size', type: 'TEXT' },
            { name: 'bullcap_size', type: 'TEXT' },
            { name: 'facebook_link', type: 'TEXT' },
            { name: 'rotc_unit', type: 'TEXT' },
            { name: 'mobilization_center', type: 'TEXT' },
            { name: 'is_profile_completed', type: 'INTEGER DEFAULT 0' },
            { name: 'has_seen_guide', type: 'INTEGER DEFAULT 0' }
        ];

        for (const col of staffColumns) {
            try {
                // Use safe ADD COLUMN
                await db.pool.query(`ALTER TABLE training_staff ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}`);
            } catch (err) { 
                console.warn(`Migration warning (staff col ${col.name}):`, err.message);
            }
        }

        const simpleMigrations = [
            `ALTER TABLE cadets ADD COLUMN IF NOT EXISTS is_profile_completed BOOLEAN DEFAULT FALSE`,
            `ALTER TABLE cadets ADD COLUMN IF NOT EXISTS has_seen_guide BOOLEAN DEFAULT FALSE`,
            `ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP`,
            `ALTER TABLE users ADD COLUMN IF NOT EXISTS staff_id INTEGER REFERENCES training_staff(id) ON DELETE CASCADE`,
            `ALTER TABLE cadets ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE`,
            `ALTER TABLE training_staff ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE`
        ];

        for (const query of simpleMigrations) {
            try { await db.pool.query(query); } catch (e) { 
                console.warn(`Migration warning (simple):`, e.message);
            }
        }

        // Migration: Update role check constraint
        try {
            await db.pool.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check`);
            await db.pool.query(`ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'cadet', 'training_staff'))`);
        } catch (e) { 
            console.warn(`Migration warning (role check):`, e.message);
        }

        console.log('Seeding admin...');
        seedAdmin();
        console.log('PostgreSQL initialized successfully.');
    } catch (err) {
        console.error('Error initializing PG DB:', err);
        throw err; // Propagate to server.js
    }
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
            afpsn TEXT,
            birthdate TEXT,
            birthplace TEXT,
            age INTEGER,
            height TEXT,
            weight TEXT,
            blood_type TEXT,
            address TEXT,
            civil_status TEXT,
            nationality TEXT,
            gender TEXT,
            language_spoken TEXT,
            combat_boots_size TEXT,
            uniform_size TEXT,
            bullcap_size TEXT,
            facebook_link TEXT,
            rotc_unit TEXT,
            mobilization_center TEXT,
            is_profile_completed INTEGER DEFAULT 0,
            has_seen_guide INTEGER DEFAULT 0,
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
        
        // Staff Messages (Communication Panel)
        db.run(`CREATE TABLE IF NOT EXISTS staff_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sender_staff_id INTEGER NOT NULL,
            content TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(sender_staff_id) REFERENCES training_staff(id) ON DELETE CASCADE
        )`);

        // Migration for SQLite: Add staff_id to users
        db.run(`PRAGMA foreign_keys=OFF;`);
        db.run(`ALTER TABLE users ADD COLUMN staff_id INTEGER REFERENCES training_staff(id) ON DELETE CASCADE`, (err) => {
            // Ignore error if column exists
        });

        // Migration: Add time_in and time_out to attendance_records
        db.run(`ALTER TABLE attendance_records ADD COLUMN time_in TEXT`, (err) => {});
        db.run(`ALTER TABLE attendance_records ADD COLUMN time_out TEXT`, (err) => {});

        // Migration: Add time_in and time_out to staff_attendance_records
        db.run(`ALTER TABLE staff_attendance_records ADD COLUMN time_in TEXT`, (err) => {});
        db.run(`ALTER TABLE staff_attendance_records ADD COLUMN time_out TEXT`, (err) => {});
        
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

        // Push Subscriptions Table
        db.run(`CREATE TABLE IF NOT EXISTS push_subscriptions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            endpoint TEXT NOT NULL UNIQUE,
            keys TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
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
                            seedDefaultCadet();
                        }
                    }
                );
            } catch (hashErr) {
                console.error('Error hashing password:', hashErr);
            }
        } else {
            // Ensure admin password is correct (reset to default on restart if it exists)
            // This guarantees login works even if DB persists but password was forgotten/changed locally
            const password = 'admingrading@2026';
            try {
                const hashedPassword = await bcrypt.hash(password, 10);
                db.run("UPDATE users SET password = ? WHERE username = 'msu-sndrotc_admin'", [hashedPassword], (err) => {
                    if (err) console.error('Error updating admin password:', err);
                    else console.log('Admin password verified/reset to default.');
                });
            } catch (e) {
                console.error('Error hashing admin password update:', e);
            }

            seedDefaultStaff();
            // seedDefaultCadet(); // Disabled per user request to avoid ghost entries
        }
    });
}


function seedDefaultCadet() {
    const username = 'cadet@2026';
    const password = 'cadet@2026';
    const email = 'cadet2026@default.com';
    db.get('SELECT * FROM users WHERE username = ?', [username], async (err, row) => {
        if (!row) {
            console.log('Default cadet not found. Seeding...');
            try {
                const hashedPassword = await bcrypt.hash(password, 10);

                db.run("INSERT INTO cadets (first_name, last_name, rank, company, platoon, status, student_id) VALUES ('Default', 'Cadet', 'Cdt', 'Alpha', '1', 'Active', 'DEFAULT-001')", [], function(err) {
                    if (err) {
                        console.error('Error inserting default cadet profile:', err);
                        return;
                    }
                    const cadetId = this.lastID;

                    db.run('INSERT INTO users (username, password, role, cadet_id, is_approved, email) VALUES (?, ?, \'cadet\', ?, 1, ?)',
                        [username, hashedPassword, cadetId, email],
                        (uErr) => {
                            if (uErr) console.error('Error seeding default cadet user:', uErr);
                            else console.log('Default cadet seeded successfully (cadet@2026) with profile.');
                        }
                    );
                });
            } catch (e) {
                console.error('Error hashing cadet password:', e);
            }
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
