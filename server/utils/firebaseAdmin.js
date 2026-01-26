const admin = require('firebase-admin');
const dotenv = require('dotenv');

dotenv.config();

// Check if Firebase credentials are provided
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        console.log("Firebase Admin Initialized");
    } catch (error) {
        console.error("Error parsing FIREBASE_SERVICE_ACCOUNT:", error);
    }
} else {
    console.warn("FIREBASE_SERVICE_ACCOUNT not provided. Firebase features will be disabled.");
}

module.exports = admin;
