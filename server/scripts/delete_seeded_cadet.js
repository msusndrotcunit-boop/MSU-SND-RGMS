const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dbPath = path.resolve(__dirname, '../rotc.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Failed to open SQLite DB:', err.message);
    process.exit(1);
  }
});

db.serialize(async () => {
  db.run('PRAGMA foreign_keys = ON');
  const username = 'cadet@2026';
  const email = 'cadet2026@default.com';
  const studentId = 'DEFAULT_CADET';

  const getUser = () =>
    new Promise((resolve, reject) => {
      db.get('SELECT id FROM users WHERE username = ? OR email = ?', [username, email], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

  const getCadet = () =>
    new Promise((resolve, reject) => {
      db.get('SELECT id FROM cadets WHERE student_id = ?', [studentId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

  const run = (sql, params) =>
    new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });

  try {
    const u = await getUser();
    const c = await getCadet();
    if (!u && !c) {
      console.log('No seeded cadet found. Nothing to delete.');
    } else {
      if (u) {
        const changes = await run('DELETE FROM users WHERE id = ?', [u.id]);
        console.log(`Deleted seeded user id=${u.id} changes=${changes}`);
      }
      if (c) {
        const changes = await run('DELETE FROM cadets WHERE id = ?', [c.id]);
        console.log(`Deleted seeded cadet id=${c.id} changes=${changes}`);
      }
      console.log('Seeded cadet cleanup complete.');
    }
  } catch (e) {
    console.error('Cleanup error:', e.message);
    process.exitCode = 1;
  } finally {
    db.close();
  }
});
