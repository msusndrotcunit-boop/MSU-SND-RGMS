require('dotenv').config({ override: true });
const dns = require('dns');

// Monkey-patch dns.lookup to force IPv4 globally
// This resolves 'connect ENETUNREACH' errors on IPv6-enabled networks
const originalLookup = dns.lookup;
dns.lookup = (hostname, options, callback) => {
    if (typeof options === 'function') {
        callback = options;
        options = {};
    }
    if (!options) options = {};
    options.family = 4; // Force IPv4
    return originalLookup(hostname, options, callback);
};

// Force IPv4 for DNS resolution (fallback)
if (dns.setDefaultResultOrder) {
    dns.setDefaultResultOrder('ipv4first');
}

// Force redeploy trigger
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./database');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const cadetRoutes = require('./routes/cadet');
const attendanceRoutes = require('./routes/attendance');
const excuseRoutes = require('./routes/excuse');
const staffRoutes = require('./routes/staff');
const integrationRoutes = require('./routes/integration');
const { processUrlImport } = require('./utils/importCadets');
const dbSettingsKey = 'cadet_list_source_url';

const app = express();
const PORT = process.env.PORT || 5000;

// Keep-Alive Mechanism for Render Free Tier & Supabase
// Pings the server every 14 minutes to prevent sleep
if (process.env.RENDER_EXTERNAL_URL) {
    const https = require('https');
    setInterval(() => {
        https.get(`${process.env.RENDER_EXTERNAL_URL}/api/health`, (resp) => {
            console.log('Self-ping successful');
        }).on('error', (err) => {
            console.error('Self-ping failed:', err.message);
        });
    }, 14 * 60 * 1000); // 14 minutes
}

console.log('Starting ROTC Grading System Server V2.3.16 (Supabase Keep-Alive)...'); // Version bump for deployment trigger

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health Check Route (Keeps Database Awake)
app.get('/api/health', (req, res) => {
    // Run a lightweight query to keep Supabase active
    db.get('SELECT 1', [], (err, row) => {
        if (err) {
            console.error('Health check DB error:', err.message);
            return res.status(500).send('Database Error');
        }
        res.send('OK');
    });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/cadet', cadetRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/excuse', excuseRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/integration', integrationRoutes);

// Create uploads directory if not exists
const fs = require('fs');
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir);
}

// Serve static files from client/dist (React Build) with caching
const clientBuildPath = path.join(__dirname, '../client/dist');
app.use(express.static(clientBuildPath, {
    maxAge: '1d', // Cache static assets for 1 day
    setHeaders: (res, path) => {
        if (path.endsWith('.html')) {
            // Never cache index.html so updates are seen immediately
            res.setHeader('Cache-Control', 'no-cache');
        } else {
            // Aggressively cache images, js, css
            res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year
        }
    }
}));

// Handle React Routing, return all requests to React app
app.get('*', (req, res) => {
    const indexPath = path.join(clientBuildPath, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        console.error(`Build not found at: ${indexPath}`);
        res.status(404).send('App is running, but the React build was not found. Please ensure "npm run build" ran successfully.');
    }
});

const enableAutoSync = process.env.ENABLE_CADET_AUTO_SYNC !== 'false';
const syncIntervalMinutes = parseInt(process.env.CADET_SYNC_INTERVAL_MINUTES || '10', 10);
if (enableAutoSync && syncIntervalMinutes > 0) {
    setInterval(() => {
        try {
            db.get(`SELECT value FROM system_settings WHERE key = ?`, [dbSettingsKey], async (err, row) => {
                if (err) return;
                if (!row || !row.value) return;
                try {
                    const result = await processUrlImport(row.value);
                    console.log(`Auto-sync cadets: success=${result.successCount} failed=${result.failCount}`);
                } catch (e) {
                    console.error('Auto-sync cadets error:', e.message);
                }
            });
        } catch (e) {}
    }, syncIntervalMinutes * 60 * 1000);
}

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
