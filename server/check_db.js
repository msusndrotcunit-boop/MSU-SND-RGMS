const path = require('path');
const db = require('./database');

async function main() {
    const mode = db.pool ? 'postgres' : 'sqlite';
    console.log(`[check_db] Starting database check (${mode})`);

    try {
        if (db.pool) {
            await db.pool.query('SELECT 1');
        } else {
            await new Promise((resolve, reject) => {
                db.get('SELECT 1 as ok', [], (err, row) => {
                    if (err) return reject(err);
                    resolve(row);
                });
            });
        }
        console.log('[check_db] Connection OK');
    } catch (err) {
        console.error('[check_db] Connection failed', err.message || err);
        process.exitCode = 1;
        return;
    }

    try {
        const query = 'SELECT name FROM sqlite_master WHERE type = ? AND name = ?';
        if (!db.pool) {
            await new Promise((resolve, reject) => {
                db.get(query, ['table', 'cadets'], (err, row) => {
                    if (err) return reject(err);
                    if (!row) return reject(new Error('cadets table not found'));
                    resolve(row);
                });
            });
        } else {
            const res = await db.pool.query('SELECT 1 FROM cadets LIMIT 1');
            if (!res) throw new Error('cadets table not accessible');
        }
        console.log('[check_db] cadets table OK');
    } catch (err) {
        console.error('[check_db] cadets table check failed', err.message || err);
        process.exitCode = 1;
        return;
    }

    try {
        if (!db.pool) {
            await new Promise((resolve, reject) => {
                db.get('SELECT COUNT(*) as count FROM cadets', [], (err, row) => {
                    if (err) return reject(err);
                    console.log(`[check_db] cadets rows: ${row ? row.count : 0}`);
                    resolve();
                });
            });
        } else {
            const res = await db.pool.query('SELECT COUNT(*) AS count FROM cadets');
            const count = res && res.rows && res.rows[0] ? res.rows[0].count : 0;
            console.log(`[check_db] cadets rows: ${count}`);
        }
    } catch (err) {
        console.error('[check_db] Sample data query failed', err.message || err);
        process.exitCode = 1;
        return;
    }

    console.log('[check_db] Database check completed successfully');
}

main().catch((err) => {
    console.error('[check_db] Unexpected error', err);
    process.exitCode = 1;
});

