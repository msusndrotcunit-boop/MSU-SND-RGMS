require('dotenv').config({ override: true });
// Force redeploy trigger: V2.4.9 (SPA Routing Fix)
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

// LOGGING MIDDLEWARE
app.use((req, res, next) => {
    console.log(`[Request] ${req.method} ${req.url}`);
    next();
});

// Health Check Routes
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

// Keep-Alive Mechanism
if (process.env.RENDER_EXTERNAL_URL) {
    const https = require('https');
    setInterval(() => {
        https.get(`${process.env.RENDER_EXTERNAL_URL}/api/auth/login`, (resp) => {
            // console.log('Self-ping successful');
        }).on('error', (err) => {
            console.error('Self-ping failed:', err.message);
        });
    }, 14 * 60 * 1000); // 14 minutes
}

console.log('Starting ROTC Grading System Server V2.4.9 (SPA Fix)...'); 

// Global Error Handlers
process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION:', err);
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
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir);
}

// DETERMINING CLIENT BUILD PATH DYNAMICALLY
// Try multiple common locations
const possibleBuildPaths = [
    path.join(__dirname, '../client/dist'),
    path.join(__dirname, 'client/dist'),
    path.join(process.cwd(), 'client/dist'),
    path.join(process.cwd(), '../client/dist')
];

let clientBuildPath = possibleBuildPaths[0];
let foundBuild = false;

for (const p of possibleBuildPaths) {
    if (fs.existsSync(p) && fs.existsSync(path.join(p, 'index.html'))) {
        clientBuildPath = p;
        foundBuild = true;
        console.log(`[Startup] Found React build at: ${clientBuildPath}`);
        break;
    }
}

if (!foundBuild) {
    console.error('[Startup] WARNING: Could not find React build directory in common locations.');
    console.error(`[Startup] Checked: ${possibleBuildPaths.join(', ')}`);
}

// Serve static files
app.use(express.static(clientBuildPath, {
    maxAge: '1d',
    setHeaders: (res, path) => {
        if (path.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache');
        } else {
            res.setHeader('Cache-Control', 'public, max-age=31536000');
        }
    }
}));

// DEBUG ROUTE
app.get('/debug-deployment', (req, res) => {
    const info = {
        cwd: process.cwd(),
        dirname: __dirname,
        selectedBuildPath: clientBuildPath,
        foundBuild,
        possiblePaths: possibleBuildPaths,
        buildContents: foundBuild ? fs.readdirSync(clientBuildPath) : 'N/A'
    };
    res.json(info);
});

// SPA FALLBACK HANDLER - ROBUST VERSION
// Explicitly handle index.html serving for ANY unmatched route
const serveIndex = (req, res) => {
    const indexPath = path.join(clientBuildPath, 'index.html');
    
    // Explicitly set content type to avoid confusion
    res.setHeader('Content-Type', 'text/html');

    res.sendFile(indexPath, (err) => {
        if (err) {
            console.error(`[SPA Fallback] Error serving index.html: ${err.message}`);
            if (!res.headersSent) {
                res.status(500).send(`
                    <h1>Server Error</h1>
                    <p>Failed to serve the application.</p>
                    <p>Error details: ${err.message}</p>
                    <p>Build Path: ${clientBuildPath}</p>
                `);
            }
        }
    });
};

app.get('/', serveIndex);
app.get('/login', serveIndex); // Explicit login route
app.get('/dashboard', serveIndex); // Explicit dashboard route
app.get('*', serveIndex); // Catch-all

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
        
        // Initialize DB *after* server starts
        if (db.initialize) {
            console.log('Initializing database in background...');
            db.initialize()
                .then(() => console.log('Database initialized successfully.'))
                .catch(err => console.error('Database initialization failed (NON-FATAL):', err));
        }
    });
};

startServer();
