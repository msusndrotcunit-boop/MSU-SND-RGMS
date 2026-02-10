const dns = require('dns');
// Force IPv4 to avoid ENETUNREACH on some networks
if (dns.setDefaultResultOrder) {
    dns.setDefaultResultOrder('ipv4first');
}

require('dotenv').config({ override: true });
// Force redeploy trigger: V2.8.1 (Render Startup Fix)
const express = require('express');
const compression = require('compression');
const cors = require('cors');
const axios = require('axios'); // Added for Keep-Alive self-ping
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
const messageRoutes = require('./routes/messages');
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
    
    if (db.pool && isPostgres) {
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

app.get('/api/cloudinary/status', (req, res) => {
    const mod = require('./utils/cloudinary');
    const cfg = mod.cloudinary.config();
    const source = process.env.CLOUDINARY_URL ? 'url' : (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET ? 'keys' : 'none');
    res.json({ configured: !!mod.isCloudinaryConfigured, cloud_name: cfg.cloud_name || null, source });
});

// Host-based Redirect (Old domain -> New domain)
const REDIRECT_ENABLED = (process.env.REDIRECT_ENABLED || 'true').toLowerCase() === 'true';
const REDIRECT_FROM_HOSTS = (process.env.REDIRECT_FROM_HOSTS || 'msu-snd-rgms.onrender.com')
    .split(',')
    .map(h => h.trim().toLowerCase())
    .filter(Boolean);
const REDIRECT_TARGET_HOST = process.env.REDIRECT_TARGET_HOST || 'msu-snd-rgms-jcsg.onrender.com';

app.use((req, res, next) => {
    if (!REDIRECT_ENABLED) return next();
    if (req.path === '/health') return next();
    const host = ((req.headers['x-forwarded-host'] || req.headers.host || '') + '').toLowerCase();
    if (REDIRECT_FROM_HOSTS.includes(host)) {
        const proto = (req.headers['x-forwarded-proto'] || 'https') + '';
        const target = `${proto}://${REDIRECT_TARGET_HOST}${req.originalUrl}`;
        return res.redirect(308, target);
    }
    next();
});

// DEBUG: Env & Path Info (Safe subset)
app.get('/api/debug-info', (req, res) => {
    res.json({
        node_env: process.env.NODE_ENV,
        port: PORT,
        cwd: process.cwd(),
        dirname: __dirname,
        client_build_path: clientBuildPath,
        found_build: foundBuild,
        routes_mounted: {
            auth: true,
            admin: true
        }
    });
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
    // Do not exit; keep the process alive to avoid Render restart loops
    // Optionally set a non-zero exit code if the process ever exits
    if (!process.exitCode) process.exitCode = 1;
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('UNHANDLED REJECTION:', reason);
    if (!process.exitCode) process.exitCode = 1;
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
app.use('/api/messages', messageRoutes);
app.use('/api/images', imageRoutes);

// DEBUG: Print all registered routes
function printRoutes() {
    console.log('\n[Router] Registered Routes:');
    app._router.stack.forEach((middleware) => {
        if (middleware.route) { // routes registered directly on the app
            console.log(`[Router] ${Object.keys(middleware.route.methods).join(', ').toUpperCase()} ${middleware.route.path}`);
        } else if (middleware.name === 'router') { // router middleware 
            middleware.handle.stack.forEach((handler) => {
                if (handler.route) {
                    const method = Object.keys(handler.route.methods).join(', ').toUpperCase();
                    // This is a bit hacky to get the prefix, but sufficient for debug
                    let prefix = '';
                    if (middleware.regexp.toString().includes('api/auth')) prefix = '/api/auth';
                    else if (middleware.regexp.toString().includes('api/admin')) prefix = '/api/admin';
                    else if (middleware.regexp.toString().includes('api/cadet')) prefix = '/api/cadet';
                    else if (middleware.regexp.toString().includes('api/attendance')) prefix = '/api/attendance';
                    else if (middleware.regexp.toString().includes('api/excuse')) prefix = '/api/excuse';
                    else if (middleware.regexp.toString().includes('api/staff')) prefix = '/api/staff';
                    else if (middleware.regexp.toString().includes('api/integration')) prefix = '/api/integration';
                    else if (middleware.regexp.toString().includes('api/notifications')) prefix = '/api/notifications';
                    else if (middleware.regexp.toString().includes('api/images')) prefix = '/api/images';
                    
                    console.log(`[Router] ${method} ${prefix}${handler.route.path}`);
                }
            });
        }
    });
    console.log('[Router] End of Routes\n');
}
setTimeout(printRoutes, 1000); // Print after brief delay to ensure mounting


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

// DEBUG: List all routes
app.get('/debug-routes', (req, res) => {
    const routes = [];
    app._router.stack.forEach((middleware) => {
        if (middleware.route) { // routes registered directly on the app
            routes.push(`${Object.keys(middleware.route.methods).join(', ').toUpperCase()} ${middleware.route.path}`);
        } else if (middleware.name === 'router') { // router middleware 
            middleware.handle.stack.forEach((handler) => {
                if (handler.route) {
                    const method = Object.keys(handler.route.methods).join(', ').toUpperCase();
                    let prefix = '';
                    if (middleware.regexp.toString().includes('api/auth')) prefix = '/api/auth';
                    else if (middleware.regexp.toString().includes('api/admin')) prefix = '/api/admin';
                    else if (middleware.regexp.toString().includes('api/cadet')) prefix = '/api/cadet';
                    else if (middleware.regexp.toString().includes('api/attendance')) prefix = '/api/attendance';
                    else if (middleware.regexp.toString().includes('api/excuse')) prefix = '/api/excuse';
                    else if (middleware.regexp.toString().includes('api/staff')) prefix = '/api/staff';
                    else if (middleware.regexp.toString().includes('api/integration')) prefix = '/api/integration';
                    else if (middleware.regexp.toString().includes('api/notifications')) prefix = '/api/notifications';
                    else if (middleware.regexp.toString().includes('api/images')) prefix = '/api/images';
                    
                    routes.push(`${method} ${prefix}${handler.route.path}`);
                }
            });
        }
    });
    res.json(routes);
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
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ message: `API Route not found: ${req.method} ${req.url}` });
    }
    res.status(404).send(`Server Error: Route not found (${req.url}). Please contact support.`);
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('[Server] Global Error:', err);
    if (res.headersSent) {
        return next(err);
    }
    res.status(500).json({ 
        message: 'Internal Server Error', 
        error: process.env.NODE_ENV === 'development' ? err.message : undefined 
    });
});

