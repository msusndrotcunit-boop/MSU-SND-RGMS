require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./database');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const cadetRoutes = require('./routes/cadet');
const attendanceRoutes = require('./routes/attendance');
const integrationRoutes = require('./routes/integration');

const app = express();
const PORT = process.env.PORT || 5000;

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

console.log('Starting ROTC Grading System Server V2.3.1 (Pinger Restored)...'); // Version bump for deployment trigger

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/cadet', cadetRoutes);
app.use('/api/attendance', attendanceRoutes);
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

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
