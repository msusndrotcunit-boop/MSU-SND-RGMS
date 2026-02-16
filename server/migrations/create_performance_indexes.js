/**
 * Performance Indexes Migration
 * Creates comprehensive indexes for optimal query performance
 * 
 * Validates Requirements: 1.1, 4.1, 4.2, 4.3, 4.4
 */

const db = require('../database');

// Define all required indexes
const INDEXES = [
    // Single-column indexes on foreign keys
    { name: 'idx_perf_grades_cadet_id', table: 'grades', columns: ['cadet_id'] },
    { name: 'idx_perf_users_cadet_id', table: 'users', columns: ['cadet_id'] },
    { name: 'idx_perf_users_staff_id', table: 'users', columns: ['staff_id'] },
    { name: 'idx_perf_merit_demerit_cadet_id', table: 'merit_demerit_logs', columns: ['cadet_id'] },
    { name: 'idx_perf_attendance_cadet_id', table: 'attendance_records', columns: ['cadet_id'] },
    { name: 'idx_perf_attendance_training_day_id', table: 'attendance_records', columns: ['training_day_id'] },
    { name: 'idx_perf_staff_attendance_staff_id', table: 'staff_attendance_records', columns: ['staff_id'] },
    { name: 'idx_perf_staff_attendance_training_day_id', table: 'staff_attendance_records', columns: ['training_day_id'] },
    { name: 'idx_perf_excuse_letters_cadet_id', table: 'excuse_letters', columns: ['cadet_id'] },
    { name: 'idx_perf_excuse_letters_training_day_id', table: 'excuse_letters', columns: ['training_day_id'] },
    { name: 'idx_perf_notifications_user_id', table: 'notifications', columns: ['user_id'] },
    
    // Single-column indexes on frequently queried columns
    { name: 'idx_perf_cadets_status', table: 'cadets', columns: ['status'] },
    { name: 'idx_perf_cadets_is_archived', table: 'cadets', columns: ['is_archived'] },
    { name: 'idx_perf_users_is_archived', table: 'users', columns: ['is_archived'] },
    { name: 'idx_perf_merit_demerit_type', table: 'merit_demerit_logs', columns: ['type'] },
    { name: 'idx_perf_merit_demerit_date', table: 'merit_demerit_logs', columns: ['date_recorded'] },
    { name: 'idx_perf_attendance_status', table: 'attendance_records', columns: ['status'] },
    { name: 'idx_perf_training_days_date', table: 'training_days', columns: ['date'] },
    { name: 'idx_perf_notifications_is_read', table: 'notifications', columns: ['is_read'] },
    { name: 'idx_perf_activities_type', table: 'activities', columns: ['type'] },
    { name: 'idx_perf_activities_date', table: 'activities', columns: ['date'] },
    
    // Composite indexes for frequently joined columns
    { name: 'idx_perf_cadets_status_archived', table: 'cadets', columns: ['status', 'is_archived'] },
    { name: 'idx_perf_merit_demerit_cadet_type', table: 'merit_demerit_logs', columns: ['cadet_id', 'type'] },
    { name: 'idx_perf_attendance_training_cadet', table: 'attendance_records', columns: ['training_day_id', 'cadet_id'] },
    { name: 'idx_perf_notifications_user_read', table: 'notifications', columns: ['user_id', 'is_read'] },
];

/**
 * Check if an index exists
 */
