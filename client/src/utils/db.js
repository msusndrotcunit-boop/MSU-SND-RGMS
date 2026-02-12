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
    await db.put(storeName, { key, data });
};

export const getSingleton = async (storeName, key) => {
    const db = await initDB();
    const record = await db.get(storeName, key);
    return record ? record.data : null;
};
