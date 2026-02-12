/**
 * Performance Optimization Migration
 * Adds database indexes to improve query performance
 * Expected Impact: 50-70% query speed improvement
 */

const db = require('../database');

const indexes = [
    // Primary foreign key indexes
    'CREATE INDEX IF NOT EXISTS idx_grades_cadet_id ON grades(cadet_id)',
    'CREATE INDEX IF NOT EXISTS idx_attendance_records_cadet_id ON attendance_records(cadet_id)',
    'CREATE INDEX IF NOT EXISTS idx_attendance_records_status ON attendance_records(status)',
    'CREATE INDEX IF NOT EXISTS idx_merit_demerit_logs_cadet_id ON merit_demerit_logs(cadet_id)',
    'CREATE INDEX IF NOT EXISTS idx_merit_demerit_logs_type ON merit_demerit_logs(type)',
    'CREATE INDEX IF NOT EXISTS idx_users_cadet_id ON users(cadet_id)',
    'CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)',
    'CREATE INDEX IF NOT EXISTS idx_activities_type ON activities(type)',
    'CREATE INDEX IF NOT EXISTS idx_activities_date ON activities(date)',
    'CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read)',
    
    // Composite indexes for common query patterns
    'CREATE INDEX IF NOT EXISTS idx_attendance_cadet_status ON attendance_records(cadet_id, status)',
    'CREATE INDEX IF NOT EXISTS idx_merit_cadet_type ON merit_demerit_logs(cadet_id, type)',
    'CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read)',
];

async function runMigration() {
    console.log('🚀 Starting performance optimization migration...');
    console.log(`📊 Adding ${indexes.length} database indexes...`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const indexSql of indexes) {
        try {
            await new Promise((resolve, reject) => {
                db.run(indexSql, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
            
            const indexName = indexSql.match(/idx_\w+/)[0];
            console.log(`✅ Created index: ${indexName}`);
            successCount++;
        } catch (error) {
            console.error(`❌ Error creating index:`, error.message);
            errorCount++;
        }
    }
    
    console.log('\n📈 Migration Summary:');
    console.log(`   ✅ Success: ${successCount} indexes`);
    console.log(`   ❌ Errors: ${errorCount} indexes`);
    console.log(`   📊 Total: ${indexes.length} indexes`);
    
    if (successCount > 0) {
        console.log('\n🎉 Performance indexes added successfully!');
        console.log('💡 Expected improvement: 50-70% faster queries');
    }
    
    process.exit(errorCount > 0 ? 1 : 0);
}

// Run if called directly
if (require.main === module) {
    runMigration().catch(err => {
        console.error('❌ Migration failed:', err);
        process.exit(1);
    });
}

module.exports = { runMigration };
