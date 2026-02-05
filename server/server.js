require('dotenv').config({ override: true });
// Force redeploy trigger: V2.8.1 (Render Startup Fix)
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
const imageRoutes = require('./routes/images');
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
    // Fix: Support both DATABASE_URL and SUPABASE_URL
    const isPostgres = !!process.env.DATABASE_URL || !!process.env.SUPABASE_URL;
    
    if (db.pool) {
        // Postgres check
        db.pool.query('SELECT 1', (err) => {
            if (err) {
                console.error('Health check DB error:', err);
                res.json({ status: 'ok', db: 'disconnected', type: 'postgres', timestamp: Date.now(), error: err.message });
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
app.use('/api/images', imageRoutes);

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
    // List files in current dir and client build dir
    let clientFiles = [];
    try {
        if (foundBuild) {
            clientFiles = fs.readdirSync(clientBuildPath);
        }
    } catch (e) {
        clientFiles = [`Error: ${e.message}`];
    }

    res.json({
        port: PORT,
        cwd: process.cwd(),
        dirname: __dirname,
        selectedBuildPath: clientBuildPath,
        foundBuild,
        envPort: process.env.PORT,
        clientFiles: clientFiles
    });
});

// SPA FALLBACK HANDLER
const serveIndex = (req, res) => {
    // SECURITY: Prevent API 404s from returning HTML
    if (req.path.startsWith('/api')) {
        console.log(`[SPA Fallback] 404 for API path: ${req.path}`);
        return res.status(404).json({ message: `API endpoint not found: ${req.path}` });
    }

    if (!foundBuild) {
        // Fallback HTML if build is missing
        console.warn(`[SPA Fallback] Build not found for path: ${req.path}`);
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
    
    // Check if index.html actually exists before trying to send it
    if (!fs.existsSync(indexPath)) {
        console.error(`[SPA Fallback] index.html missing at: ${indexPath}`);
        return res.status(500).send('Server Error: index.html is missing despite build directory existing.');
    }

    res.setHeader('Content-Type', 'text/html');
    res.sendFile(indexPath, (err) => {
        if (err) {
            console.error(`[SPA Fallback] Error serving index.html: ${err.message}`);
            if (!res.headersSent) {
                 res.status(500).send('Server Error: Could not serve client build file.');
            }
        }
    });
};

app.get('/', serveIndex);
app.get('/login', serveIndex);
app.get('/dashboard', serveIndex);
app.get('*', serveIndex);

// Final 404 handler for safety (should never be reached if * matches)
app.use((req, res) => {
    console.error(`[Server] Unhandled 404: ${req.method} ${req.url}`);
    res.status(404).send(`Server Error: Route not found (${req.url}). Please contact support.`);
});

// START SERVER
async function startServer() {
    // Bind to 0.0.0.0 to ensure external access in container
    // MOVED UP: Listen first to satisfy Render's startup timeout requirements
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server successfully started on port ${PORT}`);
    });

    // Initialize Database (Migrations & Tables)
    if (db.initialize) {
        console.log('[Startup] Triggering database initialization...');
        try {
            await db.initialize();
            console.log('[Startup] Database initialization completed successfully.');
        } catch (err) {
            console.error('[Startup] CRITICAL: Database initialization failed:', err);
            // Continue anyway? Or exit?
            // If DB init fails, API will likely fail.
            // But let's keep it running so we can see logs/health check error.
        }
    }
}

startServer();
