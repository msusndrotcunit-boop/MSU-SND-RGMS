const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Configure Cloudinary
// These should be set in your .env file
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure Storage
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'rotc-grading-system', // Folder name in Cloudinary
        allowed_formats: ['jpg', 'png', 'jpeg', 'gif'],
        transformation: [{ width: 500, height: 500, crop: 'limit' }] // Resize large images
    }
});

const upload = multer({ storage: storage });

module.exports = {
    cloudinary,
    upload
};
