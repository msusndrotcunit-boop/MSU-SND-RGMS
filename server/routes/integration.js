const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../database');
const { authenticateToken, isAdmin } = require('../middleware/auth');
const { parseFileAsync, summarize } = require('../utils/rotcmisParser');
const ExcelJS = require('exceljs');

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

function normalizeHeader(h) {
  return String(h || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

async function parseGeneric(buffer, filename) {
  const ext = (filename || '').toLowerCase();
  if (ext.endsWith('.json')) {
    try {
      const j = JSON.parse(buffer.toString('utf8'));
      return Array.isArray(j) ? j : (j.rows || j.data || []);
    } catch { return []; }
  }
  if (ext.endsWith('.xlsx') || ext.endsWith('.xls')) {
    try {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer);
      const ws = wb.worksheets[0];
      if (!ws) return [];
      const rows = [];
      let headers = [];
      ws.eachRow((row, rowNumber) => {
        const cells = row.values.slice(1); // drop first empty
        if (rowNumber === 1) {
          headers = cells.map(normalizeHeader);
        } else {
          const obj = {};
          headers.forEach((h, i) => obj[h] = cells[i] != null ? String(cells[i]).trim() : '');
          rows.push(obj);
        }
      });
      return rows;
    } catch { return []; }
  }
  // default CSV
  const text = buffer.toString('utf8');
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return [];
  const headers = lines[0].split(',').map(normalizeHeader);
  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',');
    const r = {};
    headers.forEach((h, idx) => r[h] = (parts[idx] || '').trim());
    out.push(r);
  }
  return out;
}

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

