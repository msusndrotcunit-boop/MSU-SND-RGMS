process.env.BYPASS_AUTH = 'true';
process.env.DEFAULT_ROLE = 'cadet';

const express = require('express');
const axios = require('axios');
const http = require('http');
const db = require('../database');
const authRouter = require('../routes/auth');
const cadetRouter = require('../routes/cadet');

function assert(cond, msg) {
  if (!cond) {
    console.error('Assertion failed:', msg);
    process.exit(1);
  }
}

async function seed() {
  await new Promise(r => db.run(
    `INSERT INTO cadets (id, first_name, last_name, email, student_id, is_profile_completed)
     VALUES (3003, 'Bob', 'Profile', 'bob@example.com', '3003', 1)
     ON CONFLICT(id) DO UPDATE SET is_profile_completed=excluded.is_profile_completed`, [], r));
  const existing = await new Promise(resolve => {
    db.get(`SELECT * FROM users WHERE username = ?`, ['3003'], (e, row) => resolve(row));
  });
  if (!existing) {
    await new Promise(r => db.run(
      `INSERT INTO users (username, email, role, cadet_id, is_approved)
       VALUES ('3003', 'bob@example.com', 'cadet', NULL, 1)`, [], r));
  } else {
    await new Promise(r => db.run(
      `UPDATE users SET email='bob@example.com', role='cadet', cadet_id=NULL, is_approved=1 WHERE username='3003'`, [], r));
  }
}

async function run() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  app.use('/api/cadet', (req, res, next) => {
    // Minimal auth passthrough for tests
    req.user = { id: 3, role: 'cadet', cadetId: 3003 };
    return cadetRouter(req, res, next);
  });
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;

  try {
    await seed();

    // Ensure GET /cadet/profile returns fresh data (no cache)
    const profileRes = await axios.get(`${base}/api/cadet/profile`);
    assert(profileRes.status === 200, 'Profile fetch should succeed');
    assert(profileRes.data && profileRes.data.is_profile_completed == 1, 'Profile endpoint should reflect completed');

    console.log('Cadet profile completion (no-cache) test passed');
    process.exit(0);
  } catch (e) {
    console.error('Test error:', e.response?.data || e.message);
    process.exit(1);
  } finally {
    server.close();
  }
}

run().catch((e) => { console.error(e); process.exit(1); });
