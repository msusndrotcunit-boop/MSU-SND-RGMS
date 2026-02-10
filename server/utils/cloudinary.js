const cloudinary = require('cloudinary').v2;
const CloudinaryStorageModule = require('multer-storage-cloudinary');
const CloudinaryStorage = CloudinaryStorageModule.CloudinaryStorage || CloudinaryStorageModule;
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Check if Cloudinary credentials are provided (support both discrete keys and CLOUDINARY_URL)
const hasDiscreteKeys = process.env.CLOUDINARY_CLOUD_NAME && 
                        process.env.CLOUDINARY_API_KEY && 
                        process.env.CLOUDINARY_API_SECRET;
const hasUrl = !!process.env.CLOUDINARY_URL;
const isCloudinaryConfigured = hasDiscreteKeys || hasUrl;

let storage;

if (isCloudinaryConfigured) {
    // Configure Cloudinary
    if (hasUrl) {
        cloudinary.config({ cloudinary_url: process.env.CLOUDINARY_URL });
    } else {
        cloudinary.config({
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
            api_key: process.env.CLOUDINARY_API_KEY,
            api_secret: process.env.CLOUDINARY_API_SECRET
        });
    }

    const configuredName = cloudinary.config().cloud_name || '(hidden)';
    console.log(`[Upload] Cloudinary configured for cloud: ${configuredName}`);

    // Configure Storage
    storage = new CloudinaryStorage({
        cloudinary: cloudinary,
        params: async (req, file) => {
            const isImage = file.mimetype.startsWith('image/');
            return {
                folder: 'rotc-grading-system',
                allowed_formats: ['jpg', 'png', 'jpeg', 'gif', 'pdf', 'doc', 'docx'],
                resource_type: 'auto',
                transformation: isImage ? [{ width: 500, height: 500, crop: 'limit' }] : undefined
            };
        }
    });
} else {
    console.log('[Upload] Cloudinary not configured. Using local storage. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET or CLOUDINARY_URL to enable Cloudinary.');
    
    // Local Storage Fallback
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)){
        fs.mkdirSync(uploadDir, { recursive: true });
    }

    storage = multer.diskStorage({
        destination: function (req, file, cb) {
            cb(null, uploadDir);
        },
        filename: function (req, file, cb) {
            // Create unique filename
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            const ext = path.extname(file.originalname);
            cb(null, file.fieldname + '-' + uniqueSuffix + ext);
        }
    });
}

const upload = multer({ storage: storage });

module.exports = {
    cloudinary,
    upload,
    isCloudinaryConfigured
};
