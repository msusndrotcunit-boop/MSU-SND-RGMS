const express = require('express');
const { upload, isCloudinaryConfigured } = require('../utils/cloudinary');
const db = require('../database');
const { authenticateToken, isAdminOrPrivilegedStaff } = require('../middleware/auth');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Ensure table exists (works for SQLite and Postgres)
const ensureTable = () => {
  const sql = db.pool
    ? `
      CREATE TABLE IF NOT EXISTS excuse_letters (
        id SERIAL PRIMARY KEY,
        cadet_id INTEGER,
        date_absent DATE,
        reason TEXT,
        file_url TEXT,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
    : `
      CREATE TABLE IF NOT EXISTS excuse_letters (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cadet_id INTEGER,
        date_absent TEXT,
        reason TEXT,
        file_url TEXT,
        status TEXT DEFAULT 'pending',
        created_at TEXT DEFAULT (datetime('now'))
      )`;
  db.run(sql, [], (err) => {
    if (err) console.error('[excuse] ensureTable error:', err.message);
  });
};
ensureTable();

router.get('/status', (req, res) => res.json({ status: 'ok' }));

router.use(authenticateToken);

// List excuse letters
router.get('/', (req, res) => {
  // Cadet sees their own; admin/staff see all with join
  const isStaff = req.user && (req.user.role === 'admin' || req.user.role === 'training_staff');
  const isCadet = req.user && req.user.role === 'cadet';
  if (isCadet && req.user.cadetId) {
    const sql = `SELECT id, cadet_id, date_absent, reason, file_url, status, created_at
                 FROM excuse_letters
                 WHERE cadet_id = ?
                 ORDER BY created_at DESC`;
    db.all(sql, [req.user.cadetId], (err, rows) => {
      if (err) return res.status(500).json({ message: err.message });
      res.json(rows || []);
    });
  } else if (isStaff) {
    const sql = `
      SELECT e.id, e.cadet_id, e.date_absent, e.reason, e.file_url, e.status, e.created_at,
             c.first_name, c.last_name
      FROM excuse_letters e
      LEFT JOIN cadets c ON c.id = e.cadet_id
      ORDER BY e.created_at DESC
      LIMIT 500
    `;
    db.all(sql, [], (err, rows) => {
      if (err) return res.status(500).json({ message: err.message });
      res.json(rows || []);
    });
  } else {
    res.json([]);
  }
});

// Submit new excuse letter (cadet)
router.post('/', upload.single('file'), (req, res) => {
  if (!req.user || !req.user.cadetId) {
    return res.status(403).json({ message: 'Cadet access required' });
  }
  const { date_absent, reason } = req.body || {};
  if (!date_absent || !reason) {
    return res.status(400).json({ message: 'date_absent and reason are required' });
  }
  if (!req.file) {
    return res.status(400).json({ message: 'File is required' });
  }
  // Normalize path: Cloudinary gives URL; local storage gives filesystem path
  let fileUrl = req.file.path;
  if (fileUrl && fileUrl.includes('uploads') && !fileUrl.startsWith('http')) {
    const parts = fileUrl.split(/[\\/]/);
    const idx = parts.indexOf('uploads');
    if (idx !== -1) {
      fileUrl = '/' + parts.slice(idx).join('/');
    }
  }
  const sql = db.pool
    ? `INSERT INTO excuse_letters (cadet_id, date_absent, reason, file_url, status) 
       VALUES ($1, $2, $3, $4, 'pending') RETURNING id`
    : `INSERT INTO excuse_letters (cadet_id, date_absent, reason, file_url, status) 
       VALUES (?, ?, ?, ?, 'pending')`;
  const params = db.pool
    ? [req.user.cadetId, date_absent, reason, fileUrl]
    : [req.user.cadetId, date_absent, reason, fileUrl];
  if (db.pool) {
    db.pool.query(sql, params, (err, result) => {
      if (err) return res.status(500).json({ message: err.message });
      const id = result.rows?.[0]?.id;
      res.json({ id, message: 'Excuse letter submitted' });
    });
  } else {
    db.run(sql, params, function(err) {
      if (err) return res.status(500).json({ message: err.message });
      res.json({ id: this.lastID, message: 'Excuse letter submitted' });
    });
  }
});

// Update status (staff/admin)
router.put('/:id', isAdminOrPrivilegedStaff, (req, res) => {
  const { status } = req.body || {};
  if (!['approved', 'rejected', 'pending'].includes(String(status || '').toLowerCase())) {
    return res.status(400).json({ message: 'Invalid status' });
  }
  const newStatus = String(status).toLowerCase();
  const sql = `UPDATE excuse_letters SET status = ? WHERE id = ?`;
  db.run(sql, [newStatus, req.params.id], function(err) {
    if (err) return res.status(500).json({ message: err.message });
    if (this.changes === 0) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'Status updated' });
  });
});

// Delete letter (staff/admin)
router.delete('/:id', isAdminOrPrivilegedStaff, (req, res) => {
  // Optionally delete local file if not cloud URL
  db.get('SELECT file_url FROM excuse_letters WHERE id = ?', [req.params.id], (selErr, row) => {
    if (selErr) return res.status(500).json({ message: selErr.message });
    const fileUrl = row?.file_url || '';
    db.run('DELETE FROM excuse_letters WHERE id = ?', [req.params.id], function(err) {
      if (err) return res.status(500).json({ message: err.message });
      if (fileUrl && !fileUrl.startsWith('http') && fileUrl.includes('/uploads/')) {
        const localPath = path.join(__dirname, '..', fileUrl);
        fs.unlink(localPath, () => {});
      }
      res.json({ message: 'Deleted' });
    });
  });
});

module.exports = router;
