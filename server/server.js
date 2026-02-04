require('dotenv').config({ override: true });
// Force redeploy trigger: V2.4.6
const express = require('express');
const compression = require('compression');
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
const notificationRoutes = require('./routes/notifications');
const webpush = require('web-push');
const { processUrlImport } = require('./utils/importCadets');
const dbSettingsKey = 'cadet_list_source_url';

const app = express();
const PORT = process.env.PORT || 5000;

// Health Check Routes (Must be first to avoid shadowing by other routes) - Verified Fix
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

// Web Push Configuration
const publicVapidKey = process.env.VAPID_PUBLIC_KEY || 'BD2dXhUwhD5lQGW7ZJcuRji6ZyNeGo7T4VoX1DK2mCcsXs8ZpvYFM_t5KE2DyHAcVchDecw2kPpZZtNsL5BlgH8';
const privateVapidKey = process.env.VAPID_PRIVATE_KEY || 'K2XLvvSJF0h98grs0_2Aqw-4UTg89Euy01Z83eQLuD4';

webpush.setVapidDetails(
    'mailto:msusndrotcunit@gmail.com',
    publicVapidKey,
    privateVapidKey
);

// Keep-Alive Mechanism for Render Free Tier
// Pings the server every 14 minutes to prevent sleep
if (process.env.RENDER_EXTERNAL_URL) {
    const https = require('https');
    setInterval(() => {
        https.get(`${process.env.RENDER_EXTERNAL_URL}/api/auth/login`, (resp) => {
            console.log('Self-ping successful');
        }).on('error', (err) => {
            console.error('Self-ping failed:', err.message);
        });
    }, 14 * 60 * 1000); // 14 minutes
}

console.log('Starting ROTC Grading System Server V2.4.3 (Non-Blocking Init)...'); // Version bump for deployment trigger

// Global Error Handlers to prevent crash loops
process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION:', err);
    // Keep running if possible, but logging is crucial
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('UNHANDLED REJECTION:', reason);
});

// Middleware
app.use(compression());
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/cadet', cadetRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/excuse', excuseRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/integration', integrationRoutes);
app.use('/api/notifications', notificationRoutes);

// Create uploads directory if not exists
const fs = require('fs');
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir);
}

// Serve static files from client/dist (React Build) with caching
const clientBuildPath = path.join(__dirname, '../client/dist');
console.log(`[Startup] Looking for client build at: ${clientBuildPath}`);

// DEBUG: Check file system on startup
if (fs.existsSync(clientBuildPath)) {
    console.log(`[Startup] Client build directory FOUND.`);
    try {
        const contents = fs.readdirSync(clientBuildPath);
        console.log(`[Startup] Client build directory contents: ${contents.join(', ')}`);
    } catch (e) {
        console.error(`[Startup] Failed to list client build directory: ${e.message}`);
    }
} else {
    console.error(`[Startup] Client build directory NOT FOUND at ${clientBuildPath}`);
    // Check if client directory exists at all
    const clientPath = path.join(__dirname, '../client');
    if (fs.existsSync(clientPath)) {
        try {
            console.log(`[Startup] ../client directory exists. Contents: ${fs.readdirSync(clientPath).join(', ')}`);
        } catch (e) {
             console.log(`[Startup] ../client directory exists but cannot list.`);
        }
    } else {
        console.log(`[Startup] ../client directory NOT FOUND.`);
    }
}

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

// DEBUG ROUTE
app.get('/debug-deployment', (req, res) => {
    const info = {
        cwd: process.cwd(),
        dirname: __dirname,
        clientBuildPath,
        buildExists: fs.existsSync(clientBuildPath),
        rootContents: fs.existsSync(path.join(__dirname, '..')) ? fs.readdirSync(path.join(__dirname, '..')) : 'parent dir not found',
        clientContents: fs.existsSync(path.join(__dirname, '../client')) ? fs.readdirSync(path.join(__dirname, '../client')) : 'client dir not found',
        distContents: fs.existsSync(clientBuildPath) ? fs.readdirSync(clientBuildPath) : 'dist dir not found'
    };
    res.json(info);
});

app.get('/', (req, res) => {
    const indexPath = path.join(clientBuildPath, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(200).send('OK - Server Running (Client Build Not Found)');
    }
});

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

const startServer = async () => {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
        
        // Initialize DB *after* server starts to prevent Render timeout
        if (db.initialize) {
            console.log('Initializing database in background...');
            db.initialize()
                .then(() => console.log('Database initialized successfully.'))
                .catch(err => console.error('Database initialization failed (NON-FATAL):', err));
        }
    });
};

startServer();
