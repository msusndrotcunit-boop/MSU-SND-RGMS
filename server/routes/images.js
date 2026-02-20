const express = require('express');
const path = require('path');
const fs = require('fs');
const db = require('../database');
const router = express.Router();

router.get('/status', (req, res) => res.json({ status: 'ok' }));

function sendPlaceholder(res, label) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="220"><rect width="100%" height="100%" fill="#e5e7eb"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="14" fill="#6b7280">No ${label} Image</text></svg>`;
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(svg);
}

router.get('/cadets/:id', (req, res) => {
  const cadetId = Number(req.params.id);
  if (!cadetId || Number.isNaN(cadetId)) {
    return sendPlaceholder(res, 'Cadet');
  }

  db.get('SELECT profile_pic FROM cadets WHERE id = ?', [cadetId], (err, row) => {
    if (err) {
      return sendPlaceholder(res, 'Cadet');
    }
    const raw = row && row.profile_pic ? String(row.profile_pic) : '';
    if (!raw) {
      return sendPlaceholder(res, 'Cadet');
    }

    // Remote URL: redirect
    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.redirect(raw);
    }

    // Base64 data URL: decode and stream
    if (raw.startsWith('data:')) {
      const m = raw.match(/^data:(.*?);base64,(.*)$/);
      if (!m) return sendPlaceholder(res, 'Cadet');
      try {
        const mime = m[1] || 'image/png';
        const data = Buffer.from(m[2], 'base64');
        res.setHeader('Content-Type', mime);
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return res.end(data);
      } catch {
        return sendPlaceholder(res, 'Cadet');
      }
    }

    // Local path: normalize and send file
    let p = raw.replace(/\\/g, '/').replace(/\/+/g, '/');
    const idx = p.indexOf('/uploads/');
    if (idx !== -1) p = p.substring(idx); // keep from /uploads
    if (!p.startsWith('/')) p = '/' + p;
    const abs = path.join(__dirname, '..', p);
    if (!fs.existsSync(abs)) {
      return sendPlaceholder(res, 'Cadet');
    }
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.sendFile(abs);
  });
});

router.get('/staff/:id', (req, res) => {
  return sendPlaceholder(res, 'Staff');
});

router.get('/admin/:id', (req, res) => {
  const adminId = Number(req.params.id);
  if (!adminId || Number.isNaN(adminId)) {
    return sendPlaceholder(res, 'Admin');
  }

  db.get('SELECT profile_pic FROM users WHERE id = ? AND role = ?', [adminId, 'admin'], (err, row) => {
    if (err) {
      return sendPlaceholder(res, 'Admin');
    }
    const raw = row && row.profile_pic ? String(row.profile_pic) : '';
    if (!raw) {
      return sendPlaceholder(res, 'Admin');
    }

    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.redirect(raw);
    }

    if (raw.startsWith('data:')) {
      const m = raw.match(/^data:(.*?);base64,(.*)$/);
      if (!m) return sendPlaceholder(res, 'Admin');
      try {
        const mime = m[1] || 'image/png';
        const data = Buffer.from(m[2], 'base64');
        res.setHeader('Content-Type', mime);
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return res.end(data);
      } catch {
        return sendPlaceholder(res, 'Admin');
      }
    }

    let p = raw.replace(/\\/g, '/').replace(/\/+/g, '/');
    const idx = p.indexOf('/uploads/');
    if (idx !== -1) p = p.substring(idx);
    if (!p.startsWith('/')) p = '/' + p;
    const abs = path.join(__dirname, '..', p);
    if (!fs.existsSync(abs)) {
      return sendPlaceholder(res, 'Admin');
    }
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.sendFile(abs);
  });
});

module.exports = router;
