/**
 * Migration: Add birthdate field to cadets table
 */

const addBirthdateToCadets = (db) => {
    return new Promise((resolve, reject) => {
        const isPostgres = db.pool !== undefined;
        
        if (isPostgres) {
            // PostgreSQL
            db.pool.query(
                `ALTER TABLE cadets ADD COLUMN IF NOT EXISTS birthdate DATE`,
                (err) => {
                    if (err) {
                        console.error('[Migration] Error adding birthdate column (PostgreSQL):', err);
                        return reject(err);
                    }
                    console.log('[Migration] Successfully added birthdate column to cadets table (PostgreSQL)');
                    resolve();
                }
            );
        } else {
            // SQLite
            db.run(
                `ALTER TABLE cadets ADD COLUMN birthdate TEXT`,
                (err) => {
                    if (err) {
                        // Column might already exist
                        if (err.message && err.message.includes('duplicate column')) {
                            console.log('[Migration] Birthdate column already exists (SQLite)');
                            return resolve();
                        }
                        console.error('[Migration] Error adding birthdate column (SQLite):', err);
                        return reject(err);
                    }
                    console.log('[Migration] Successfully added birthdate column to cadets table (SQLite)');
                    resolve();
                }
            );
        }
    });
};

module.exports = { addBirthdateToCadets };
