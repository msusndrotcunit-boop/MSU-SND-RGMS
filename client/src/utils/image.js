import axios from 'axios';

/**
 * Robustly constructs a profile picture URL from various path formats.
 * @param {string} rawPath - The raw path stored in the database (e.g., Cloudinary URL, local upload path, etc.)
 * @param {string|number} cadetId - The ID of the cadet for the fallback endpoint.
 * @returns {string} The constructed URL.
 */
export const getProfilePicUrl = (rawPath, cadetId) => {
    let finalSrc = null;

    if (rawPath) {
        finalSrc = rawPath;
        // If it's not a data URL and not an absolute HTTP URL
        if (!(rawPath.startsWith('data:') || rawPath.startsWith('http'))) {
            let normalizedPath = rawPath.replace(/\\/g, '/');
            const uploadsIndex = normalizedPath.indexOf('/uploads/');
            
            if (uploadsIndex !== -1) {
                normalizedPath = normalizedPath.substring(uploadsIndex);
            } else if (!normalizedPath.startsWith('/')) {
                normalizedPath = '/' + normalizedPath;
            }

            const baseA = (axios && axios.defaults && axios.defaults.baseURL) || '';
            const baseB = import.meta.env.VITE_API_URL || '';
            const baseC = (typeof window !== 'undefined' && window.location && /^https?:/.test(window.location.origin)) ? window.location.origin : '';
            const selectedBase = [baseA, baseB, baseC].find(b => b && /^https?:/.test(b)) || '';

            if (selectedBase) {
                finalSrc = `${selectedBase.replace(/\/+$/,'')}${normalizedPath}`;
            } else {
                finalSrc = normalizedPath;
            }
        }
    } else if (cadetId) {
        finalSrc = `/api/images/cadets/${cadetId}`;
    }

    // Apply Cloudinary optimizations
    if (finalSrc && finalSrc.includes('cloudinary.com')) {
        finalSrc = finalSrc.replace('http://', 'https://');
        if (finalSrc.includes('/upload/')) {
            if (!finalSrc.includes('q_auto')) {
                finalSrc = finalSrc.replace('/upload/', '/upload/q_auto,f_auto/');
            }
        }
    }

    return finalSrc;
};

/**
 * Returns a fallback URL for a profile picture.
 * @param {string|number} cadetId - The ID of the cadet.
 * @returns {string} The fallback URL.
 */
export const getProfilePicFallback = (cadetId) => {
    return `/api/images/cadets/${cadetId}`;
};
