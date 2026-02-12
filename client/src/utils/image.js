/**
 * Centralized utility for profile picture URL construction and fallbacks.
 * Handles Cloudinary, local uploads, and API fallbacks with optimization and caching.
 */
import axios from 'axios';

/**
 * Constructs a full URL for a profile picture.
 * @param {string} rawPath - The path stored in the database (Cloudinary URL, local path, or base64)
 * @param {string|number} cadetId - The ID of the cadet for the API fallback
 * @returns {string|null} - The optimized URL or null if no path/ID provided
 */
export const getProfilePicUrl = (rawPath, cadetId) => {
    let finalSrc = null;

    if (rawPath) {
        finalSrc = rawPath;
        
        // 1. Handle local paths or paths without origin
        if (!(rawPath.startsWith('data:') || rawPath.startsWith('http'))) {
            // Normalize slashes and remove double slashes
             let normalizedPath = rawPath.replace(/\\/g, '/').replace(/\/+/g, '/');
            
            // Extract the path from /uploads/ onwards if it exists
            const uploadsIndex = normalizedPath.indexOf('/uploads/');
            if (uploadsIndex !== -1) {
                normalizedPath = normalizedPath.substring(uploadsIndex);
            } else if (!normalizedPath.startsWith('/')) {
                normalizedPath = '/' + normalizedPath;
            }

            // Determine the base URL
            const baseA = (axios && axios.defaults && axios.defaults.baseURL) || '';
            const baseB = (import.meta && import.meta.env && import.meta.env.VITE_API_URL) || '';
            const baseC = (typeof window !== 'undefined' && window.location) ? window.location.origin : '';
            
            // Find a base URL that starts with http
            let selectedBase = [baseA, baseB, baseC].find(b => b && /^https?:/.test(String(b))) || '';
            
            // If base ends with / and path starts with /, fix it
             selectedBase = String(selectedBase).replace(/\/+$/, '');
             finalSrc = selectedBase ? `${selectedBase}${normalizedPath}` : normalizedPath;
         }
     } else if (cadetId) {
         // 2. Fallback to API endpoint if no rawPath
         finalSrc = getProfilePicFallback(cadetId);
     }

     // 3. Apply Cloudinary optimizations
     if (finalSrc && finalSrc.includes('cloudinary.com')) {
         // Force HTTPS
         finalSrc = finalSrc.replace('http://', 'https://');
         
         // Add auto-quality and auto-format if not present
         if (finalSrc.includes('/upload/') && !finalSrc.includes('q_auto')) {
             finalSrc = finalSrc.replace('/upload/', '/upload/q_auto,f_auto/');
         }
     }

     // 4. Debugging - Expose to window for console checking
     if (typeof window !== 'undefined' && !window._imgDebug) {
         window._imgDebug = (path, id) => console.log('Image Debug:', { 
             input: { path, id }, 
             output: getProfilePicUrl(path, id),
             axiosBase: axios.defaults.baseURL,
             viteBase: import.meta.env.VITE_API_URL,
             origin: window.location.origin
         });
     }

     return finalSrc;
};

/**
 * Constructs the API fallback URL for a cadet's profile picture.
 * @param {string|number} cadetId - The cadet ID
 * @returns {string} - The fallback URL with cache buster
 */
export const getProfilePicFallback = (cadetId) => {
    if (!cadetId) return '';
    
    const baseA = (axios && axios.defaults && axios.defaults.baseURL) || '';
    const baseB = (import.meta && import.meta.env && import.meta.env.VITE_API_URL) || '';
    const baseC = (typeof window !== 'undefined' && window.location) ? window.location.origin : '';
    
    let selectedBase = [baseA, baseB, baseC].find(b => b && /^https?:/.test(String(b))) || '';
    selectedBase = String(selectedBase).replace(/\/+$/, '');
    
    // Add cache buster to avoid stale 404s or old images
    const t = new Date().getTime();
    const path = `/api/images/cadets/${cadetId}?t=${t}`;
    
    return selectedBase ? `${selectedBase}${path}` : path;
};
