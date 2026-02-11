const db = require('../database');
const { broadcastEvent } = require('./sseHelper');

function calculateTransmutedGrade(finalGrade, status) {
    if (status && ['DO', 'INC', 'T'].includes(status)) {
        return { transmutedGrade: status, remarks: 'Failed' };
    }
    let transmutedGrade = 5.00;
    let remarks = 'Failed';
    if (finalGrade >= 98) { transmutedGrade = 1.00; remarks = 'Passed'; }
    else if (finalGrade >= 95) { transmutedGrade = 1.25; remarks = 'Passed'; }
    else if (finalGrade >= 92) { transmutedGrade = 1.50; remarks = 'Passed'; }
    else if (finalGrade >= 89) { transmutedGrade = 1.75; remarks = 'Passed'; }
    else if (finalGrade >= 86) { transmutedGrade = 2.00; remarks = 'Passed'; }
    else if (finalGrade >= 83) { transmutedGrade = 2.25; remarks = 'Passed'; }
    else if (finalGrade >= 80) { transmutedGrade = 2.50; remarks = 'Passed'; }
    else if (finalGrade >= 77) { transmutedGrade = 2.75; remarks = 'Passed'; }
    else if (finalGrade >= 75) { transmutedGrade = 3.00; remarks = 'Passed'; }
    return { transmutedGrade: typeof transmutedGrade === 'number' ? transmutedGrade.toFixed(2) : transmutedGrade, remarks };
}

/**
 * Helper to update total attendance count in grades table
 * @param {number|string} cadetId 
 * @returns {Promise<number>} The new attendance count
 */
function updateTotalAttendance(cadetId) {
    return new Promise((resolve, reject) => {
        const cId = Number(cadetId);
        if (isNaN(cId)) {
            console.error(`Invalid cadetId for attendance update: ${cadetId}`);
            return resolve(0);
        }

        // Count 'present' and 'excused' records
        // Use database agnostic COUNT and parse in JS
        db.get(`SELECT COUNT(*) as count FROM attendance_records WHERE cadet_id = ? AND lower(status) IN ('present', 'excused')`, [cId], (err, row) => {
            if (err) {
                console.error(`Error counting attendance for cadet ${cId}:`, err);
                return reject(err);
            }
            
            const count = row && (row.count !== undefined) ? Number(row.count) : 0;
            console.log(`Updating attendance count for cadet ${cId}: ${count}`);
            
            // Update grades table using ON CONFLICT for PostgreSQL or standard logic for SQLite
            const updateSql = `
                INSERT INTO grades (cadet_id, attendance_present) 
                VALUES (?, ?) 
                ON CONFLICT (cadet_id) 
                DO UPDATE SET attendance_present = EXCLUDED.attendance_present
            `;

            db.run(updateSql, [cId, count], function(err) {
                if (err) {
                    // If ON CONFLICT fails (e.g. SQLite), fallback to manual check
                    db.run('UPDATE grades SET attendance_present = ? WHERE cadet_id = ?', [count, cId], function(err2) {
                        if (err2) {
                            console.error(`Error updating grades for cadet ${cId}:`, err2);
                            return reject(err2);
                        }
                        if (this.changes === 0) {
                            db.run('INSERT INTO grades (cadet_id, attendance_present) VALUES (?, ?)', [cId, count], (err3) => {
                                if (err3) {
                                    console.error(`Error creating grade record for cadet ${cId}:`, err3);
                                    reject(err3);
                                } else {
                                    broadcastEvent({ type: 'grade_updated', cadetId: cId });
                                    resolve(count);
                                }
                            });
                        } else {
                            broadcastEvent({ type: 'grade_updated', cadetId: cId });
                            resolve(count);
                        }
                    });
                } else {
                    console.log(`Successfully synced grades for cadet ${cId} with count ${count}`);
                    broadcastEvent({ type: 'grade_updated', cadetId: cId });
                    resolve(count);
                }
            });
        });
    });
}

module.exports = {
    updateTotalAttendance,
    calculateTransmutedGrade
};
