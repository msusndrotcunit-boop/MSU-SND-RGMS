// Migration: add_lifetime_merit_points
// Adds grades.lifetime_merit_points and backfills from merit_demerit_logs
const db = require('../database');

async function addLifetimeMeritPoints() {
  if (!db || (!db.pool && !db.run)) {
    throw new Error('Database not initialized');
  }

  if (db.pool) {
    // PostgreSQL
    // 1) Add column if not exists
    await db.pool.query(`ALTER TABLE grades ADD COLUMN IF NOT EXISTS lifetime_merit_points INTEGER DEFAULT 0`);
    // 2) Backfill from ledger
    await db.pool.query(`
      UPDATE grades g
      SET lifetime_merit_points = COALESCE(sub.total_merit, 0)
      FROM (
        SELECT cadet_id, COALESCE(SUM(points), 0) AS total_merit
        FROM merit_demerit_logs
        WHERE type = 'merit'
        GROUP BY cadet_id
      ) sub
      WHERE g.cadet_id = sub.cadet_id
    `);
  } else {
    // SQLite
    // 1) Try to add column
    await new Promise((resolve) => {
      db.run(`ALTER TABLE grades ADD COLUMN lifetime_merit_points INTEGER DEFAULT 0`, [], () => resolve());
    });
    // 2) Backfill
    const rows = await new Promise((resolve) => {
      db.all(
        `SELECT cadet_id, COALESCE(SUM(points),0) AS total_merit
         FROM merit_demerit_logs
         WHERE type = 'merit'
         GROUP BY cadet_id`,
        [],
        (_, r) => resolve(r || [])
      );
    });
    for (const r of rows) {
      await new Promise((resolve) => {
        db.run(
          `UPDATE grades SET lifetime_merit_points = ? WHERE cadet_id = ?`,
          [Number(r.total_merit || 0), r.cadet_id],
          () => resolve()
        );
      });
    }
  }

  return { message: 'lifetime_merit_points ensured and backfilled' };
}

module.exports = { addLifetimeMeritPoints };