async function indexExists(indexName) {
    if (db.pool) {
        // PostgreSQL
        const result = await db.pool.query(
            `SELECT indexname FROM pg_indexes WHERE indexname = $1`,
            [indexName]
        );
        return result.rows.length > 0;
    } else {
        // SQLite
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT name FROM sqlite_master WHERE type='index' AND name=?`,
                [indexName],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(!!row);
                }
            );
        });
    }
}

/**
 * Create a single index
 */
async function createIndex(indexDef) {
    const { name, table, columns } = indexDef;
    const columnList = columns.join(', ');
    const sql = `CREATE INDEX IF NOT EXISTS ${name} ON ${table}(${columnList})`;
    
    try {
        if (db.pool) {
            // PostgreSQL
            await db.pool.query(sql);
        } else {
            // SQLite
            await new Promise((resolve, reject) => {
                db.run(sql, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        }
        console.log(`[Index Migration] ✓ Created index: ${name} on ${table}(${columnList})`);
        return { success: true, index: name };
    } catch (err) {
        console.error(`[Index Migration] ✗ Failed to create index: ${name}`, err.message);
        return { success: false, index: name, error: err.message };
    }
}

/**
 * Verify all indexes exist
 */
async function verifyIndexes() {
    console.log('[Index Migration] Verifying indexes...');
    const results = {
        valid: [],
        missing: [],
        total: INDEXES.length
    };
    
    for (const indexDef of INDEXES) {
        try {
            const exists = await indexExists(indexDef.name);
            if (exists) {
                results.valid.push(indexDef.name);
            } else {
                results.missing.push(indexDef.name);
            }
        } catch (err) {
            console.error(`[Index Migration] Error checking index ${indexDef.name}:`, err.message);
            results.missing.push(indexDef.name);
        }
    }
    
    console.log(`[Index Migration] Verification complete: ${results.valid.length}/${results.total} indexes exist`);
    return results;
}

/**
 * Drop all performance indexes (rollback)
 */
async function rollbackIndexes() {
    console.log('[Index Migration] Rolling back indexes...');
    const results = {
        dropped: [],
        failed: []
    };
    
    for (const indexDef of INDEXES) {
        const sql = `DROP INDEX IF EXISTS ${indexDef.name}`;
        try {
            if (db.pool) {
                await db.pool.query(sql);
            } else {
                await new Promise((resolve, reject) => {
                    db.run(sql, (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
            }
            console.log(`[Index Migration] ✓ Dropped index: ${indexDef.name}`);
            results.dropped.push(indexDef.name);
        } catch (err) {
            console.error(`[Index Migration] ✗ Failed to drop index: ${indexDef.name}`, err.message);
            results.failed.push({ index: indexDef.name, error: err.message });
        }
    }
    
    console.log(`[Index Migration] Rollback complete: ${results.dropped.length} indexes dropped`);
    return results;
}

/**
 * Run the migration
 */
async function migrate() {
    console.log('[Index Migration] Starting performance index migration...');
    console.log(`[Index Migration] Creating ${INDEXES.length} indexes...`);
    
    const results = {
        created: [],
        existing: [],
        failed: []
    };
    
    for (const indexDef of INDEXES) {
        try {
            // Check if index already exists
            const exists = await indexExists(indexDef.name);
            if (exists) {
                console.log(`[Index Migration] ⊙ Index already exists: ${indexDef.name}`);
                results.existing.push(indexDef.name);
                continue;
            }
            
            // Create the index
            const result = await createIndex(indexDef);
            if (result.success) {
                results.created.push(result.index);
            } else {
                results.failed.push({ index: result.index, error: result.error });
            }
        } catch (err) {
            console.error(`[Index Migration] ✗ Error processing index ${indexDef.name}:`, err.message);
            results.failed.push({ index: indexDef.name, error: err.message });
        }
    }
    
    // Summary
    console.log('\n[Index Migration] ========== MIGRATION SUMMARY ==========');
    console.log(`[Index Migration] Total indexes: ${INDEXES.length}`);
    console.log(`[Index Migration] Created: ${results.created.length}`);
    console.log(`[Index Migration] Already existing: ${results.existing.length}`);
    console.log(`[Index Migration] Failed: ${results.failed.length}`);
    
    if (results.failed.length > 0) {
        console.log('\n[Index Migration] Failed indexes:');
        results.failed.forEach(f => {
            console.log(`[Index Migration]   - ${f.index}: ${f.error}`);
        });
    }
    
    console.log('[Index Migration] =====================================\n');
    
    return results;
}

// Export functions for use in other scripts
module.exports = {
    migrate,
    verifyIndexes,
    rollbackIndexes,
    INDEXES
};

// Run migration if executed directly
if (require.main === module) {
    migrate()
        .then(results => {
            if (results.failed.length > 0) {
                process.exit(1);
            } else {
                console.log('[Index Migration] Migration completed successfully!');
                process.exit(0);
            }
        })
        .catch(err => {
            console.error('[Index Migration] Migration failed:', err);
            process.exit(1);
        });
}
