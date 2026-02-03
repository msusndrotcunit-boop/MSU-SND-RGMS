const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'server', 'database.sqlite');
const db = new sqlite3.Database(DB_PATH);

async function runTest() {
    // 1. Setup Test Data
    const staffId = 999;
    const dayId = 999;
    
    await new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run("INSERT OR REPLACE INTO training_staff (id, rank, first_name, last_name, role) VALUES (?, 'Cdt', 'Test', 'Staff', 'Instructor')", [staffId]);
            db.run("INSERT OR REPLACE INTO training_days (id, date, title, description) VALUES (?, '2025-01-01', 'Test Day', 'Test')", [dayId]);
            // Ensure admin user exists for token (we'll skip token and use a direct DB check or mock the middleware if testing unit-style, 
            // but for integration we need a token. 
            // Actually, let's just use the known admin credentials to get a token first.)
            resolve();
        });
    });

    console.log("Test data seeded.");

    try {
        // 2. Login to get token
        const loginRes = await axios.post('http://localhost:5000/api/auth/login', {
            username: 'msu-sndrotc_admin',
            password: 'admingrading@2026'
        });
        const token = loginRes.data.token;
        console.log("Admin logged in. Token obtained.");

        // 3. Test Mark Absent
        console.log("Testing Mark Absent...");
        const qrData = JSON.stringify({ id: staffId });
        
        await axios.post('http://localhost:5000/api/attendance/staff/scan', {
            dayId: dayId,
            qrData: qrData,
            status: 'absent'
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });

        // Verify in DB
        await new Promise((resolve, reject) => {
            db.get("SELECT status FROM staff_attendance_records WHERE staff_id = ? AND training_day_id = ?", [staffId, dayId], (err, row) => {
                if (err) reject(err);
                if (row && row.status === 'absent') {
                    console.log("PASS: Record marked as absent.");
                    resolve();
                } else {
                    reject(new Error(`FAIL: Expected absent, got ${row ? row.status : 'null'}`));
                }
            });
        });

        // 4. Test Mark Present (Update)
        console.log("Testing Mark Present...");
        await axios.post('http://localhost:5000/api/attendance/staff/scan', {
            dayId: dayId,
            qrData: qrData,
            status: 'present'
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });

        // Verify in DB
        await new Promise((resolve, reject) => {
            db.get("SELECT status FROM staff_attendance_records WHERE staff_id = ? AND training_day_id = ?", [staffId, dayId], (err, row) => {
                if (err) reject(err);
                if (row && row.status === 'present') {
                    console.log("PASS: Record updated to present.");
                    resolve();
                } else {
                    reject(new Error(`FAIL: Expected present, got ${row ? row.status : 'null'}`));
                }
            });
        });

    } catch (err) {
        console.error("Test Failed:", err.response ? err.response.data : err.message);
    } finally {
        db.close();
    }
}

runTest();
