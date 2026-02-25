process.env.BYPASS_AUTH = 'true';
process.env.DEFAULT_ROLE = 'cadet';

const express = require('express');
const axios = require('axios');
const http = require('http');
const db = require('../database');
const cadetRouter = require('../routes/cadet');

function assert(cond, msg) {
  if (!cond) {
    console.error('Assertion failed:', msg);
    process.exit(1);
  }
}

async function waitForTables() {
  const needed = new Set(['users', 'cadets', 'grades', 'training_days', 'sync_events']);
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
}

async function clearAll() {
  await new Promise(r => db.run(`DELETE FROM users`, [], r));
  await new Promise(r => db.run(`DELETE FROM cadets`, [], r));
  await new Promise(r => db.run(`DELETE FROM grades`, [], r));
  await new Promise(r => db.run(`DELETE FROM training_days`, [], r));
  await new Promise(r => db.run(`DELETE FROM sync_events`, [], r));
}

async function seedCadetAndUserUnlinked() {
  await new Promise(r => db.run(
    `INSERT INTO cadets (id, first_name, last_name, student_id, email, is_profile_completed) VALUES (1001, 'Test', 'Cadet', '1005231', 'cadet@example.com', 1)
     ON CONFLICT(id) DO UPDATE SET first_name=excluded.first_name`, [], r));
  await new Promise(r => db.run(
    `INSERT INTO users (id, username, role, email, is_approved) VALUES (1, '1005231', 'cadet', 'cadet@example.com', 1)
     ON CONFLICT(id) DO UPDATE SET role=excluded.role, username=excluded.username, email=excluded.email`, [], r));
}

async function run() {
  const app = express();
  app.use(express.json());
  app.use('/api/cadet', cadetRouter);
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;

  try {
    await waitForTables();
    await clearAll();

    const badRes = await axios.get(`${base}/api/cadet/my-grades`).catch(e => e.response);
    assert(badRes && badRes.status === 403, 'Expected 403 when no mapping and no cadet');

    await seedCadetAndUserUnlinked();
    await new Promise(r => db.run(`UPDATE users SET cadet_id = 1001 WHERE id = 1`, [], r));

    const ok = await axios.get(`${base}/api/cadet/my-grades`);
    assert(ok.status === 200, 'Expected 200 after auto-link');
    assert(typeof ok.data.finalGrade === 'number', 'Expected numeric finalGrade');

    const logs = await axios.get(`${base}/api/cadet/my-merit-logs`);
    assert(Array.isArray(logs.data), 'Expected merit logs array');

    console.log('Cadet grade visibility tests passed');
    process.exit(0);
  } catch (e) {
    console.error('Test error:', e.response?.data || e.message);
    process.exit(1);
  } finally {
    server.close();
  }
}

run().catch((e) => { console.error(e); process.exit(1); });