// ---------- Bulk Import: Examination Scores ----------
router.post('/grades/validate', authenticateToken, isAdmin, upload.array('files', 5), async (req, res) => {
  try {
    const files = req.files || [];
    if (files.length === 0) return res.status(400).json({ message: 'No files uploaded' });
    let rows = [];
    for (const f of files) {
      const r = await parseGeneric(f.buffer, f.originalname);
      rows = rows.concat(r);
    }
    const mapped = rows.map((r) => {
      const keys = Object.keys(r).reduce((m, k) => { m[normalizeHeader(k)] = r[k]; return m; }, {});
      // id fields
      const studentId = keys.student_id || keys.sid || keys.id || '';
      const email = keys.email || '';
      const username = keys.username || '';
      const first = keys.first_name || keys.firstname || keys.fname || '';
      const last = keys.last_name || keys.lastname || keys.lname || '';
      // scores
      const prelim = keys.prelim || keys.prelim_score || keys.prelims || '';
      const midterm = keys.midterm || keys.midterm_score || keys.midterms || '';
      const final = keys.final || keys.final_score || keys.finals || '';
      const attendance = keys.attendance_present || keys.present || '';
      const status = keys.status || keys.grade_status || '';
      return { studentId, email, username, first, last, prelim, midterm, final, attendance, status };
    });
    const total = mapped.length;
    const valid = mapped.filter(m => (m.studentId || m.email || (m.first && m.last)) && (m.prelim || m.midterm || m.final)).length;
    res.json({ total, valid, preview: mapped.slice(0, 20) });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.post('/grades/import', authenticateToken, isAdmin, upload.array('files', 5), async (req, res) => {
  try {
    const files = req.files || [];
    if (files.length === 0) return res.status(400).json({ message: 'No files uploaded' });
    let rows = [];
    for (const f of files) rows = rows.concat(await parseGeneric(f.buffer, f.originalname));

    function toNum(v) { const n = Number(String(v).trim()); return Number.isFinite(n) ? n : null; }
    const norm = (s) => String(s || '').trim();
    const cadets = await new Promise((resolve) => {
      db.all(`SELECT id, student_id, email, username, first_name, last_name FROM cadets 
              LEFT JOIN users ON users.cadet_id = cadets.id AND users.role='cadet'`, [], (e, rows) => resolve(rows || []));
    });
    function findCadet(r) {
      const keys = Object.keys(r).reduce((m, k) => { m[normalizeHeader(k)] = r[k]; return m; }, {});
      const sid = norm(keys.student_id || keys.sid || keys.id);
      const email = norm(keys.email);
      const username = norm(keys.username);
      const first = norm(keys.first_name || keys.firstname || keys.fname);
      const last = norm(keys.last_name || keys.lastname || keys.lname);
      let c = null;
      if (sid) c = cadets.find(x => String(x.student_id) === sid) || null;
      if (!c && email) c = cadets.find(x => (x.email || '').toLowerCase() === email.toLowerCase()) || null;
      if (!c && username) c = cadets.find(x => (x.username || '').toLowerCase() === username.toLowerCase()) || null;
      if (!c && first && last) {
        const fl = `${first.toLowerCase()} ${last.toLowerCase()}`;
        c = cadets.find(x => (`${(x.first_name||'').toLowerCase()} ${(x.last_name||'').toLowerCase()}`) === fl) || null;
      }
      return c;
    }
    let updated = 0, skipped = 0;
    for (const r of rows) {
      const c = findCadet(r);
      if (!c) { skipped++; continue; }
      const keys = Object.keys(r).reduce((m, k) => { m[normalizeHeader(k)] = r[k]; return m; }, {});
      const prelim = toNum(keys.prelim || keys.prelim_score || keys.prelims);
      const midterm = toNum(keys.midterm || keys.midterm_score || keys.midterms);
      const final = toNum(keys.final || keys.final_score || keys.finals);
      const attendance = toNum(keys.attendance_present || keys.present);
      const status = norm(keys.status || keys.grade_status) || 'active';
      const vals = {
        prelimScore: prelim == null ? null : Math.max(0, Math.min(100, prelim)),
        midtermScore: midterm == null ? null : Math.max(0, Math.min(100, midterm)),
        finalScore: final == null ? null : Math.max(0, Math.min(100, final)),
        attendancePresent: attendance == null ? null : Math.max(0, attendance),
        status
      };
      await new Promise((resolve) => {
        db.get(`SELECT id, merit_points, demerit_points FROM grades WHERE cadet_id = ?`, [c.id], (e, row) => {
          const mp = row ? row.merit_points : 0;
          const dp = row ? row.demerit_points : 0;
          const a = vals.attendancePresent != null ? vals.attendancePresent : (row ? row.attendance_present : 0);
          db.run(
            `INSERT INTO grades (cadet_id, attendance_present, merit_points, demerit_points, prelim_score, midterm_score, final_score, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT (cadet_id) DO UPDATE SET
               attendance_present = COALESCE(excluded.attendance_present, grades.attendance_present),
               prelim_score = COALESCE(excluded.prelim_score, grades.prelim_score),
               midterm_score = COALESCE(excluded.midterm_score, grades.midterm_score),
               final_score = COALESCE(excluded.final_score, grades.final_score),
               status = COALESCE(excluded.status, grades.status)`,
            [c.id, a, mp, dp, vals.prelimScore, vals.midtermScore, vals.finalScore, vals.status],
            () => {
              updated++;
              resolve();
            }
          );
        });
      });
      try { require('../utils/gradesHelper').updateTotalAttendance && await require('../utils/gradesHelper').updateTotalAttendance(c.id); } catch {}
      try { require('../utils/sseHelper').broadcastEvent({ type: 'grade_updated', cadetId: c.id }); } catch {}
    }
    res.json({ message: 'Grades import completed', updated, skipped });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ---------- Bulk Import: Merit/Demerit Ledger ----------
router.post('/ledger/validate', authenticateToken, isAdmin, upload.array('files', 5), async (req, res) => {
  try {
    const files = req.files || [];
    if (files.length === 0) return res.status(400).json({ message: 'No files uploaded' });
    let rows = [];
    for (const f of files) rows = rows.concat(await parseGeneric(f.buffer, f.originalname));
    const mapped = rows.map((r) => {
      const k = Object.keys(r).reduce((m, x) => { m[normalizeHeader(x)] = r[x]; return m; }, {});
      const studentId = k.student_id || k.sid || k.id || '';
      const email = k.email || '';
      const username = k.username || '';
      const first = k.first_name || k.firstname || k.fname || '';
      const last = k.last_name || k.lastname || k.lname || '';
      const type = (k.type || k.record_type || '').toLowerCase();
      const points = Number(String(k.points || k.score || 0));
      const reason = k.reason || k.remarks || k.note || '';
      return { studentId, email, username, first, last, type, points, reason };
    });
    const valid = mapped.filter(m => (m.studentId || m.email || (m.first && m.last)) && (m.type === 'merit' || m.type === 'demerit') && Number.isFinite(m.points) && m.points !== 0).length;
    res.json({ total: mapped.length, valid, preview: mapped.slice(0, 20) });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.post('/ledger/import', authenticateToken, isAdmin, upload.array('files', 5), async (req, res) => {
  try {
    const files = req.files || [];
    if (files.length === 0) return res.status(400).json({ message: 'No files uploaded' });
    let rows = [];
    for (const f of files) rows = rows.concat(await parseGeneric(f.buffer, f.originalname));

    const norm = (s) => String(s || '').trim();
    const toNum = (v) => Number(String(v || '0').trim());
    const cadets = await new Promise((resolve) => {
      db.all(`SELECT cadets.id, cadets.student_id, cadets.email, users.username, cadets.first_name, cadets.last_name
              FROM cadets LEFT JOIN users ON users.cadet_id = cadets.id AND users.role='cadet'`, [], (e, rows) => resolve(rows || []));
    });
    function findCadet(r) {
      const k = Object.keys(r).reduce((m, x) => { m[normalizeHeader(x)] = r[x]; return m; }, {});
      const sid = norm(k.student_id || k.sid || k.id);
      const email = norm(k.email);
      const username = norm(k.username);
      const first = norm(k.first_name || k.firstname || k.fname);
      const last = norm(k.last_name || k.lastname || k.lname);
      let c = null;
      if (sid) c = cadets.find(x => String(x.student_id) === sid) || null;
      if (!c && email) c = cadets.find(x => (x.email || '').toLowerCase() === email.toLowerCase()) || null;
      if (!c && username) c = cadets.find(x => (x.username || '').toLowerCase() === username.toLowerCase()) || null;
      if (!c && first && last) {
        const fl = `${first.toLowerCase()} ${last.toLowerCase()}`;
        c = cadets.find(x => (`${(x.first_name||'').toLowerCase()} ${(x.last_name||'').toLowerCase()}`) === fl) || null;
      }
      return c;
    }
    let inserted = 0, updatedGrades = 0, skipped = 0;
    for (const r of rows) {
      const c = findCadet(r);
      if (!c) { skipped++; continue; }
      const k = Object.keys(r).reduce((m, x) => { m[normalizeHeader(x)] = r[x]; return m; }, {});
      const type = (k.type || k.record_type || '').toLowerCase();
      const points = toNum(k.points || k.score);
      if (!points || (type !== 'merit' && type !== 'demerit')) { skipped++; continue; }
      const reason = k.reason || k.remarks || k.note || (type === 'merit' ? 'Imported Merit' : 'Imported Demerit');
      await new Promise((resolve) => {
        db.run(
          `INSERT INTO merit_demerit_logs (cadet_id, type, points, reason) VALUES (?, ?, ?, ?)`,
          [c.id, type, points, reason],
          () => { inserted++; resolve(); }
        );
      });
      await new Promise((resolve) => {
        const col = type === 'merit' ? 'merit_points' : 'demerit_points';
        const lifetime = type === 'merit' ? ', lifetime_merit_points = COALESCE(lifetime_merit_points,0) + ?' : '';
        const params = type === 'merit' ? [points, points, c.id] : [points, c.id];
        db.run(
          `UPDATE grades SET ${col} = COALESCE(${col},0) + ? ${lifetime} WHERE cadet_id = ?`,
          params,
          () => { updatedGrades++; resolve(); }
        );
      });
      try { require('../utils/sseHelper').broadcastEvent({ type: 'grade_updated', cadetId: c.id }); } catch {}
    }
    res.json({ message: 'Ledger import completed', inserted, updatedGrades, skipped });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;
