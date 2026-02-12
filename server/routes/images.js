const express = require('express');
const db = require('../database');
const fs = require('fs');
const path = require('path');
const router = express.Router();

// Helper to serve default placeholder
const sendDefaultPlaceholder = (res) => {
    const defaultSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" fill="#F3F4F6"/><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
    
    if (!res.headersSent) {
        res.writeHead(200, {
            'Content-Type': 'image/svg+xml',
            'Content-Length': Buffer.byteLength(defaultSvg),
            'Cache-Control': 'public, max-age=3600'
        });
        res.end(defaultSvg);
    }
};

// Helper to serve Base64 image
const serveBase64Image = (res, imageSource, usePlaceholderOnFailure = false) => {
    if (!imageSource) {
        if (usePlaceholderOnFailure) return sendDefaultPlaceholder(res);
        return res.status(404).send('Image not found');
    }

    // Normalize potential Windows/backslash paths and relative uploads
    let src = String(imageSource);
    src = src.replace(/\\/g, '/');
    if (!src.startsWith('http') && !src.startsWith('data:')) {
        if (src.includes('uploads') && !src.startsWith('/uploads/')) {
            const parts = src.split('uploads');
            src = '/uploads/' + parts.pop().replace(/^\/+/, '');
        }
    }

    console.log(`[serveBase64Image] Processing: ${src.substring(0, 50)}${src.length > 50 ? '...' : ''}`);

    // If it's a Cloudinary URL (or any URL), redirect to it
    if (src.startsWith('http')) {
        return res.redirect(src);
    }
    
    // If it's a local path (from disk storage)
    if (src.startsWith('/uploads/')) {
        // Check if file exists on disk
        const fullPath = path.join(__dirname, '..', src);
        if (fs.existsSync(fullPath)) {
            const protocol = res.req.protocol || 'https';
            const host = res.req.get('host');
            if (host) {
                return res.redirect(`${protocol}://${host}${src}`);
            }
            return res.redirect(src);
        } else {
            console.log(`[serveBase64Image] Local file not found: ${fullPath}`);
            if (usePlaceholderOnFailure) return sendDefaultPlaceholder(res);
            return res.status(404).send('Local image file missing on server');
        }
    }

    if (!src.startsWith('data:image')) {
        if (usePlaceholderOnFailure) return sendDefaultPlaceholder(res);
        return res.status(404).send('Image not found or invalid format');
    }

    const matches = src.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
        if (usePlaceholderOnFailure) return sendDefaultPlaceholder(res);
        return res.status(500).send('Invalid image data');
    }

    const type = matches[1];
    const buffer = Buffer.from(matches[2], 'base64');

    res.writeHead(200, {
        'Content-Type': type,
        'Content-Length': buffer.length,
        'Cache-Control': 'public, max-age=86400' // Cache for 1 day
    });
    res.end(buffer);
};

// Get Activity Image (Legacy/Main)
router.get('/activities/:id', (req, res) => {
    db.get('SELECT image_path FROM activities WHERE id = ?', [req.params.id], (err, row) => {
        if (err) return res.status(500).send(err.message);
        if (!row || !row.image_path) return res.status(404).send('Image not found');
        serveBase64Image(res, row.image_path);
    });
});

// Get Specific Activity Image (Gallery)
router.get('/activity-images/:id', (req, res) => {
    db.get('SELECT image_path FROM activity_images WHERE id = ?', [req.params.id], (err, row) => {
        if (err) return res.status(500).send(err.message);
        if (!row || !row.image_path) return res.status(404).send('Image not found');
        serveBase64Image(res, row.image_path);
    });
});

// Get Cadet Profile Picture
router.get('/cadets/:id', (req, res) => {
    // Check 'cadets' table first
    db.get('SELECT profile_pic FROM cadets WHERE id = ?', [req.params.id], (err, row) => {
        if (err) {
            console.error('[images] DB error for cadet:', err);
            return sendDefaultPlaceholder(res);
        }
        
        if (row && row.profile_pic) {
            return serveBase64Image(res, row.profile_pic, true);
        }

        // Return a default SVG placeholder if no pic found
        sendDefaultPlaceholder(res);
    });
});

// Get Staff Profile Picture
router.get('/staff/:id', (req, res) => {
    db.get('SELECT profile_pic FROM training_staff WHERE id = ?', [req.params.id], (err, row) => {
        if (err) return res.status(500).send(err.message);
        if (!row || !row.profile_pic) return res.status(404).send('Image not found');
        serveBase64Image(res, row.profile_pic);
    });
});

module.exports = router;
