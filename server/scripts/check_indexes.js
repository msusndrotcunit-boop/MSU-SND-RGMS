/**
 * Check and create performance indexes
 * Run this script manually if indexes aren't created on startup
 */

const db = require('../database');

async function checkIndexes() {
    console.log('Checking performance indexes...');
    
    try {
        if (db.pool) {
            // PostgreSQL - check indexes
            const result = await db.pool.query(`
                SELECT indexname 
                FROM pg_indexes 
                WHERE schemaname = 'public' 
                AND indexname LIKE 'idx_perf_%'
                ORDER BY indexname
            `);
            
            console.log(`Found ${result.rows.length} performance indexes:`);
            result.rows.forEach(row => console.log(`  - ${row.indexname}`));
            
            if (result.rows.length === 0) {
                console.log('\nNo performance indexes found! Creating them now...');
                const { createPerformanceIndexes } = require('../migrations/create_performance_indexes');
                await createPerformanceIndexes();
                console.log('Performance indexes created successfully!');
            } else {
                console.log('\nPerformance indexes are already in place.');
            }
            
            // Check lifetime_merit_points column
            const columnCheck = await db.pool.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'grades' 
                AND column_name = 'lifetime_merit_points'
            `);
            
            if (columnCheck.rows.length === 0) {
                console.log('\nlifetime_merit_points column not found! Adding it now...');
                const { addLifetimeMeritPoints } = require('../migrations/add_lifetime_merit_points');
                await addLifetimeMeritPoints();
                console.log('lifetime_merit_points column added successfully!');
            } else {
                console.log('lifetime_merit_points column exists.');
            }
            
        } else {
            console.log('Using SQLite - indexes should be created automatically.');
        }
        
        console.log('\nDatabase check complete!');
        process.exit(0);
        
    } catch (err) {
        console.error('Error checking indexes:', err);
        process.exit(1);
    }
}

// Wait for database connection
setTimeout(() => {
    checkIndexes();
}, 2000);
