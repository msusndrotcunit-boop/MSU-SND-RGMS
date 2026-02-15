const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { upload } = require('../utils/cloudinary');

// In-memory settings store (ephemeral on server restarts)
let currentSettings = {
  email_alerts: true,
  push_notifications: true,
  activity_updates: true,
  dark_mode: false,
  compact_mode: false,
  primary_color: 'default',
  custom_bg: null
};

// Heartbeat: accepts GET or POST for flexibility
router.get('/heartbeat', (req, res) => {
  res.json({
    status: 'ok',
    method: 'GET',
    timestamp: Date.now()
  });
});

router.post('/heartbeat', (req, res) => {
  res.json({
    status: 'ok',
    method: 'POST',
    timestamp: Date.now()
  });
});

router.post('/login', (req, res) => {
  const token = process.env.API_TOKEN || 'dev-token';
  const role = process.env.DEFAULT_ROLE || 'admin';
  const username = (req.body && req.body.username) || 'admin';
  res.json({ token, user: { id: 1, role, username } });
});

// Read settings
router.get('/settings', authenticateToken, (req, res) => {
  res.json(currentSettings);
});

// Update settings
router.put('/settings', authenticateToken, (req, res) => {
  const {
    email_alerts,
    push_notifications,
    activity_updates,
    dark_mode,
    compact_mode,
    primary_color,
    custom_bg
  } = req.body || {};

  currentSettings = {
    ...currentSettings,
    ...(typeof email_alerts === 'boolean' ? { email_alerts } : {}),
    ...(typeof push_notifications === 'boolean' ? { push_notifications } : {}),
    ...(typeof activity_updates === 'boolean' ? { activity_updates } : {}),
    ...(typeof dark_mode === 'boolean' ? { dark_mode } : {}),
    ...(typeof compact_mode === 'boolean' ? { compact_mode } : {}),
    ...(primary_color ? { primary_color } : {}),
    ...(custom_bg !== undefined ? { custom_bg } : {})
  };

  res.json({ success: true, settings: currentSettings });
});

// Upload background image
router.post('/settings/background', authenticateToken, upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No image uploaded' });
    }
    // Cloudinary adapter returns path/url on req.file.path; local storage returns filename with disk path
    const url = req.file.path || (req.file.filename ? `/uploads/${req.file.filename}` : null);
    if (!url) {
      return res.status(500).json({ message: 'Upload failed' });
    }
    currentSettings.custom_bg = url;
    res.json({ success: true, url });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Upload error' });
  }
});

module.exports = router;
