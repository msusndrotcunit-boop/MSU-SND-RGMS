/**
 * Migration Script: Add religion and birthdate columns to cadets table
 * 
 * Usage: node server/migrations/run-add-columns.js
 * 
 * This script will add the missing columns to your database.
 */

const db = require('../database');

console.log('=== Running Migration: Add religion and birthdate columns ===\n');

async function runMigration() {
    return new Promise((resolve, reject) => {
        // Check if we're using PostgreSQL or SQLite
        const isPostgres = db.pool !== undefined;
        
        if (isPostgres) {
            console.log('Detected PostgreSQL database');
            
            // PostgreSQL migration
            const queries = [
                {
                    name: 'Add religion column',
                    sql: `
                        DO $$ 
                        BEGIN
                            IF NOT EXISTS (
                                SELECT 1 FROM information_schema.columns 
                                WHERE table_name = 'cadets' AND column_name = 'religion'
                            ) THEN
                                ALTER TABLE cadets ADD COLUMN religion TEXT;
                                RAISE NOTICE 'Added religion column';
                            END IF;
                        END $$;
                    `
                },
                {
                    name: 'Add birthdate column',
                    sql: `
                        DO $$ 
                        BEGIN
                            IF NOT EXISTS (
                                SELECT 1 FROM information_schema.columns 
                                WHERE table_name = 'cadets' AND column_name = 'birthdate'
                            ) THEN
                                ALTER TABLE cadets ADD COLUMN birthdate TEXT;
                                RAISE NOTICE 'Added birthdate column';
                            END IF;
                        END $$;
                    `
                },
                {
                    name: 'Verify columns',
                    sql: `
                        SELECT column_name, data_type 
                        FROM information_schema.columns 
                        WHERE table_name = 'cadets' 
                        AND column_name IN ('religion', 'birthdate')
                        ORDER BY column_name;
                    `
                }
            ];
            
            let completed = 0;
            queries.forEach((query, index) => {
                db.pool.query(query.sql, (err, result) => {
                    if (err) {
                        console.error(`✗ ${query.name} failed:`, err.message);
                    } else {
                        console.log(`✓ ${query.name} completed`);
                        if (query.name === 'Verify columns' && result.rows) {
                            console.log('\nColumns in cadets table:');
                            result.rows.forEach(row => {
                                console.log(`  - ${row.column_name}: ${row.data_type}`);
                            });
                        }
                    }
                    
                    completed++;
                    if (completed === queries.length) {
                        console.log('\n=== Migration Complete ===');
                        resolve();
                    }
                });
            });
        } else {
            console.log('Detected SQLite database');
            
            // SQLite migration
            db.all(`PRAGMA table_info(cadets)`, [], (err, rows) => {
                if (err) {
                    console.error('Error checking table info:', err);
                    return reject(err);
                }
                
                const hasReligion = rows.some(r => r.name === 'religion');
                const hasBirthdate = rows.some(r => r.name === 'birthdate');
                
                let queries = [];
                
                if (!hasReligion) {
                    queries.push({
                        name: 'Add religion column',
                        sql: 'ALTER TABLE cadets ADD COLUMN religion TEXT'
                    });
                } else {
                    console.log('✓ religion column already exists');
                }
                
                if (!hasBirthdate) {
                    queries.push({
                        name: 'Add birthdate column',
                        sql: 'ALTER TABLE cadets ADD COLUMN birthdate TEXT'
                    });
                } else {
                    console.log('✓ birthdate column already exists');
                }
                
                if (queries.length === 0) {
                    console.log('\n=== All columns already exist ===');
                    return resolve();
                }
                
                let completed = 0;
                queries.forEach(query => {
                    db.run(query.sql, (err) => {
                        if (err) {
                            console.error(`✗ ${query.name} failed:`, err.message);
                        } else {
                            console.log(`✓ ${query.name} completed`);
                        }
                        
                        completed++;
                        if (completed === queries.length) {
                            // Verify
                            db.all(`PRAGMA table_info(cadets)`, [], (err, rows) => {
                                if (!err) {
                                    console.log('\nColumns in cadets table:');
                                    rows.forEach(row => {
                                        if (row.name === 'religion' || row.name === 'birthdate') {
                                            console.log(`  - ${row.name}: ${row.type}`);
                                        }
                                    });
                                }
                                console.log('\n=== Migration Complete ===');
                                resolve();
                            });
                        }
                    });
                });
            });
        }
    });
}

runMigration()
    .then(() => {
        console.log('\nMigration successful!');
        process.exit(0);
    })
    .catch((err) => {
        console.error('\nMigration failed:', err);
        process.exit(1);
    });
