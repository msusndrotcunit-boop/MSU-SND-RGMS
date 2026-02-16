import { openDB } from 'idb';

const DB_NAME = 'rotc_grading_system_db';
const DB_VERSION = 8;

export const initDB = async () => {
    return openDB(DB_NAME, DB_VERSION, {
        upgrade(db, oldVersion, newVersion, transaction) {
            // Clear all caches on major version upgrade
            if (oldVersion < 7) {
                const stores = db.objectStoreNames;
                if (stores.contains('admin')) transaction.objectStore('admin').clear();
                if (stores.contains('cadets')) transaction.objectStore('cadets').clear();
                if (stores.contains('grading')) transaction.objectStore('grading').clear();
                if (stores.contains('training_days')) transaction.objectStore('training_days').clear();
                if (stores.contains('analytics')) transaction.objectStore('analytics').clear();
            }

            // Cadets Store
            if (!db.objectStoreNames.contains('cadets')) {
                db.createObjectStore('cadets', { keyPath: 'id' });
            }
            // Admin Store (General Purpose Cache)
            if (!db.objectStoreNames.contains('admin')) {
                db.createObjectStore('admin', { keyPath: 'key' });
            }
            // Grading Store (For Grading Management Cache)
            if (!db.objectStoreNames.contains('grading')) {
                db.createObjectStore('grading', { keyPath: 'key' });
            }
            // Grades Store (Individual Records)
            if (!db.objectStoreNames.contains('grades')) {
                db.createObjectStore('grades', { keyPath: 'id' });
            }
            // Activities Store
            if (!db.objectStoreNames.contains('activities')) {
                db.createObjectStore('activities', { keyPath: 'id' });
            }
            // Merit/Demerit Logs Store
            if (!db.objectStoreNames.contains('merit_demerit_logs')) {
                db.createObjectStore('merit_demerit_logs', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('attendance_records')) {
                db.createObjectStore('attendance_records', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('training_days')) {
                db.createObjectStore('training_days', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('excuse_letters')) {
                db.createObjectStore('excuse_letters', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('analytics')) {
                db.createObjectStore('analytics', { keyPath: 'key' });
            }
            if (!db.objectStoreNames.contains('profiles')) {
                db.createObjectStore('profiles', { keyPath: 'key' });
            }
            if (!db.objectStoreNames.contains('attendance_by_day')) {
                db.createObjectStore('attendance_by_day', { keyPath: 'key' });
            }
            if (!db.objectStoreNames.contains('dashboard')) {
                db.createObjectStore('dashboard', { keyPath: 'key' });
            }
        },
    });
};

export const cacheData = async (storeName, data) => {
    const db = await initDB();
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    
    // Clear old data to ensure cache matches server
    await store.clear();
    
    // Bulk add
    for (const item of data) {
        await store.put(item);
    }
    
    await tx.done;
    console.log(`[IndexedDB] Cached ${data.length} items in ${storeName}`);
};

export const getCachedData = async (storeName) => {
    const db = await initDB();
    return db.getAll(storeName);
};

export const clearCache = async (storeName) => {
    const db = await initDB();
    await db.clear(storeName);
};

export const cacheSingleton = async (storeName, key, data) => {
    const db = await initDB();
    await db.put(storeName, { key, data, timestamp: Date.now() });
};

export const getSingleton = async (storeName, key) => {
    const db = await initDB();
    const record = await db.get(storeName, key);
    return record ? record.data : null;
};

/**
 * Enhanced cache with timestamp and freshness check
 * Validates Requirements: 6.1, 6.2
 */
export const cacheWithTimestamp = async (storeName, key, data) => {
    const db = await initDB();
    await db.put(storeName, { 
        key, 
        data, 
        timestamp: Date.now() 
    });
    console.log(`[IndexedDB] Cached ${key} in ${storeName} with timestamp`);
};

/**
 * Get cached data with freshness check (5 minutes)
 * Validates Requirements: 6.2
 */
export const getCachedWithFreshness = async (storeName, key, maxAgeMs = 300000) => {
    const db = await initDB();
    const record = await db.get(storeName, key);
    
    if (!record) {
        console.log(`[IndexedDB] Cache MISS: ${key}`);
        return null;
    }
    
    const age = Date.now() - (record.timestamp || 0);
    const isFresh = age < maxAgeMs;
    
    if (!isFresh) {
        console.log(`[IndexedDB] Cache STALE: ${key} (age: ${Math.round(age / 1000)}s)`);
        return null;
    }
    
    console.log(`[IndexedDB] Cache HIT: ${key} (age: ${Math.round(age / 1000)}s)`);
    return record.data;
};

/**
 * Clean up stale cache entries (older than 24 hours)
 * Validates Requirements: 6.5
 */
export const cleanupStaleCache = async () => {
    const db = await initDB();
    const storeNames = ['admin', 'cadets', 'grading', 'training_days', 'analytics', 'profiles', 'dashboard'];
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    let totalCleaned = 0;
    
    for (const storeName of storeNames) {
        try {
            const tx = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const allRecords = await store.getAll();
            
            for (const record of allRecords) {
                if (record.timestamp) {
                    const age = Date.now() - record.timestamp;
                    if (age > maxAge) {
                        await store.delete(record.key);
                        totalCleaned++;
                    }
                }
            }
            
            await tx.done;
        } catch (err) {
            console.error(`[IndexedDB] Error cleaning ${storeName}:`, err);
        }
    }
    
    if (totalCleaned > 0) {
        console.log(`[IndexedDB] Cleaned up ${totalCleaned} stale cache entries`);
    }
    
    return totalCleaned;
};

/**
 * Offline sync queue for modifications
 * Validates Requirements: 6.4
 */
export const addToSyncQueue = async (operation) => {
    const db = await initDB();
    
    // Create sync_queue store if it doesn't exist
    if (!db.objectStoreNames.contains('sync_queue')) {
        db.close();
        const newDb = await openDB(DB_NAME, DB_VERSION + 1, {
            upgrade(db) {
                if (!db.objectStoreNames.contains('sync_queue')) {
                    db.createObjectStore('sync_queue', { keyPath: 'id', autoIncrement: true });
                }
            }
        });
        await newDb.put('sync_queue', {
            ...operation,
            timestamp: Date.now(),
            synced: false
        });
        return;
    }
    
    await db.put('sync_queue', {
        ...operation,
        timestamp: Date.now(),
        synced: false
    });
    
    console.log(`[IndexedDB] Added operation to sync queue:`, operation.type);
};

/**
 * Get pending sync operations
 * Validates Requirements: 6.4
 */
export const getPendingSyncOperations = async () => {
    const db = await initDB();
    
    if (!db.objectStoreNames.contains('sync_queue')) {
        return [];
    }
    
    const allOps = await db.getAll('sync_queue');
    return allOps.filter(op => !op.synced);
};

/**
 * Mark sync operation as completed
 * Validates Requirements: 6.4
 */
export const markSyncCompleted = async (operationId) => {
    const db = await initDB();
    
    if (!db.objectStoreNames.contains('sync_queue')) {
        return;
    }
    
    const operation = await db.get('sync_queue', operationId);
    if (operation) {
        operation.synced = true;
        operation.syncedAt = Date.now();
        await db.put('sync_queue', operation);
        console.log(`[IndexedDB] Marked operation ${operationId} as synced`);
    }
};

// Auto-cleanup on initialization
initDB().then(() => {
    // Run cleanup on startup
    cleanupStaleCache();
    
    // Schedule periodic cleanup (every hour)
    setInterval(cleanupStaleCache, 60 * 60 * 1000);
});
