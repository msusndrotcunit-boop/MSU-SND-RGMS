const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const dns = require('dns');
require('dotenv').config();

// Force IPv4
if (dns.setDefaultResultOrder) {
    dns.setDefaultResultOrder('ipv4first');
}

// Force SQLite by disabling Postgres check
const getPgUrl = () => {
    const keys = [
        'DATABASE_URL',
        'SUPABASE_URL',
        'SUPABASE_DB_URL',
        'SUPABASE_POSTGRES_URL',
        'POSTGRES_URL',
        'PG_DATABASE_URL'
    ];
    for (const k of keys) {
        const v = process.env[k];
        if (v && v.trim()) return v.trim();
    }
    return null;
};
const sanitizePgUrl = (u) => {
    let s = u.trim();
    if ((s.startsWith("'") && s.endsWith("'")) || (s.startsWith('"') && s.endsWith('"'))) {
        s = s.slice(1, -1);
    }
    if (s.endsWith("'") || s.endsWith('"')) {
        s = s.slice(0, -1);
    }
    try {
        const o = new URL(s);
        o.searchParams.delete('channel_binding');
        s = o.toString();
    } catch (_) {}
    return s;
};
const pgUrl = (() => {
    const raw = getPgUrl();
    return raw ? sanitizePgUrl(raw) : null;
})();
const isProd = (process.env.NODE_ENV || '').toLowerCase() === 'production';
const dbStrict = ['1', 'true', 'yes'].includes((process.env.DB_STRICT || '').toLowerCase()) || isProd;
const isPostgres = !!pgUrl;

// Hard block: never use SQLite in strict/production to prevent data loss
if (!isPostgres && dbStrict) {
    throw new Error("No PostgreSQL URL found. Strict mode active — SQLite fallback disabled.");
}

// Removed strict placeholder check to prevent immediate crash on Render if env var is default.
// The connection will fail naturally if the URL is invalid.

let db;
let sqlite3;

