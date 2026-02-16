const express = require('express');
const { authenticateToken, isAdmin } = require('../middleware/auth');
const { getCacheStats, clearCache } = require('../middleware/performance');
const db = require('../database');

const router = express.Router();

// Performance metrics tracking
let performanceMetrics = {
    requests: {
        total: 0,
        totalResponseTime: 0,
        slowRequests: 0,
    },
    database: {
        totalQueries: 0,
        totalQueryTime: 0,
        slowQueries: 0,
    }
};

/**
 * Track request metrics
 * Called by performance middleware
 */
function trackRequest(duration) {
    performanceMetrics.requests.total++;
    performanceMetrics.requests.totalResponseTime += duration;
    if (duration > 500) {
        performanceMetrics.requests.slowRequests++;
    }
}

/**
 * Track database query metrics
 * Called by database wrapper
 */
function trackQuery(duration) {
    performanceMetrics.database.totalQueries++;
    performanceMetrics.database.totalQueryTime += duration;
    if (duration > 200) {
        performanceMetrics.database.slowQueries++;
    }
}

/**
 * Reset metrics
 */
function resetMetrics() {
    performanceMetrics = {
        requests: {
            total: 0,
            totalResponseTime: 0,
            slowRequests: 0,
        },
        database: {
            totalQueries: 0,
            totalQueryTime: 0,
            slowQueries: 0,
        }
    };
}

/**
 * Get performance metrics endpoint
 * Validates Requirements: 9.5
 */
router.get('/metrics', authenticateToken, isAdmin, async (req, res) => {
    try {
        const cacheStats = getCacheStats();
        
        // Calculate averages
        const avgResponseTime = performanceMetrics.requests.total > 0
            ? performanceMetrics.requests.totalResponseTime / performanceMetrics.requests.total
            : 0;
        
        const avgQueryTime = performanceMetrics.database.totalQueries > 0
            ? performanceMetrics.database.totalQueryTime / performanceMetrics.database.totalQueries
            : 0;
        
        const cacheHitRate = (cacheStats.hits + cacheStats.misses) > 0
            ? (cacheStats.hits / (cacheStats.hits + cacheStats.misses)) * 100
            : 0;
        
        // Get connection pool stats if available
        let poolStats = {};
        if (db.pool) {
            poolStats = {
                poolTotal: db.pool.totalCount || 0,
                poolActive: db.pool.totalCount - db.pool.idleCount || 0,
                poolIdle: db.pool.idleCount || 0,
                poolWaiting: db.pool.waitingCount || 0,
                poolMax: 20,
            };
        }
        
        const metrics = {
            requests: {
                total: performanceMetrics.requests.total,
                avgResponseTime: Math.round(avgResponseTime),
                slowRequests: performanceMetrics.requests.slowRequests,
            },
            cache: {
                hits: cacheStats.hits,
                misses: cacheStats.misses,
                hitRate: Math.round(cacheHitRate * 10) / 10,
                keys: cacheStats.keys,
            },
            database: {
                totalQueries: performanceMetrics.database.totalQueries,
                avgQueryTime: Math.round(avgQueryTime),
                slowQueries: performanceMetrics.database.slowQueries,
                ...poolStats,
            },
            timestamp: new Date().toISOString(),
        };
        
        res.json(metrics);
    } catch (error) {
        console.error('[Metrics] Error fetching metrics:', error);
        res.status(500).json({ message: 'Failed to fetch metrics' });
    }
});

/**
 * Get cache statistics endpoint
 * Validates Requirements: 8.5
 */
router.get('/cache/stats', authenticateToken, isAdmin, (req, res) => {
    try {
        const stats = getCacheStats();
        const hitRate = (stats.hits + stats.misses) > 0
            ? (stats.hits / (stats.hits + stats.misses)) * 100
            : 0;
        
        res.json({
            ...stats,
            hitRate: Math.round(hitRate * 10) / 10,
        });
    } catch (error) {
        console.error('[Cache] Error fetching cache stats:', error);
        res.status(500).json({ message: 'Failed to fetch cache statistics' });
    }
});

/**
 * Clear all cache endpoint
 * Validates Requirements: 8.5
 */
router.post('/cache/clear', authenticateToken, isAdmin, (req, res) => {
    try {
        const statsBefore = getCacheStats();
        clearCache();
        const statsAfter = getCacheStats();
        
        console.log(`[Cache] Admin ${req.user.id} cleared all cache`);
        
        res.json({
            message: 'Cache cleared successfully',
            before: statsBefore,
            after: statsAfter,
        });
    } catch (error) {
        console.error('[Cache] Error clearing cache:', error);
        res.status(500).json({ message: 'Failed to clear cache' });
    }
});

/**
 * Reset metrics endpoint (for testing)
 */
router.post('/metrics/reset', authenticateToken, isAdmin, (req, res) => {
    try {
        resetMetrics();
        console.log(`[Metrics] Admin ${req.user.id} reset performance metrics`);
        res.json({ message: 'Metrics reset successfully' });
    } catch (error) {
        console.error('[Metrics] Error resetting metrics:', error);
        res.status(500).json({ message: 'Failed to reset metrics' });
    }
});

module.exports = {
    router,
    trackRequest,
    trackQuery,
    resetMetrics,
};
