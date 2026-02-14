/**
 * Migration: Add religion field to cadets table
 */

const addReligionToCadets = (db) => {
    return new Promise((resolve, reject) => {
        const isPostgres = db.pool !== undefined;
        
        if (isPostgres) {
            // PostgreSQL
            db.query(
                `ALTER TABLE cadets ADD COLUMN IF NOT EXISTS religion TEXT`,
                (err) => {
                    if (err) {
                        console.error('[Migration] Error adding religion column (PostgreSQL):', err);
                        return reject(err);
                    }
                    console.log('[Migration] Successfully added religion column to cadets table (PostgreSQL)');
                    resolve();
                }
            );
        } else {
            // SQLite
            db.run(
                `ALTER TABLE cadets ADD COLUMN religion TEXT`,
                (err) => {
                    if (err) {
                        // Column might already exist
                        if (err.message && err.message.includes('duplicate column')) {
                            console.log('[Migration] Religion column already exists (SQLite)');
                            return resolve();
                        }
                        console.error('[Migration] Error adding religion column (SQLite):', err);
                        return reject(err);
                    }
                    console.log('[Migration] Successfully added religion column to cadets table (SQLite)');
                    resolve();
                }
            );
        }
    });
};

module.exports = { addReligionToCadets };