// DB Adapter to unify SQLite and Postgres
if (isPostgres) {
    const connectionString = pgUrl;
    const poolConfig = {
        connectionString: connectionString,
        // Performance optimization: Connection pool settings
        min: 5,                      // Minimum idle connections
        max: 20,                     // Maximum connections under load
        idleTimeoutMillis: 30000,    // Close idle connections after 30s
        connectionTimeoutMillis: 2000, // Timeout connection attempts after 2s
        // Connection validation
        allowExitOnIdle: false
    };
    if (!/sslmode=disable/i.test(connectionString)) {
        poolConfig.ssl = { rejectUnauthorized: false };
    }
    const pool = new Pool(poolConfig);

    console.log('Using PostgreSQL database.');

    db = {
        pool: pool, // Expose pool if needed
        
        /**
         * Validate connection before use
         * Validates Requirements: 7.5
         */
        validateConnection: async function() {
            try {
                await pool.query('SELECT 1');
                return true;
            } catch (err) {
                console.error('[Database] Connection validation failed:', err.message);
                return false;
            }
        },
        
        /**
         * Execute query with retry logic
         * Validates Requirements: 7.4
         */
        queryWithRetry: async function(sql, params, maxRetries = 1) {
            let lastError;
            for (let attempt = 0; attempt <= maxRetries; attempt++) {
                try {
                    const result = await pool.query(sql, params);
                    return result;
                } catch (err) {
                    lastError = err;
                    const isTimeout = /timeout|ETIMEDOUT|ECONNREFUSED/i.test(err.message || err.code || '');
                    if (isTimeout && attempt < maxRetries) {
                        console.warn(`[Database] Query timeout, retrying (attempt ${attempt + 1}/${maxRetries + 1})...`);
                        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
                        continue;
                    }
                    throw err;
                }
            }
            throw lastError;
        },
        
        flushJournal: async function() {
            const journalPath = path.join(__dirname, 'journal.json');
            let entries = [];
            try {
                if (fs.existsSync(journalPath)) {
                    const raw = fs.readFileSync(journalPath, 'utf8');
                    entries = JSON.parse(raw || '[]');
                }
            } catch (_) {}
            if (!entries.length) return;
            const remaining = [];
            for (const e of entries) {
                try {
                    let paramIndex = 1;
                    const pgSql = e.sql.replace(/\?/g, () => `$${paramIndex++}`);
                    await db.pool.query(pgSql, e.params || []);
                } catch (err) {
                    remaining.push(e); // keep for next attempt
                }
            }
            try {
                fs.writeFileSync(journalPath, JSON.stringify(remaining, null, 2));
            } catch (_) {}
            console.log(`[Database] Journal replay complete. Applied: ${entries.length - remaining.length}, Pending: ${remaining.length}`);
        },
        run: function(sql, params, callback) {
            if (typeof params === 'function') {
                callback = params;
                params = [];
            }
            // Safe-delete in production: rewrite hard deletes to archives (unless explicitly bypassed)
            const hardBypass = /\/\*\s*HARD_DELETE\s*\*\//.test(sql);
            if (dbStrict && !hardBypass) {
                const normalized = sql.replace(/\s+/g, ' ').trim();
                if (/^DELETE\s+FROM\s+cadets\b/i.test(normalized)) {
                    sql = sql.replace(/^DELETE\s+FROM\s+cadets\b/i, 'UPDATE cadets SET is_archived = TRUE');
                } else if (/^DELETE\s+FROM\s+users\b/i.test(normalized)) {
                    sql = sql.replace(/^DELETE\s+FROM\s+users\b/i, 'UPDATE users SET is_archived = TRUE');
                }
            }
            // Convert ? to $1, $2, etc.
            let paramIndex = 1;
            let pgSql = sql.replace(/\?/g, () => `$${paramIndex++}`);
            
            // Handle INSERT to return ID (simulating this.lastID)
            const isInsert = sql.trim().toUpperCase().startsWith('INSERT');
            if (isInsert && !pgSql.toLowerCase().includes('returning')) {
                pgSql += ' RETURNING *';
            }

            db.pool.query(pgSql, params, (err, res) => {
                if (err) {
                    // Offline write journal for critical ops
                    const isWrite = /^\\s*(INSERT|UPDATE|DELETE)\\b/i.test(sql);
                    const maybeConnErr = /ECONN|ENET|EHOST|TIMEOUT|closed|disconnect/i.test(err.code || '') || /connection|timeout|socket/i.test(err.message || '');
                    if (isWrite && maybeConnErr) {
                        const journalPath = path.join(__dirname, 'journal.json');
                        let entries = [];
                        try {
                            if (fs.existsSync(journalPath)) {
                                const raw = fs.readFileSync(journalPath, 'utf8');
                                entries = JSON.parse(raw || '[]');
                            }
                        } catch (_) {}
                        const key = crypto.createHash('sha1').update(sql + JSON.stringify(params || [])).digest('hex');
                        const exists = entries.some(e => e.key === key);
                        if (!exists) {
                            entries.push({ key, sql, params, created_at: new Date().toISOString() });
                            try {
                                fs.writeFileSync(journalPath, JSON.stringify(entries, null, 2));
                                console.warn('[Database] Write captured in journal (offline). It will replay on reconnect.');
                            } catch (_) {}
                        }
                    }
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
            
            db.pool.query(pgSql, params, (err, res) => {
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
            
            db.pool.query(pgSql, params, (err, res) => {
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
    console.log('Database absolute path:', dbPath);
    db = new sqlite3.Database(dbPath, (err) => {
        if (err) console.error('Error opening database', err.message);
        else {
            console.log('Connected to SQLite database.');
            // Enable Foreign Keys for ON DELETE CASCADE
            db.run("PRAGMA foreign_keys = ON");
            
            initSqliteDb();
        }
    });
    db.initialize = async () => {};
}

async function initPgDb() {
    // FIX: Manually resolve DNS to IPv4 to prevent ENETUNREACH on IPv6-capable networks
    try {
        const connectionString = pgUrl;
        const url = new URL(connectionString);
        const hostname = url.hostname;
        const overrideHostRaw = (process.env.PG_HOST_IPV4 || process.env.PG_HOST_OVERRIDE || '').trim();
        let sniName = hostname;
        if (overrideHostRaw) {
            let ip;
            if (/^(\d{1,3}\.){3}\d{1,3}$/.test(overrideHostRaw)) {
                ip = overrideHostRaw;
            } else {
                try {
                    const addresses = await dns.promises.resolve4(overrideHostRaw);
                    if (addresses && addresses.length > 0) ip = addresses[0];
                } catch (_) {
                    try {
                        const lookup = await dns.promises.lookup(overrideHostRaw, { family: 4 });
                        if (lookup && lookup.address) ip = lookup.address;
                    } catch (_) {}
                }
                sniName = overrideHostRaw;
            }
            if (ip) {
                await db.pool.end();
                db.pool = new Pool({
                    user: decodeURIComponent(url.username),
                    password: decodeURIComponent(url.password),
                    host: ip,
                    port: url.port || 5432,
                    database: url.pathname.split('/')[1],
                    ssl: { 
                        rejectUnauthorized: false,
                        servername: sniName
                    },
                    max: 20,
                    idleTimeoutMillis: 30000,
                    connectionTimeoutMillis: 10000,
                });
                console.log('[Database] Using override host with IPv4.');
            }
        } else {

        // Only resolve if it looks like a domain name
        if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(hostname)) {
            console.log(`[Database] Resolving DNS for ${hostname} to force IPv4...`);
            let ip;
            try {
                const addresses = await dns.promises.resolve4(hostname);
                if (addresses && addresses.length > 0) ip = addresses[0];
            } catch (resolveErr) {
                console.warn(`[Database] resolve4 failed (${resolveErr.message}), trying lookup...`);
                try {
                    const lookup = await dns.promises.lookup(hostname, { family: 4 });
                    if (lookup && lookup.address) ip = lookup.address;
                } catch (lookupErr) {
                    console.warn(`[Database] lookup failed: ${lookupErr.message}`);
                }
            }
            
            if (ip) {
                console.log(`[Database] Resolved ${hostname} to ${ip}. Reconnecting with IPv4...`);
                
                // Close the initial pool which might be trying to connect via IPv6
                await db.pool.end();

                // Create new pool with explicit IPv4 and correct SSL SNI
                db.pool = new Pool({
                    user: decodeURIComponent(url.username),
                    password: decodeURIComponent(url.password),
                    host: ip,
                    port: url.port || 5432,
                    database: url.pathname.split('/')[1],
                    ssl: { 
                        rejectUnauthorized: false,
                        servername: hostname // REQUIRED for SNI verification
                    },
                    max: 20, // Default max
                    idleTimeoutMillis: 30000,
                    connectionTimeoutMillis: 10000,
                });
                
                console.log('[Database] Reconnected successfully with IPv4.');
            }
        }
        }
    } catch (dnsErr) {
        console.warn("[Database] DNS resolution warning:", dnsErr.message);
        // Continue with default pool if resolution fails
    }

    let connected = false;
    for (let i = 0; i < 3; i++) {
        try {
            await db.pool.query('SELECT 1');
            connected = true;
            break;
        } catch (e) {
            await new Promise(r => setTimeout(r, 1000 * (i + 1)));
        }
    }
    if (!connected) {
        const isProd = (process.env.NODE_ENV || '').toLowerCase() === 'production';
        if (isProd) {
            throw new Error('Postgres connection failed');
        } else {
            await switchToSqlite();
            return;
        }
    }

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
            corp_position TEXT,
            gender TEXT,
            status TEXT DEFAULT 'Ongoing',
            student_id TEXT UNIQUE NOT NULL,
            profile_pic TEXT,
            is_profile_completed BOOLEAN DEFAULT FALSE,
            is_archived BOOLEAN DEFAULT FALSE
        )`,
        `ALTER TABLE cadets ADD COLUMN IF NOT EXISTS gender TEXT`,
        `CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT CHECK(role IN ('admin', 'cadet', 'training_staff')) NOT NULL,
            cadet_id INTEGER REFERENCES cadets(id) ON DELETE CASCADE,
            staff_id INTEGER REFERENCES training_staff(id) ON DELETE CASCADE,
            is_approved INTEGER DEFAULT 0,
            email TEXT,
            profile_pic TEXT,
            gender TEXT,
            is_archived BOOLEAN DEFAULT FALSE,
            last_latitude DOUBLE PRECISION,
            last_longitude DOUBLE PRECISION,
            last_location_at TIMESTAMP
        )`,
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS gender TEXT`,
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
            image_path TEXT,
            images TEXT,
            type TEXT
        )`,
        `CREATE TABLE IF NOT EXISTS merit_demerit_logs (
            id SERIAL PRIMARY KEY,
            cadet_id INTEGER REFERENCES cadets(id) ON DELETE CASCADE,
            type TEXT CHECK(type IN ('merit', 'demerit')) NOT NULL,
            points INTEGER NOT NULL,
            reason TEXT,
            date_recorded TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
        `ALTER TABLE merit_demerit_logs ADD COLUMN IF NOT EXISTS issued_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL`,
        `ALTER TABLE merit_demerit_logs ADD COLUMN IF NOT EXISTS issued_by_name TEXT`,
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
            primary_color TEXT DEFAULT 'blue',
            custom_bg TEXT
        )`,
        `CREATE TABLE IF NOT EXISTS push_subscriptions (
            id SERIAL PRIMARY KEY,
            user_id INTEGER,
            endpoint TEXT NOT NULL UNIQUE,
            keys TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS admin_messages (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            sender_role TEXT,
            subject TEXT,
            message TEXT,
            status TEXT DEFAULT 'pending',
            admin_reply TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS activity_images (
            id SERIAL PRIMARY KEY,
            activity_id INTEGER REFERENCES activities(id) ON DELETE CASCADE,
            image_path TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`
        ,
        `CREATE TABLE IF NOT EXISTS audit_logs (
            id SERIAL PRIMARY KEY,
            table_name TEXT NOT NULL,
            operation TEXT NOT NULL,
            record_id INTEGER,
            user_id INTEGER,
            payload JSONB,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS sync_events (
            id SERIAL PRIMARY KEY,
            event_type TEXT NOT NULL,
            cadet_id INTEGER REFERENCES cadets(id) ON DELETE CASCADE,
            payload JSONB,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            processed BOOLEAN DEFAULT FALSE,
            processed_at TIMESTAMP
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

        // Migrate existing activity images to activity_images table
        try {
            const activities = await db.pool.query('SELECT id, image_path FROM activities WHERE image_path IS NOT NULL');
            for (const activity of activities.rows) {
                if (activity.image_path) {
                    // Check if already migrated
                    const existing = await db.pool.query('SELECT id FROM activity_images WHERE activity_id = $1 AND image_path = $2', [activity.id, activity.image_path]);
                    if (existing.rows.length === 0) {
                        await db.pool.query('INSERT INTO activity_images (activity_id, image_path) VALUES ($1, $2)', [activity.id, activity.image_path]);
                    }
                }
            }
        } catch (migErr) {
            console.warn('Migration of activity images failed (non-critical):', migErr.message);
        }

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
            `ALTER TABLE cadets ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`,
            `ALTER TABLE cadets ADD COLUMN IF NOT EXISTS corp_position TEXT`,
            `ALTER TABLE cadets ADD COLUMN IF NOT EXISTS gender TEXT`,
            `ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP`,
            `ALTER TABLE users ADD COLUMN IF NOT EXISTS staff_id INTEGER REFERENCES training_staff(id) ON DELETE CASCADE`,
            `ALTER TABLE users ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE`,
            `ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`,
            `ALTER TABLE users ADD COLUMN IF NOT EXISTS last_latitude DOUBLE PRECISION`,
            `ALTER TABLE users ADD COLUMN IF NOT EXISTS last_longitude DOUBLE PRECISION`,
            `ALTER TABLE users ADD COLUMN IF NOT EXISTS last_location_at TIMESTAMP`,
            `ALTER TABLE cadets ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE`,
            `ALTER TABLE training_staff ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE`,
            `ALTER TABLE activities ADD COLUMN IF NOT EXISTS images TEXT`,
            `ALTER TABLE activities ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'activity'`,
            `ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS custom_bg TEXT`,
            `ALTER TABLE merit_demerit_logs ADD COLUMN IF NOT EXISTS issued_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL`,
            `ALTER TABLE merit_demerit_logs ADD COLUMN IF NOT EXISTS issued_by_name TEXT`,
            `ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS time_in TEXT`,
            `ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS time_out TEXT`,
            `ALTER TABLE staff_attendance_records ADD COLUMN IF NOT EXISTS time_in TEXT`,
            `ALTER TABLE staff_attendance_records ADD COLUMN IF NOT EXISTS time_out TEXT`,
            `CREATE INDEX IF NOT EXISTS idx_cadets_company ON cadets(company)`,
            `CREATE INDEX IF NOT EXISTS idx_cadets_platoon ON cadets(platoon)`,
            `CREATE INDEX IF NOT EXISTS idx_cadets_status ON cadets(status)`,
            `CREATE INDEX IF NOT EXISTS idx_cadets_course ON cadets(course)`,
            `CREATE INDEX IF NOT EXISTS idx_users_is_approved ON users(is_approved)`,
            `CREATE INDEX IF NOT EXISTS idx_users_cadet_id ON users(cadet_id)`,
            `CREATE INDEX IF NOT EXISTS idx_attendance_cadet_id ON attendance_records(cadet_id)`,
            `CREATE INDEX IF NOT EXISTS idx_attendance_training_day_id ON attendance_records(training_day_id)`,
            `CREATE INDEX IF NOT EXISTS idx_staff_attendance_staff_id ON staff_attendance_records(staff_id)`,
            `CREATE INDEX IF NOT EXISTS idx_staff_attendance_training_day_id ON staff_attendance_records(training_day_id)`,
            `CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)`,
            `CREATE INDEX IF NOT EXISTS idx_admin_messages_user_id ON admin_messages(user_id)`,
            `CREATE INDEX IF NOT EXISTS idx_training_days_date ON training_days(date)`
        ];

        for (const query of simpleMigrations) {
            try { await db.pool.query(query); } catch (e) { 
                console.warn(`Migration warning (simple):`, e.message);
            }
        }

        // Create audit trigger function and triggers for merit_demerit_logs (Postgres)
        try {
            await db.pool.query(`
                CREATE OR REPLACE FUNCTION fn_merit_demerit_audit()
                RETURNS TRIGGER AS $$
                BEGIN
                    IF (TG_OP = 'INSERT') THEN
                        INSERT INTO audit_logs(table_name, operation, record_id, user_id, payload)
                        VALUES ('merit_demerit_logs', 'INSERT', NEW.id, NEW.issued_by_user_id,
                            json_build_object('cadet_id', NEW.cadet_id, 'type', NEW.type, 'points', NEW.points, 'reason', NEW.reason, 'issued_by_name', NEW.issued_by_name));
                        INSERT INTO sync_events(event_type, cadet_id, payload)
                        VALUES (CASE WHEN NEW.type='merit' THEN 'merit_added' ELSE 'demerit_added' END, NEW.cadet_id,
                            json_build_object('log_id', NEW.id, 'points', NEW.points, 'reason', NEW.reason));
                        RETURN NEW;
                    ELSIF (TG_OP = 'UPDATE') THEN
                        INSERT INTO audit_logs(table_name, operation, record_id, user_id, payload)
                        VALUES ('merit_demerit_logs', 'UPDATE', NEW.id, NEW.issued_by_user_id,
                            json_build_object('before', json_build_object('points', OLD.points, 'type', OLD.type, 'reason', OLD.reason),
                                             'after',  json_build_object('points', NEW.points, 'type', NEW.type, 'reason', NEW.reason)));
                        INSERT INTO sync_events(event_type, cadet_id, payload)
                        VALUES ('ledger_updated', NEW.cadet_id, json_build_object('log_id', NEW.id));
                        RETURN NEW;
                    ELSE
                        INSERT INTO audit_logs(table_name, operation, record_id, user_id, payload)
                        VALUES ('merit_demerit_logs', 'DELETE', OLD.id, OLD.issued_by_user_id,
                            json_build_object('cadet_id', OLD.cadet_id, 'type', OLD.type, 'points', OLD.points, 'reason', OLD.reason));
                        INSERT INTO sync_events(event_type, cadet_id, payload)
                        VALUES (CASE WHEN OLD.type='merit' THEN 'merit_deleted' ELSE 'demerit_deleted' END, OLD.cadet_id,
                            json_build_object('log_id', OLD.id, 'points', OLD.points, 'reason', OLD.reason));
                        RETURN OLD;
                    END IF;
                END;
                $$ LANGUAGE plpgsql;
            `);
            await db.pool.query(`DROP TRIGGER IF EXISTS trg_merit_demerit_audit ON merit_demerit_logs`);
            await db.pool.query(`
                CREATE TRIGGER trg_merit_demerit_audit
                AFTER INSERT OR UPDATE OR DELETE ON merit_demerit_logs
                FOR EACH ROW EXECUTE FUNCTION fn_merit_demerit_audit();
            `);
        } catch (e) {
            console.warn('Trigger setup warning (merit_demerit_logs):', e.message);
        }

        // Migration: Update role check constraint
        try {
            await db.pool.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check`);
            await db.pool.query(`ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'cadet', 'training_staff'))`);
        } catch (e) { 
            console.warn(`Migration warning (role check):`, e.message);
        }

        await db.flushJournal();
        
        // Run performance indexes migration
        console.log('Creating performance indexes...');
        try {
            const { migrate } = require('./migrations/create_performance_indexes');
            await migrate();
            console.log('Performance indexes created successfully.');
        } catch (indexErr) {
            console.warn('Performance indexes creation warning:', indexErr.message);
            // Non-critical, continue
        }
        
        // Run lifetime merit points migration
        console.log('Adding lifetime_merit_points column...');
        try {
            const { addLifetimeMeritPoints } = require('./migrations/add_lifetime_merit_points');
            await addLifetimeMeritPoints();
            console.log('Lifetime merit points migration completed.');
        } catch (meritErr) {
            console.warn('Lifetime merit points migration warning:', meritErr.message);
            // Non-critical, continue
        }
        
        // Run religion field migration
        console.log('Adding religion column to cadets...');
        try {
            const { addReligionToCadets } = require('./migrations/add_religion_to_cadets');
            await addReligionToCadets(db);
            console.log('Religion column migration completed.');
        } catch (religionErr) {
            console.warn('Religion column migration warning:', religionErr.message);
            // Non-critical, continue
        }
        
        // Run birthdate field migration
        console.log('Adding birthdate column to cadets...');
        try {
            const { addBirthdateToCadets } = require('./migrations/add_birthdate_to_cadets');
            await addBirthdateToCadets(db);
            console.log('Birthdate column migration completed.');
        } catch (birthdateErr) {
            console.warn('Birthdate column migration warning:', birthdateErr.message);
            // Non-critical, continue
        }
        
        console.log('Seeding admin...');
        seedAdmin();
        console.log('PostgreSQL initialized successfully.');
    } catch (err) {
        console.error('Error initializing PG DB:', err);
        throw err; // Propagate to server.js
    }
}

async function switchToSqlite() {
    try {
        if (!sqlite3) sqlite3 = require('sqlite3').verbose();
        const dbPath = path.resolve(__dirname, 'rotc.db');
        const sqliteDb = new sqlite3.Database(dbPath, (err) => {
            if (err) console.error('Error opening SQLite database', err.message);
            else {
                console.log('Connected to SQLite database (fallback).');
                sqliteDb.run("PRAGMA foreign_keys = ON");
            }
        });
        db.pool = undefined;
        db.run = sqliteDb.run.bind(sqliteDb);
        db.all = sqliteDb.all.bind(sqliteDb);
        db.get = sqliteDb.get.bind(sqliteDb);
        db.serialize = sqliteDb.serialize.bind(sqliteDb);
        db.initialize = async () => {};
        initSqliteDb();
    } catch (e) {
        console.error('[Database] Fallback to SQLite failed:', e);
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
            corp_position TEXT,
            gender TEXT,
            status TEXT DEFAULT 'Ongoing',
            student_id TEXT UNIQUE NOT NULL,
            profile_pic TEXT,
            is_profile_completed INTEGER DEFAULT 0,
            is_archived INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
            if (err) console.error('Error creating cadets table:', err);
        });
        db.all(`PRAGMA table_info(cadets)`, [], (err, rows) => {
            if (!err) {
                const hasGender = rows.some(r => (r.name || '').toLowerCase() === 'gender');
                if (!hasGender) {
                    db.run(`ALTER TABLE cadets ADD COLUMN gender TEXT`, (e) => {
                        if (e) console.error('Error adding gender column to cadets:', e.message);
                    });
                }
            }
        });

        // Users Table
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT CHECK(role IN ('admin', 'cadet', 'training_staff')) NOT NULL,
            cadet_id INTEGER,
            staff_id INTEGER REFERENCES training_staff(id) ON DELETE CASCADE,
            is_approved INTEGER DEFAULT 0,
            email TEXT,
            profile_pic TEXT,
            gender TEXT,
            is_archived INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            last_latitude REAL,
            last_longitude REAL,
            last_location_at TEXT,
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
            image_path TEXT,
            images TEXT,
            type TEXT
        )`);

        // Ensure new columns exist for legacy databases
        db.all(`PRAGMA table_info(activities)`, [], (err, rows) => {
            if (!err && rows) {
                const hasImages = rows.some(r => r.name === 'images');
                if (!hasImages) {
                    db.run(`ALTER TABLE activities ADD COLUMN images TEXT`);
                }
                const hasType = rows.some(r => r.name === 'type');
                if (!hasType) {
                    db.run(`ALTER TABLE activities ADD COLUMN type TEXT`);
                }
            }
        });

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
        db.run(`ALTER TABLE merit_demerit_logs ADD COLUMN issued_by_user_id INTEGER`, (err) => {});
        db.run(`ALTER TABLE merit_demerit_logs ADD COLUMN issued_by_name TEXT`, (err) => {});

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

        // Migration: Add is_archived to training_staff if missing
        db.all(`PRAGMA table_info('training_staff')`, [], (err, cols) => {
            if (!err && Array.isArray(cols) && !cols.find(c => String(c.name).toLowerCase() === 'is_archived')) {
                db.run(`ALTER TABLE training_staff ADD COLUMN is_archived INTEGER DEFAULT 0`, () => {});
            }
        });

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

        // Migration: Add is_archived and is_profile_completed to cadets
        db.run(`ALTER TABLE cadets ADD COLUMN is_archived INTEGER DEFAULT 0`, (err) => {});
        db.run(`ALTER TABLE cadets ADD COLUMN is_profile_completed INTEGER DEFAULT 0`, (err) => {});
        db.run(`ALTER TABLE cadets ADD COLUMN has_seen_guide INTEGER DEFAULT 0`, (err) => {});
        db.run(`ALTER TABLE cadets ADD COLUMN created_at TEXT DEFAULT CURRENT_TIMESTAMP`, (err) => {});
        // Migration: Add corp_position to cadets
        db.run(`ALTER TABLE cadets ADD COLUMN corp_position TEXT`, (err) => {});
        // Migration: Add religion to cadets
        db.run(`ALTER TABLE cadets ADD COLUMN religion TEXT`, (err) => {});
        // Migration: Add birthdate to cadets
        db.run(`ALTER TABLE cadets ADD COLUMN birthdate TEXT`, (err) => {});
        // Migration: Add gender to cadets
        db.run(`ALTER TABLE cadets ADD COLUMN gender TEXT`, (err) => {});

        db.run(`ALTER TABLE users ADD COLUMN last_seen TEXT`, (err) => {});
        db.run(`ALTER TABLE users ADD COLUMN is_archived INTEGER DEFAULT 0`, (err) => {});
        db.run(`ALTER TABLE users ADD COLUMN created_at TEXT DEFAULT CURRENT_TIMESTAMP`, (err) => {});
        db.run(`ALTER TABLE users ADD COLUMN last_latitude REAL`, (err) => {});
        db.run(`ALTER TABLE users ADD COLUMN last_longitude REAL`, (err) => {});
        db.run(`ALTER TABLE users ADD COLUMN last_location_at TEXT`, (err) => {});
        db.run(`ALTER TABLE users ADD COLUMN gender TEXT`, (err) => {});
        
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

        // Admin Messages Table (Ask Admin)
        db.run(`CREATE TABLE IF NOT EXISTS admin_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            sender_role TEXT,
            subject TEXT,
            message TEXT,
            status TEXT DEFAULT 'pending',
            admin_reply TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        )`);

        // Audit Logs & Sync Events (SQLite)
        db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            table_name TEXT NOT NULL,
            operation TEXT NOT NULL,
            record_id INTEGER,
            user_id INTEGER,
            payload TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )`);
        db.run(`CREATE TABLE IF NOT EXISTS sync_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_type TEXT NOT NULL,
            cadet_id INTEGER,
            payload TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            processed INTEGER DEFAULT 0,
            processed_at TEXT
        )`);
        // Triggers to capture I/U/D on merit_demerit_logs
        db.run(`DROP TRIGGER IF EXISTS trg_merit_demerit_audit`);
        db.run(`
            CREATE TRIGGER IF NOT EXISTS trg_merit_demerit_audit
            AFTER INSERT ON merit_demerit_logs
            BEGIN
              INSERT INTO audit_logs(table_name, operation, record_id, user_id, payload)
              VALUES ('merit_demerit_logs','INSERT', NEW.id, NEW.issued_by_user_id,
                json('{"cadet_id": ' || NEW.cadet_id || ', "type": "' || NEW.type || '", "points": ' || NEW.points || ', "reason": "' || COALESCE(NEW.reason, '') || '", "issued_by_name": "' || COALESCE(NEW.issued_by_name, '') || '"}'));
              INSERT INTO sync_events(event_type, cadet_id, payload)
              VALUES (CASE WHEN NEW.type='merit' THEN 'merit_added' ELSE 'demerit_added' END, NEW.cadet_id,
                json('{"log_id": ' || NEW.id || ', "points": ' || NEW.points || ', "reason": "' || COALESCE(NEW.reason, '') || '"}'));
            END
        `);
        db.run(`DROP TRIGGER IF EXISTS trg_merit_demerit_audit_upd`);
        db.run(`
            CREATE TRIGGER IF NOT EXISTS trg_merit_demerit_audit_upd
            AFTER UPDATE ON merit_demerit_logs
            BEGIN
              INSERT INTO audit_logs(table_name, operation, record_id, user_id, payload)
              VALUES ('merit_demerit_logs','UPDATE', NEW.id, NEW.issued_by_user_id,
                json('{"before": {"type": "' || OLD.type || '", "points": ' || OLD.points || ', "reason": "' || COALESCE(OLD.reason, '') || '"}, "after": {"type": "' || NEW.type || '", "points": ' || NEW.points || ', "reason": "' || COALESCE(NEW.reason, '') || '"}}'));
              INSERT INTO sync_events(event_type, cadet_id, payload)
              VALUES ('ledger_updated', NEW.cadet_id, json('{"log_id": ' || NEW.id || '}'));
            END
        `);
        db.run(`DROP TRIGGER IF EXISTS trg_merit_demerit_audit_del`);
        db.run(`
            CREATE TRIGGER IF NOT EXISTS trg_merit_demerit_audit_del
            AFTER DELETE ON merit_demerit_logs
            BEGIN
              INSERT INTO audit_logs(table_name, operation, record_id, user_id, payload)
              VALUES ('merit_demerit_logs','DELETE', OLD.id, OLD.issued_by_user_id,
                json('{"cadet_id": ' || OLD.cadet_id || ', "type": "' || OLD.type || '", "points": ' || OLD.points || ', "reason": "' || COALESCE(OLD.reason, '') || '"}'));
              INSERT INTO sync_events(event_type, cadet_id, payload)
              VALUES (CASE WHEN OLD.type='merit' THEN 'merit_deleted' ELSE 'demerit_deleted' END, OLD.cadet_id,
                json('{"log_id": ' || OLD.id || ', "points": ' || OLD.points || '}'));
            END
        `);

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
                            // seedDefaultStaff(); // Disabled to prevent ghost entries
                            // seedDefaultCadet(); // Disabled to prevent ghost entries
                        }
                    }
                );
            } catch (hashErr) {
                console.error('Error hashing password:', hashErr);
            }
        } else {
            console.log('Admin account already exists.');
            // seedDefaultStaff(); // Disabled to prevent ghost entries
            // seedDefaultCadet(); // Disabled to prevent ghost entries
        }
    });
}

module.exports = db;
