/**
 * Performance Middleware
 * Adds response time tracking and caching headers
 */

const NodeCache = require('node-cache');

// In-memory cache with 5-minute TTL
const cache = new NodeCache({ 
    stdTTL: 300,  // 5 minutes default
    checkperiod: 60, // Check for expired keys every 60 seconds
    useClones: false // Better performance, but be careful with mutations
});

/**
 * Response Time Middleware
 * Tracks and logs API response times
 */
const responseTime = (req, res, next) => {
    const startTime = Date.now();
    
    // Override res.json to capture response time
    const originalJson = res.json.bind(res);
    res.json = function(body) {
        const duration = Date.now() - startTime;
        res.setHeader('X-Response-Time', `${duration}ms`);
        
        // Log slow requests (> 500ms)
        if (duration > 500) {
            console.warn(`[PERF WARNING] Slow request: ${req.method} ${req.path} - ${duration}ms`);
        } else {
            console.log(`[PERF] ${req.method} ${req.path} - ${duration}ms`);
        }
        
        return originalJson(body);
    };
    
    next();
};

/**
 * Cache Middleware
 * Caches GET requests for specified duration
 * 
 * @param {number} duration - Cache duration in seconds (default: 300 = 5 minutes)
 * @param {function} keyGenerator - Optional custom cache key generator
 */
const cacheMiddleware = (duration = 300, keyGenerator = null) => {
    return (req, res, next) => {
        // Only cache GET requests
        if (req.method !== 'GET') {
            return next();
        }
        
        // Generate cache key
        const cacheKey = keyGenerator 
            ? keyGenerator(req) 
            : `${req.user?.id || 'anon'}:${req.originalUrl || req.url}`;
        
        // Check cache
        const cachedBody = cache.get(cacheKey);
        
        if (cachedBody) {
            res.setHeader('X-Cache', 'HIT');
            res.setHeader('X-Cache-Key', cacheKey);
            return res.json(cachedBody);
        }
        
        // Cache miss - override res.json to cache response
        const originalJson = res.json.bind(res);
        res.json = function(body) {
            // Only cache successful responses
            if (res.statusCode === 200) {
                cache.set(cacheKey, body, duration);
                res.setHeader('X-Cache', 'MISS');
                res.setHeader('X-Cache-Key', cacheKey);
            }
            return originalJson(body);
        };
        
        next();
    };
};

/**
 * Invalidate cache for specific pattern
 * @param {string} pattern - Pattern to match cache keys (supports wildcards)
 */
const invalidateCache = (pattern) => {
    const keys = cache.keys();
    const regex = new RegExp(pattern.replace('*', '.*'));
    
    let invalidated = 0;
    keys.forEach(key => {
        if (regex.test(key)) {
            cache.del(key);
            invalidated++;
        }
    });
    
    console.log(`[CACHE] Invalidated ${invalidated} cache entries matching: ${pattern}`);
    return invalidated;
};

/**
 * Clear all cache
 */
const clearCache = () => {
    cache.flushAll();
    console.log('[CACHE] All cache cleared');
};

/**
 * Get cache statistics
 */
const getCacheStats = () => {
    return cache.getStats();
};

/**
 * HTTP Cache Headers Middleware
 * Adds appropriate cache-control headers
 */
const httpCacheHeaders = (maxAge = 300) => {
    return (req, res, next) => {
        if (req.method === 'GET') {
            res.setHeader('Cache-Control', `public, max-age=${maxAge}`);
        }
        next();
    };
};

module.exports = {
    responseTime,
    cacheMiddleware,
    invalidateCache,
    clearCache,
    getCacheStats,
    httpCacheHeaders,
    cache // Export cache instance for manual operations
};
