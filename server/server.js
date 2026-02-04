require('dotenv').config({ override: true });
// Force redeploy trigger: V2.7.0 (Auto-Build Fix)
const express = require('express');
const compression = require('compression');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
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

console.log('[Startup] Initializing Server...');

const app = express();
// CRITICAL: Render sets PORT env var. Must use it. Default to 10000 if missing.
const PORT = parseInt(process.env.PORT) || 5000;
console.log(`[Startup] Configured to listen on port: ${PORT}`);

// LOGGING MIDDLEWARE
app.use((req, res, next) => {
    console.log(`[Request] ${req.method} ${req.url}`);
    next();
});

// Health Check Routes - FIRST defined route
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

// Detailed API Health Check
app.get('/api/health', (req, res) => {
    // Check DB connection
    const isPostgres = !!process.env.DATABASE_URL;
    let dbStatus = 'unknown';
    
    if (isPostgres && db.pool) {
        // Postgres check
        db.pool.query('SELECT 1', (err) => {
            if (err) {
                console.error('Health check DB error:', err);
                res.json({ status: 'ok', db: 'disconnected', type: 'postgres', timestamp: Date.now() });
            } else {
                res.json({ status: 'ok', db: 'connected', type: 'postgres', timestamp: Date.now() });
            }
        });
    } else {
        // SQLite check (always connected if file is open)
        res.json({ status: 'ok', db: 'connected', type: 'sqlite', timestamp: Date.now() });
    }
});

// Web Push Configuration
const publicVapidKey = process.env.VAPID_PUBLIC_KEY || 'BD2dXhUwhD5lQGW7ZJcuRji6ZyNeGo7T4VoX1DK2mCcsXs8ZpvYFM_t5KE2DyHAcVchDecw2kPpZZtNsL5BlgH8';
const privateVapidKey = process.env.VAPID_PRIVATE_KEY || 'K2XLvvSJF0h98grs0_2Aqw-4UTg89Euy01Z83eQLuD4';

try {
    webpush.setVapidDetails(
        'mailto:msusndrotcunit@gmail.com',
        publicVapidKey,
        privateVapidKey
    );
} catch (err) {
    console.error('[Startup] WebPush config warning:', err.message);
}

// Global Error Handlers
process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION:', err);
    process.exit(1); // Exit to allow restart
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('UNHANDLED REJECTION:', reason);
    process.exit(1); // Exit to allow restart
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
    console.error('[Startup] WARNING: Could not find React build directory. The app will serve a fallback page.');
} else {
    // Serve static files ONLY if found
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
}

// DEBUG ROUTE
app.get('/debug-deployment', (req, res) => {
    res.json({
        port: PORT,
        cwd: process.cwd(),
        dirname: __dirname,
        selectedBuildPath: clientBuildPath,
        foundBuild,
        envPort: process.env.PORT
    });
});

// SPA FALLBACK HANDLER
const serveIndex = (req, res) => {
    // SECURITY: Prevent API 404s from returning HTML
    if (req.path.startsWith('/api')) {
        return res.status(404).send('API endpoint not found');
    }

    if (!foundBuild) {
        // Fallback HTML if build is missing
        res.status(200).send(`
            <html>
                <head><title>System Initializing</title></head>
                <body style="font-family: sans-serif; text-align: center; padding: 50px;">
                    <h1>System Update in Progress</h1>
                    <p>The application is currently rebuilding its frontend assets.</p>
                    <p>Please refresh this page in 1-2 minutes.</p>
                    <hr>
                    <p style="color: gray; font-size: 0.8em;">Debug info: Client build not found at startup.</p>
                </body>
            </html>
        `);
        return;
    }

    const indexPath = path.join(clientBuildPath, 'index.html');
    res.setHeader('Content-Type', 'text/html');
    res.sendFile(indexPath, (err) => {
        if (err) {
            console.error(`[SPA Fallback] Error serving index.html: ${err.message}`);
            if (!res.headersSent) {
                 res.status(500).send('Server Error: Client build file missing.');
            }
        }
    });
};

app.get('/', serveIndex);
app.get('/login', serveIndex);
app.get('/dashboard', serveIndex);
app.get('*', serveIndex);

// START SERVER IMMEDIATELY
// Bind to 0.0.0.0 to ensure external access in container
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server successfully started on port ${PORT}`);
    console.log(`http://0.0.0.0:${PORT}`);
    
    // Initialize DB *after* server is listening
    if (db.initialize) {
        console.log('Initializing database in background...');
        db.initialize()
            .then(() => console.log('Database initialized successfully.'))
            .catch(err => console.error('Database initialization failed:', err));
    }
});

// Timeout safeguard
server.setTimeout(30000); // 30s timeout

// Graceful Shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    server.close(() => {
        console.log('HTTP server closed.');
        if (db.pool) {
            db.pool.end(() => {
                console.log('Database connection pool closed.');
                process.exit(0);
            });
        } else if (db.close) {
            db.close(() => {
                console.log('SQLite database connection closed.');
                process.exit(0);
            });
        } else {
            process.exit(0);
        }
    });
});
