process.env.BYPASS_AUTH = 'true';

const express = require('express');
const axios = require('axios');
const http = require('http');
const db = require('../database');
const authRouter = require('../routes/auth');

function assert(cond, msg) {
  if (!cond) {
    console.error('Assertion failed:', msg);
    process.exit(1);
  }
}

async function seed() {
  await new Promise(r => db.run(
    `INSERT INTO cadets (id, first_name, last_name, email, student_id, is_profile_completed)
     VALUES (3101, 'Cathy', 'LoginTest', 'cathy@example.com', '3101', 1)
     ON CONFLICT(id) DO UPDATE SET is_profile_completed=excluded.is_profile_completed`, [], r));
  const existing = await new Promise(resolve => {
    db.get(`SELECT * FROM users WHERE username = ?`, ['3101'], (e, row) => resolve(row));
  });
  if (!existing) {
    await new Promise(r => db.run(
      `INSERT INTO users (username, email, role, cadet_id, is_approved)
       VALUES ('3101', 'cathy@example.com', 'cadet', NULL, 1)`, [], r));
  } else {
    await new Promise(r => db.run(
      `UPDATE users SET email='cathy@example.com', role='cadet', cadet_id=NULL, is_approved=1 WHERE username='3101'`, [], r));
  }
}

async function run() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;

  try {
    await seed();
    const resp = await axios.post(`${base}/api/auth/cadet-login`, { identifier: '3101' });
    assert(resp.status === 200, 'Login should succeed');
    assert(resp.data.cadetId, 'Login should return cadetId');
    assert(resp.data.isProfileCompleted === true, 'isProfileCompleted should be true on login');
    console.log('Cadet login completion test passed');
    process.exit(0);
  } catch (e) {
    console.error('Test error:', e.response?.data || e.message);
    process.exit(1);
  } finally {
    server.close();
  }
}

run().catch((e) => { console.error(e); process.exit(1); });
