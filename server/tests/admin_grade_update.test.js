process.env.BYPASS_AUTH = 'true';
process.env.DEFAULT_ROLE = 'admin';

const express = require('express');
const axios = require('axios');
const http = require('http');
const db = require('../database');
const adminRouter = require('../routes/admin');

function assert(cond, msg) {
  if (!cond) {
    console.error('Assertion failed:', msg);
    process.exit(1);
  }
}

async function waitForTables() {
  const needed = new Set(['cadets', 'grades', 'users']);
  for (let i = 0; i < 50; i++) {
    const present = await new Promise((resolve) => {
      db.all(`SELECT name FROM sqlite_master WHERE type='table'`, [], (err, rows) => {
        if (err) return resolve([]);
        resolve(rows.map(r => r.name));
      });
    });
    const ok = Array.from(needed).every(t => present.includes(t));
    if (ok) return;
    await new Promise(r => setTimeout(r, 100));
  }
}

async function seed() {
  await new Promise(r => db.run(
    `INSERT INTO cadets (id, first_name, last_name, email, student_id, is_profile_completed)
     VALUES (2002, 'Alice', 'Test', 'alice@example.com', '2002', 1)
     ON CONFLICT(id) DO UPDATE SET first_name=excluded.first_name`, [], r));
  await new Promise(r => db.run(
    `INSERT INTO users (id, username, role, cadet_id, is_approved)
     VALUES (2, '2002', 'cadet', 2002, 1)
     ON CONFLICT(id) DO UPDATE SET role=excluded.role, cadet_id=excluded.cadet_id`, [], r));
  await new Promise(r => db.run(
    `INSERT INTO grades (cadet_id, attendance_present, merit_points, demerit_points, prelim_score, midterm_score, final_score, status)
     VALUES (2002, 0, 0, 0, 0, 0, 0, 'active')
     ON CONFLICT(cadet_id) DO NOTHING`, [], r));
}

async function run() {
  const app = express();
  app.use(express.json());
  app.use('/api/admin', adminRouter);
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;

  try {
    await waitForTables();
    await seed();

    const payload = {
      attendancePresent: 12,
      meritPoints: 10,
      demeritPoints: 2,
      prelimScore: 80,
      midtermScore: 85,
      finalScore: 90,
      status: 'active'
    };
    const upd = await axios.put(`${base}/api/admin/grades/2002`, payload);
    assert(upd.status === 200, 'Expected 200 from admin grade update');

    const row = await new Promise((resolve) => {
      db.get(`SELECT * FROM grades WHERE cadet_id = ?`, [2002], (err, r) => resolve(r));
    });
    assert(row, 'Grades row should exist for cadet 2002');
    assert(row.prelim_score === 80 && row.midterm_score === 85 && row.final_score === 90, 'Scores not updated correctly');
    assert(row.merit_points === 10 && row.demerit_points === 2, 'Merit/Demerit not updated correctly');
    // Attendance is controlled by attendance_records via updateTotalAttendance; with no training days it remains 0
    assert(row.attendance_present === 0, 'Attendance not updated correctly (should reflect records count)');

    console.log('Admin grade update test passed');
    process.exit(0);
  } catch (e) {
    console.error('Test error:', e.response?.data || e.message);
    process.exit(1);
  } finally {
    server.close();
  }
}

run().catch((e) => { console.error(e); process.exit(1); });
