const sqlite3 = require('sqlite3').verbose();
const path = require('path');

function openDb() {
  const dbPath = path.resolve(__dirname, '..', 'rotc.db');
  return new sqlite3.Database(dbPath);
}

function all(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

(async () => {
  const db = openDb();
  try {
    const staffCount = await all(db, 'SELECT COUNT(*) as c FROM training_staff');

    // Detect columns
    const pragma = await all(db, "PRAGMA table_info('training_staff')");
    const hasArchived = pragma.some(c => String(c.name).toLowerCase() === 'is_archived');
    const cols = ['id','first_name','last_name','email','role','created_at'].concat(hasArchived ? ['is_archived'] : []);

    let archivedCount = [{ c: 0 }];
    if (hasArchived) {
      archivedCount = await all(db, 'SELECT COUNT(*) as c FROM training_staff WHERE is_archived IS TRUE OR is_archived=1');
    }
    const recentStaff = await all(db, `SELECT ${cols.join(', ')} FROM training_staff ORDER BY id DESC LIMIT 10`);

    const usersStaffCount = await all(db, "SELECT COUNT(*) as c FROM users WHERE role='training_staff'");
    const recentUsersStaff = await all(db, "SELECT id, username, staff_id, is_archived, created_at FROM users WHERE role='training_staff' ORDER BY id DESC LIMIT 10");

    console.log('training_staff total:', staffCount[0]?.c ?? 0);
    if (hasArchived) console.log('training_staff archived:', archivedCount[0]?.c ?? 0);
    console.log('recent training_staff:', recentStaff);
    console.log('users (training_staff role) total:', usersStaffCount[0]?.c ?? 0);
    console.log('recent users with training_staff role:', recentUsersStaff);
  } catch (e) {
    console.error('Diagnosis failed:', e.message);
    process.exitCode = 1;
  } finally {
    db.close();
  }
})();
