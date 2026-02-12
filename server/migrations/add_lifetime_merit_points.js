const db = require('../database');

/**
 * Migration: Add lifetime_merit_points to grades table
 * 
 * This tracks the total merit points earned by a cadet across their entire ROTC career,
 * regardless of the 100-point ceiling. This allows recognition of achievement even when
 * the active merit score is capped at 100.
 */

const addLifetimeMeritPoints = () => {
    return new Promise((resolve, reject) => {
        // Check if column already exists
        const checkSql = db.pool 
            ? `SELECT column_name FROM information_schema.columns WHERE table_name = 'grades' AND column_name = 'lifetime_merit_points'`
            : `PRAGMA table_info(grades)`;

        db.all(checkSql, [], (err, rows) => {
            if (err) {
                console.error('Error checking for lifetime_merit_points column:', err);
                return reject(err);
            }

            const columnExists = db.pool 
                ? rows.length > 0
                : rows.some(row => row.name === 'lifetime_merit_points');

            if (columnExists) {
                console.log('✓ lifetime_merit_points column already exists');
                return resolve();
            }

            // Add the column
            const alterSql = `ALTER TABLE grades ADD COLUMN lifetime_merit_points INTEGER DEFAULT 0`;
            
            db.run(alterSql, [], (err) => {
                if (err) {
                    console.error('Error adding lifetime_merit_points column:', err);
                    return reject(err);
                }

                console.log('✓ Added lifetime_merit_points column to grades table');

                // Initialize lifetime_merit_points with current merit_points for existing records
                const initSql = `UPDATE grades SET lifetime_merit_points = merit_points WHERE lifetime_merit_points = 0 OR lifetime_merit_points IS NULL`;
                
                db.run(initSql, [], (err) => {
                    if (err) {
                        console.error('Error initializing lifetime_merit_points:', err);
                        return reject(err);
                    }

                    console.log('✓ Initialized lifetime_merit_points for existing cadets');
                    resolve();
                });
            });
        });
    });
};

// Run migration if called directly
if (require.main === module) {
    addLifetimeMeritPoints()
        .then(() => {
            console.log('\n✓ Migration completed successfully');
            process.exit(0);
        })
        .catch((err) => {
            console.error('\n✗ Migration failed:', err);
            process.exit(1);
        });
}

module.exports = { addLifetimeMeritPoints };
