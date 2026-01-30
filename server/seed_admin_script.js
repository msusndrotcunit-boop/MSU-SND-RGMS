const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const dbPath = path.resolve(__dirname, 'rotc.db');
const db = new sqlite3.Database(dbPath);
require('dotenv').config();

const username = process.env.ADMIN_USERNAME || 'msu-sndrotc_admin';
const password = process.env.ADMIN_PASSWORD || 'admingrading@2026';
const email = process.env.ADMIN_EMAIL || 'msusndrotcunit@gmail.com';

(async () => {
    const hashedPassword = await bcrypt.hash(password, 10);

    db.serialize(() => {
        db.get("SELECT * FROM users WHERE username = ?", [username], (err, row) => {
            if (row) {
                 db.run("UPDATE users SET password = ?, is_approved = 1, role = 'admin', email = ? WHERE username = ?", [hashedPassword, email, username], (err) => {
                     if (err) console.error(err);
                     else console.log('Admin updated with email');
                 });
            } else {
                db.run(`INSERT INTO users (username, password, role, is_approved, email) VALUES (?, ?, 'admin', 1, ?)`, 
                    [username, hashedPassword, email], 
                    (err) => {
                        if (err) console.error(err);
                        else console.log('Admin seeded with email');
                    }
                );
            }
        });
    });
})();
