require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./database');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const cadetRoutes = require('./routes/cadet');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/cadet', cadetRoutes);

// Create uploads directory if not exists
const fs = require('fs');
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir);
}

// Serve static files from client/dist (React Build)
const clientBuildPath = path.join(__dirname, '../client/dist');
app.use(express.static(clientBuildPath));

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
