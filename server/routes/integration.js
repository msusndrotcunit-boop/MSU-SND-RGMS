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
    // Duplicate detection by (student_id OR normalized name) + date (day)
    const normName = (n) => String(n || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const dupKey = (r) => {
      const idOrName = r.student_id ? String(r.student_id) : normName(r.name);
      const d = r.date ? r.date.toISOString().slice(0,10) : (new Date()).toISOString().slice(0,10);
      return `${idOrName}|${d}`;
    };
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
    // helpers for fuzzy name matching (PDFs often lack IDs)
    function levenshteinDistance(a, b) {
      if (a.length === 0) return b.length;
      if (b.length === 0) return a.length;
      const matrix = [];
      for (let i = 0; i <= b.length; i++) matrix[i] = [i];
      for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
      for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
          if (b.charAt(i - 1) === a.charAt(j - 1)) matrix[i][j] = matrix[i - 1][j - 1];
          else matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
        }
      }
      return matrix[b.length][a.length];
    }
    async function getAllCadets() {
      return new Promise((resolve, reject) => {
        db.all('SELECT id, first_name, last_name FROM cadets', [], (err, rows) => {
          if (err) return reject(err);
          resolve(rows || []);
        });
      });
    }
    function findCadetByNameFuzzy(name, cadets) {
      if (!name || !cadets || cadets.length === 0) return null;
      const target = String(name).toLowerCase();
      let best = null;
      let minD = Infinity;
      for (const c of cadets) {
        const options = [
          `${c.first_name} ${c.last_name}`,
          `${c.last_name} ${c.first_name}`,
          `${c.last_name}, ${c.first_name}`,
          `${c.first_name}, ${c.last_name}`,
        ].map(s => s.toLowerCase());
        const d = Math.min(...options.map(opt => levenshteinDistance(target, opt)));
        if (d < minD) { minD = d; best = c; }
      }
      // threshold relative to length
      if (minD <= 5 && minD < target.length * 0.4) return best;
      return null;
    }
    const cadetsCache = await getAllCadets();
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
        if (!r) { insertCount.skipped += 1; continue; }
        if (!r.status) { insertCount.skipped += 1; continue; }
        const dateObj = r.date ? new Date(r.date) : new Date();
        const dayId = await getOrCreateTrainingDay(dateObj);
        let cadetId = null;
        if (r.student_id) {
          cadetId = await getCadetIdByStudentId(String(r.student_id));
        }
        if (!cadetId && r.name) {
          const match = findCadetByNameFuzzy(r.name, cadetsCache);
          cadetId = match ? match.id : null;
        }
        if (!cadetId) { insertCount.skipped += 1; continue; }
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
