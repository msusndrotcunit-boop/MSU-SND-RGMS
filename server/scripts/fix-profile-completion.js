/**
 * Fix Profile Completion Status
 * 
 * This script ensures that all verified cadets and staff have is_profile_completed = 1
 * Run this script to fix any accounts that are verified but still showing as incomplete
 * 
 * Usage: node scripts/fix-profile-completion.js
 */

const db = require('../database');

async function fixCadetProfiles() {
    return new Promise((resolve, reject) => {
        // Update all cadets with status='Verified' to have is_profile_completed=1
        const sql = `
            UPDATE cadets 
            SET is_profile_completed = 1 
            WHERE status = 'Verified' 
            AND (is_profile_completed IS NULL OR is_profile_completed = 0 OR is_profile_completed = FALSE)
        `;
        
        db.run(sql, [], function(err) {
            if (err) {
                console.error('Error updating cadet profiles:', err);
                reject(err);
            } else {
                console.log(`✓ Fixed ${this.changes} cadet profile(s)`);
                resolve(this.changes);
            }
        });
    });
}

async function fixStaffProfiles() {
    return new Promise((resolve, reject) => {
        // Update all staff who have completed their profile info
        // (have first_name, last_name, email, and contact_number)
        const sql = `
            UPDATE training_staff 
            SET is_profile_completed = 1 
            WHERE first_name IS NOT NULL 
            AND last_name IS NOT NULL 
            AND email IS NOT NULL 
            AND contact_number IS NOT NULL
            AND (is_profile_completed IS NULL OR is_profile_completed = 0 OR is_profile_completed = FALSE)
        `;
        
        db.run(sql, [], function(err) {
            if (err) {
                console.error('Error updating staff profiles:', err);
                reject(err);
            } else {
                console.log(`✓ Fixed ${this.changes} staff profile(s)`);
                resolve(this.changes);
            }
        });
    });
}

async function verifyFix() {
    return new Promise((resolve, reject) => {
        console.log('\n--- Verification ---');
        
        // Check cadets
        db.get(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN is_profile_completed = 1 THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN status = 'Verified' THEN 1 ELSE 0 END) as verified
            FROM cadets
            WHERE is_archived = 0 OR is_archived IS NULL
        `, [], (err, cadetStats) => {
            if (err) {
                reject(err);
                return;
            }
            
            console.log('\nCadet Accounts:');
            console.log(`  Total: ${cadetStats.total}`);
            console.log(`  Verified: ${cadetStats.verified}`);
            console.log(`  Profile Completed: ${cadetStats.completed}`);
            
            // Check staff
            db.get(`
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN is_profile_completed = 1 THEN 1 ELSE 0 END) as completed
                FROM training_staff
                WHERE is_archived = 0 OR is_archived IS NULL
            `, [], (err2, staffStats) => {
                if (err2) {
                    reject(err2);
                    return;
                }
                
                console.log('\nStaff Accounts:');
                console.log(`  Total: ${staffStats.total}`);
                console.log(`  Profile Completed: ${staffStats.completed}`);
                
                resolve({ cadetStats, staffStats });
            });
        });
    });
}

async function main() {
    console.log('=== Profile Completion Fix Script ===\n');
    
    try {
        // Fix cadet profiles
        console.log('Fixing cadet profiles...');
        await fixCadetProfiles();
        
        // Fix staff profiles
        console.log('\nFixing staff profiles...');
        await fixStaffProfiles();
        
        // Verify the fix
        await verifyFix();
        
        console.log('\n✓ Profile completion fix completed successfully!');
        console.log('\nNote: Users may need to log out and log back in for changes to take effect.');
        
        process.exit(0);
    } catch (error) {
        console.error('\n✗ Error during fix:', error);
        process.exit(1);
    }
}

// Run the script
main();
