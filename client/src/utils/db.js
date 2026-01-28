import { openDB } from 'idb';

const DB_NAME = 'rotc_grading_system_db';
const DB_VERSION = 4;

export const initDB = async () => {
    return openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
            // Cadets Store
            if (!db.objectStoreNames.contains('cadets')) {
                db.createObjectStore('cadets', { keyPath: 'id' });
            }
            // Grades Store
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
    await db.put(storeName, { key, data });
};

export const getSingleton = async (storeName, key) => {
    const db = await initDB();
    const record = await db.get(storeName, key);
    return record ? record.data : null;
};
