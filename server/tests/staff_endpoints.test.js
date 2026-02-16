const express = require('express');
const axios = require('axios');
const http = require('http');

// Configure auth bypass for tests with training_staff role
process.env.BYPASS_AUTH = 'true';
process.env.DEFAULT_ROLE = 'training_staff';

const db = require('../database');
const staffRouter = require('../routes/staff');
const attendanceRouter = require('../routes/attendance');

function assert(cond, msg) {
  if (!cond) {
    console.error('Assertion failed:', msg);
    process.exit(1);
  }
}

async function seedUserWithStaffMapping(staffId) {
  // Ensure users row with id=1 maps to staffId
  await new Promise((resolve) => {
    db.run(
      `INSERT INTO users (id, username, password, role, staff_id) 
       VALUES (1, 'staff.user', 'x', 'training_staff', ?) 
       ON CONFLICT(id) DO UPDATE SET staff_id=excluded.staff_id, role=excluded.role`,
      [staffId],
      () => resolve()
    );
  });
}

async function seedStaff(id, profilePic = null) {
  await new Promise((resolve) => {
    db.run(
      `INSERT INTO training_staff (id, first_name, last_name, rank, role, profile_pic) 
       VALUES (?, 'Test', 'Staff', 'Sgt', 'training_staff', ?)
       ON CONFLICT(id) DO UPDATE SET profile_pic=excluded.profile_pic`,
      [id, profilePic],
      () => resolve()
    );
  });
}

async function waitForTables() {
  const needed = new Set(['users', 'training_staff', 'training_days', 'staff_attendance_records']);
  for (let i = 0; i < 50; i++) {
    const present = await new Promise((resolve) => {
      db.all(`SELECT name FROM sqlite_master WHERE type='table'`, [], (err, rows) => {
        if (err) return resolve([]);
        resolve(rows.map(r => r.name));
      });
    });
    const hasAll = Array.from(needed).every(t => present.includes(t));
    if (hasAll) return;
    await new Promise(r => setTimeout(r, 100));
  }
  console.warn('Proceeding without confirming all tables exist');
}

async function run() {
  const app = express();
  app.use(express.json());
  app.use('/api/staff', staffRouter);
  app.use('/api/attendance', attendanceRouter);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;

  try {
    await waitForTables();
    // Case A: No staff mapping yet -> /api/staff/me returns placeholder object
    const meA = await axios.get(`${base}/api/staff/me`);
    assert(meA.status === 200, 'Expected 200 for placeholder staff profile');
    assert(meA.data && meA.data.profile_pic === null, 'profile_pic should be null for placeholder');

    // Seed mapping and staff without profile pic
    await seedStaff(1, null);
    await seedUserWithStaffMapping(1);

    // Case B: With mapping but no profile pic -> returns row with profile_pic null
    const meB = await axios.get(`${base}/api/staff/me`);
    assert(meB.status === 200, 'Expected 200 for real staff profile without picture');
    assert(meB.data && meB.data.id === 1, 'Expected staff id=1');
    assert(meB.data.profile_pic === null, 'Expected profile_pic null');

    // Attendance history should return an array (possibly empty)
    const histB = await axios.get(`${base}/api/attendance/my-history/staff`);
    assert(Array.isArray(histB.data), 'Expected attendance history array');

    // Update with profile pic
    await seedStaff(1, 'https://example.com/pic.jpg');
    const meC = await axios.get(`${base}/api/staff/me`);
    assert(meC.data.profile_pic === 'https://example.com/pic.jpg', 'Expected profile_pic URL when present');

    console.log('Staff endpoint tests passed');
    process.exit(0);
  } catch (e) {
    console.error('Test error:', e.response?.data || e.message);
    process.exit(1);
  } finally {
    server.close();
  }
}

run().catch((e) => { console.error(e); process.exit(1); });
