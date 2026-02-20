const db = require('../database');

async function updateTotalAttendance(cadetId) {
  return new Promise((resolve) => {
    // Count all non-absent attendance records as present-equivalents
    const countSql = `
      SELECT COUNT(*) AS present_count
      FROM attendance_records
      WHERE cadet_id = ?
        AND (status = 'present' OR status = 'late' OR status = 'excused')
    `;
    db.get(countSql, [cadetId], (err, row) => {
      if (err) {
        console.error('updateTotalAttendance error (count):', err.message);
        return resolve(false);
      }
      const present = (row && row.present_count) ? Number(row.present_count) : 0;
      // Ensure grades row exists, then update attendance_present
      const ensureSql = `INSERT INTO grades (cadet_id, attendance_present, merit_points, demerit_points, prelim_score, midterm_score, final_score, status)
                         VALUES (?, 0, 0, 0, 0, 0, 0, 'active')
                         ON CONFLICT(cadet_id) DO NOTHING`;
      db.run(ensureSql, [cadetId], function(_) {
        const updateSql = `UPDATE grades SET attendance_present = ? WHERE cadet_id = ?`;
        db.run(updateSql, [present, cadetId], function(updErr) {
          if (updErr) {
            console.error('updateTotalAttendance error (update):', updErr.message);
            return resolve(false);
          }
          resolve(true);
        });
      });
    });
  });
}

function calculateTransmutedGrade(finalGrade, status) {
  const special = (status || '').toUpperCase();
  if (special === 'INC') return { transmutedGrade: null, gradeLetter: null, remarks: 'Incomplete' };
  if (special === 'DO')  return { transmutedGrade: null, gradeLetter: null, remarks: 'Dropped' };
  if (special === 'T')   return { transmutedGrade: null, gradeLetter: null, remarks: 'Deferred' };

  const g = Math.max(0, Math.min(100, Number(finalGrade || 0)));
  let transmuted;
  let gradeLetter;
  if (g >= 95) {
    transmuted = 1.00; gradeLetter = 'A';
  } else if (g >= 90) {
    transmuted = 1.50; gradeLetter = 'A';
  } else if (g >= 85) {
    transmuted = 2.00; gradeLetter = 'B';
  } else if (g >= 80) {
    transmuted = 2.50; gradeLetter = 'B';
  } else if (g >= 75) {
    transmuted = 3.00; gradeLetter = 'C';
  } else {
    transmuted = 5.00; gradeLetter = 'Failure';
  }
  const remarks = transmuted === 5.00 ? 'Failed' : 'Passed';
  return { transmutedGrade: transmuted, gradeLetter, remarks };
}

module.exports = { updateTotalAttendance, calculateTransmutedGrade };