// --- RENDER FREE TIER SELF-PING KEEP-ALIVE ---
// Pings the server periodically to prevent inactivity spin-down
const KEEP_ALIVE_INTERVAL = 5 * 60 * 1000; // 5 minutes
const TARGET_URL = process.env.RENDER_EXTERNAL_URL || 'https://msu-snd-rgms-jcsg.onrender.com';

function startKeepAlive() {
    console.log(`[KeepAlive] Service configured to ping ${TARGET_URL} every ${KEEP_ALIVE_INTERVAL / 60000} minutes.`);
    
    // Initial ping after 1 minute to verify connectivity
    setTimeout(() => {
        performPing();
        // Start periodic pings
        setInterval(performPing, KEEP_ALIVE_INTERVAL);
    }, 60000);
}

function performPing() {
    console.log(`[KeepAlive] Pinging ${TARGET_URL}/health to prevent sleep...`);
    axios.get(`${TARGET_URL}/health`)
        .then(res => console.log(`[KeepAlive] Ping successful. Status: ${res.status}`))
        .catch(err => {
            console.error(`[KeepAlive] Ping failed: ${err.message}`);
            // If external ping fails, try localhost as fallback to keep event loop active? 
            // Render might still kill it if no external traffic.
        });
}

// START SERVER
async function startServer() {
    // Bind to 0.0.0.0 to ensure external access in container
    // MOVED UP: Listen first to satisfy Render's startup timeout requirements
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server successfully started on port ${PORT}`);
        
        // Start self-ping service only in production or if explicitly enabled
        // We enable it by default here since the user requested to prevent sleep
        startKeepAlive();
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
