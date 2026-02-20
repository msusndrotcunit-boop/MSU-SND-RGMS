const express = require('express');
const router = express.Router();
const db = require('../database');
const bcrypt = require('bcryptjs');
const { authenticateToken, setSession, clearSession } = require('../middleware/auth');
const { upload } = require('../utils/cloudinary');
const dayjs = require('dayjs');

// User-specific settings helpers
const defaultSettings = () => ({
  email_alerts: true,
  push_notifications: true,
  activity_updates: true,
  dark_mode: false,
  compact_mode: false,
  primary_color: 'default',
  custom_bg: null
});
function upsertUserSettings(userId, payload, cb) {
  const sqlUpdate = `
    UPDATE user_settings
    SET email_alerts = COALESCE(?, email_alerts),
        push_notifications = COALESCE(?, push_notifications),
        activity_updates = COALESCE(?, activity_updates),
        dark_mode = COALESCE(?, dark_mode),
        compact_mode = COALESCE(?, compact_mode),
        primary_color = COALESCE(?, primary_color),
        custom_bg = COALESCE(?, custom_bg)
    WHERE user_id = ?
  `;
  const params = [
    payload.email_alerts, payload.push_notifications, payload.activity_updates,
    payload.dark_mode, payload.compact_mode, payload.primary_color, payload.custom_bg, userId
  ];
  db.run(sqlUpdate, params, function(err) {
    if (err) return cb(err);
    if (this && this.changes > 0) return cb(null);
    const d = { ...defaultSettings(), ...payload };
    const sqlInsert = `
      INSERT INTO user_settings (user_id, email_alerts, push_notifications, activity_updates, dark_mode, compact_mode, primary_color, custom_bg)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    db.run(sqlInsert, [
      userId, d.email_alerts, d.push_notifications, d.activity_updates, d.dark_mode, d.compact_mode, d.primary_color, d.custom_bg
    ], (e) => cb(e));
  });
}

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

// Save user location (used by WeatherAdvisory)
router.post('/location', authenticateToken, (req, res) => {
  try {
    const { latitude, longitude, accuracy, provider } = req.body || {};
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return res.status(400).json({ message: 'latitude and longitude are required numbers' });
    }
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    const ts = dayjs().toISOString();
    const sql = `
      UPDATE users
      SET last_latitude = ?, last_longitude = ?, last_location_at = ?, last_location_accuracy = ?, last_location_provider = ?
      WHERE id = ?
    `;
    db.run(sql, [latitude, longitude, ts, accuracy || null, provider || 'gps', userId], function (err) {
      if (err) return res.status(500).json({ message: err.message });
      if (this.changes === 0) return res.status(404).json({ message: 'User not found' });
      res.json({ ok: true, latitude, longitude, at: ts });
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// Read last saved user location
router.get('/location', authenticateToken, (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  const sql = `
    SELECT last_latitude as latitude, last_longitude as longitude, last_location_at as at, last_location_accuracy as accuracy, last_location_provider as provider
    FROM users
    WHERE id = ?
  `;
  db.get(sql, [userId], (err, row) => {
    if (err) return res.status(500).json({ message: err.message });
    res.json(row || {});
  });
});

// Admin login with database verification
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }
  
  db.get('SELECT * FROM users WHERE username = ? AND role = ?', [username, 'admin'], async (err, user) => {
    if (err) {
      return res.status(500).json({ message: 'Database error' });
    }
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    const token = process.env.API_TOKEN || 'dev-token';
    
    // Store session
    setSession(token, {
      id: user.id,
      role: 'admin',
      cadetId: null,
      staffId: null
    });
    
    res.json({
      token,
      role: 'admin',
      cadetId: null,
      staffId: null,
      isProfileCompleted: true,
      username: user.username,
      userId: user.id
    });
  });
});

// Cadet login using identifier (student ID / email / username)
router.post('/cadet-login', async (req, res) => {
  const { identifier, password } = req.body;
  
  if (!identifier) {
    return res.status(400).json({ message: 'Identifier is required' });
  }
  
  // Query for user by username, email, or student_id
  const sql = `
    SELECT u.*, c.is_profile_completed, c.student_id 
    FROM users u 
    LEFT JOIN cadets c ON u.cadet_id = c.id 
    WHERE (u.username = ? OR u.email = ? OR c.student_id = ?) 
    AND u.role = 'cadet'
    LIMIT 1
  `;
  
  db.get(sql, [identifier, identifier, identifier], async (err, user) => {
    if (err) {
      console.error('[Cadet Login] Database error:', err);
      return res.status(500).json({ message: 'Database error' });
    }
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    // If password is provided and user has a password, verify it
    if (password && user.password) {
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }
    }
    
    // Ensure user is linked to a cadet if possible
    try {
      if (!user.cadet_id) {
        const linkRow = await new Promise((resolve) => {
          db.get(
            `SELECT id FROM cadets WHERE student_id = ? OR email = ? LIMIT 1`,
            [user.username || identifier, user.email || identifier],
            (e, r) => resolve(r)
          );
        });
        if (linkRow && linkRow.id) {
          await new Promise((resolve) => {
            db.run(`UPDATE users SET cadet_id = ? WHERE id = ?`, [linkRow.id, user.id], () => resolve());
          });
          user.cadet_id = linkRow.id;
          db.run(
            `INSERT INTO sync_events (event_type, payload) VALUES (?, json(?))`,
            ['login_autolink_cadet', JSON.stringify({ userId: user.id, cadetId: linkRow.id })]
          );
        }
      }
    } catch (e) {
      console.warn('[Cadet Login] Autolink attempt failed:', e.message);
    }

    // Re-fetch profile completion if cadet_id exists
    let isCompleted = !!user.is_profile_completed;
    if (user.cadet_id) {
      const comp = await new Promise((resolve) => {
        db.get(`SELECT is_profile_completed FROM cadets WHERE id = ?`, [user.cadet_id], (e, r) => resolve(r));
      });
      if (comp && (comp.is_profile_completed === 1 || comp.is_profile_completed === true || comp.is_profile_completed === '1')) {
        isCompleted = true;
      }
    }

    const token = process.env.API_TOKEN || 'dev-token';
    setSession(token, { id: user.id, role: 'cadet', cadetId: user.cadet_id || null, staffId: null });
    res.json({
      token,
      role: 'cadet',
      cadetId: user.cadet_id || null,
      staffId: null,
      isProfileCompleted: isCompleted,
      identifier: user.username,
      userId: user.id
    });
  });
});

// Staff login using identifier (username / email)
router.post('/staff-login-no-pass', async (req, res) => {
  const { identifier, password } = req.body;
  
  if (!identifier) {
    return res.status(400).json({ message: 'Identifier is required' });
  }
  
  const sql = `
    SELECT u.*, s.id as staff_id 
    FROM users u 
    LEFT JOIN training_staff s ON u.staff_id = s.id 
    WHERE (u.username = ? OR u.email = ?) 
    AND u.role = 'training_staff'
    LIMIT 1
  `;
  
  db.get(sql, [identifier, identifier], async (err, user) => {
    if (err) {
      console.error('[Staff Login] Database error:', err);
      return res.status(500).json({ message: 'Database error' });
    }
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    // If password is provided and user has a password, verify it
    if (password && user.password) {
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }
    }
    
    const token = process.env.API_TOKEN || 'dev-token';
    
    // Store session
    setSession(token, {
      id: user.id,
      role: 'training_staff',
      cadetId: null,
      staffId: user.staff_id
    });
    
    res.json({
      token,
      role: 'training_staff',
      cadetId: null,
      staffId: user.staff_id,
      isProfileCompleted: true,
      identifier: user.username,
      userId: user.id
    });
  });
});

// Logout endpoint
router.post('/logout', authenticateToken, (req, res) => {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : auth;
  clearSession(token);
  res.json({ message: 'Logged out successfully' });
});

// Read settings (user-specific)
router.get('/settings', authenticateToken, (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  db.get(`SELECT email_alerts, push_notifications, activity_updates, dark_mode, compact_mode, primary_color, custom_bg 
          FROM user_settings WHERE user_id = ?`, [userId], (err, row) => {
    if (err) return res.status(500).json({ message: err.message });
    if (!row) {
      upsertUserSettings(userId, defaultSettings(), (e) => {
        if (e) return res.status(500).json({ message: e.message });
        res.json(defaultSettings());
      });
      return;
    }
    res.json(row);
  });
});

// Update settings (user-specific)
router.put('/settings', authenticateToken, (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  const {
    email_alerts,
    push_notifications,
    activity_updates,
    dark_mode,
    compact_mode,
    primary_color,
    custom_bg
  } = req.body || {};

  const payload = {
    email_alerts: typeof email_alerts === 'boolean' ? email_alerts : undefined,
    push_notifications: typeof push_notifications === 'boolean' ? push_notifications : undefined,
    activity_updates: typeof activity_updates === 'boolean' ? activity_updates : undefined,
    dark_mode: typeof dark_mode === 'boolean' ? dark_mode : undefined,
    compact_mode: typeof compact_mode === 'boolean' ? compact_mode : undefined,
    primary_color: primary_color || undefined,
    custom_bg: custom_bg !== undefined ? custom_bg : undefined
  };
  upsertUserSettings(userId, payload, (err) => {
    if (err) return res.status(500).json({ message: err.message });
    db.get(`SELECT email_alerts, push_notifications, activity_updates, dark_mode, compact_mode, primary_color, custom_bg 
            FROM user_settings WHERE user_id = ?`, [userId], (gErr, row) => {
      if (gErr) return res.status(500).json({ message: gErr.message });
      res.json({ success: true, settings: row || defaultSettings() });
    });
  });
});

// Upload background image (user-specific)
router.post('/settings/background', authenticateToken, upload.single('image'), (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });
    if (!req.file) {
      return res.status(400).json({ message: 'No image uploaded' });
    }
    // Cloudinary adapter returns path/url on req.file.path; local storage returns filename with disk path
    const url = req.file.path || (req.file.filename ? `/uploads/${req.file.filename}` : null);
    if (!url) {
      return res.status(500).json({ message: 'Upload failed' });
    }
    upsertUserSettings(userId, { custom_bg: url }, (e) => {
      if (e) return res.status(500).json({ message: e.message });
      res.json({ success: true, url });
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Upload error' });
  }
});

module.exports = router;
