const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../database');
const { authenticateToken, isAdmin } = require('../middleware/auth');
const { parseFileAsync, summarize } = require('../utils/rotcmisParser');

const router = express.Router();

// Simple rotating log writer
function writeImportLog(message) {
  const dir = path.join(__dirname, '..', 'logs');
  try { if (!fs.existsSync(dir)) fs.mkdirSync(dir); } catch {}
  const file = path.join(dir, 'rotcmis-import.log');
  const line = `[${new Date().toISOString()}] ${message}\n`;
  try { fs.appendFileSync(file, line); } catch {}
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 } // 15MB per file
});

router.get('/status', (req, res) => res.json({ status: 'ok' }));

// Parse and validate ROTCMIS export (dry-run supported)
router.post('/rotcmis/validate', authenticateToken, isAdmin, upload.array('files', 10), async (req, res) => {
  try {
    const files = req.files || [];
    if (files.length === 0) return res.status(400).json({ message: 'No files uploaded' });
    let all = [];
    for (const f of files) {
      const recs = await parseFileAsync(f.buffer, f.originalname);
      all = all.concat(recs);
    }
    // Duplicate detection by student_id + date (day)
    const dupKey = (r) => `${r.student_id || '_'}|${r.date ? r.date.toISOString().slice(0,10) : '_'}`;
    const counts = all.reduce((m, r) => { const k = dupKey(r); m[k] = (m[k] || 0) + 1; return m; }, {});
    const withDupFlag = all.map(r => ({ ...r, isDuplicateInBatch: counts[dupKey(r)] > 1 }));
    const summary = summarize(withDupFlag);
    res.json({ records: withDupFlag, summary });
  } catch (err) {
    writeImportLog(`VALIDATE_ERROR: ${err.message}`);
    res.status(500).json({ message: 'Validation error', error: err.message });
  }
});

// Confirm and import records
router.post('/rotcmis/import', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { records, strategy } = req.body || {};
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ message: 'No records to import' });
    }
    const insertCount = { inserted: 0, updated: 0, skipped: 0, errors: 0 };
    // strategy: 'skip-duplicates' | 'overwrite'
    const mode = strategy === 'overwrite' ? 'overwrite' : 'skip-duplicates';

    // helper: get or create training_day by date (date-only)
    async function getOrCreateTrainingDay(date) {
      return new Promise((resolve, reject) => {
        const dateOnly = date.toISOString().slice(0,10);
        db.get('SELECT id FROM training_days WHERE date = ?', [dateOnly], (err, row) => {
          if (err) return reject(err);
          if (row) return resolve(row.id);
          db.run('INSERT INTO training_days (date, title, description) VALUES (?, ?, ?)',
            [dateOnly, `Training ${dateOnly}`, 'Imported from ROTCMIS'],
            function(e) {
              if (e) return reject(e);
              resolve(this.lastID);
            });
        });
      });
    }
    // helper: find cadet by student_id
    async function getCadetIdByStudentId(studentId) {
      return new Promise((resolve, reject) => {
        db.get('SELECT id FROM cadets WHERE student_id = ?', [studentId], (err, row) => {
          if (err) return reject(err);
          resolve(row ? row.id : null);
        });
      });
    }
    // helper: upsert attendance
    async function upsertAttendance(dayId, cadetId, status) {
      return new Promise((resolve, reject) => {
        db.get('SELECT id FROM attendance_records WHERE training_day_id = ? AND cadet_id = ?', [dayId, cadetId], (err, row) => {
          if (err) return reject(err);
          if (row) {
            if (mode === 'overwrite') {
              db.run('UPDATE attendance_records SET status = ? WHERE id = ?', [status, row.id], (e) => {
                if (e) return reject(e);
                insertCount.updated += 1;
                resolve('updated');
              });
            } else {
              insertCount.skipped += 1;
              resolve('skipped');
            }
          } else {
            db.run('INSERT INTO attendance_records (training_day_id, cadet_id, status) VALUES (?, ?, ?)', [dayId, cadetId, status], (e) => {
              if (e) return reject(e);
              insertCount.inserted += 1;
              resolve('inserted');
            });
          }
        });
      });
    }

    for (const r of records) {
      try {
        if (!r || r.errors?.length) { insertCount.skipped += 1; continue; }
        if (!r.student_id || !r.date || !r.status) { insertCount.skipped += 1; continue; }
        const cadetId = await getCadetIdByStudentId(String(r.student_id));
        if (!cadetId) { insertCount.skipped += 1; continue; }
        const dayId = await getOrCreateTrainingDay(new Date(r.date));
        await upsertAttendance(dayId, cadetId, r.status);
      } catch (e) {
        insertCount.errors += 1;
        writeImportLog(`IMPORT_RECORD_ERROR: ${e.message}`);
      }
    }
    writeImportLog(`IMPORT_SUMMARY: ${JSON.stringify(insertCount)}`);
    res.json({ message: 'Import completed', result: insertCount });
  } catch (err) {
    writeImportLog(`IMPORT_ERROR: ${err.message}`);
    res.status(500).json({ message: 'Import error', error: err.message });
  }
});

module.exports = router;
