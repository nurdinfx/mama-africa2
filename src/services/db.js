import { openDB } from 'idb';

const DB_NAME = 'mama-africa-db';
const DB_VERSION = 1;

export const dbService = {
    async getDB() {
        return openDB(DB_NAME, DB_VERSION, {
            upgrade(db) {
                // Products store
                if (!db.objectStoreNames.contains('products')) {
                    db.createObjectStore('products', { keyPath: 'id' });
                }
                // Categories store
                if (!db.objectStoreNames.contains('categories')) {
                    db.createObjectStore('categories', { keyPath: 'id' });
                }
                // Tables store
                if (!db.objectStoreNames.contains('tables')) {
                    db.createObjectStore('tables', { keyPath: 'id' });
                }
                // Offline orders queue
                if (!db.objectStoreNames.contains('offline_orders')) {
                    const orderStore = db.createObjectStore('offline_orders', { keyPath: 'tempId' });
                    orderStore.createIndex('timestamp', 'timestamp');
                }
                // Users store
                if (!db.objectStoreNames.contains('users')) {
                    db.createObjectStore('users', { keyPath: 'id' });
                }
                // Customers store
                if (!db.objectStoreNames.contains('customers')) {
                    db.createObjectStore('customers', { keyPath: 'id' });
                }
            },
        });
    },

    async put(storeName, data) {
        const db = await this.getDB();
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        if (Array.isArray(data)) {
            for (const item of data) {
                await store.put(item);
            }
        } else {
            await store.put(data);
        }
        await tx.done;
    },

    async getAll(storeName) {
        const db = await this.getDB();
        return db.getAll(storeName);
    },

    async get(storeName, id) {
        const db = await this.getDB();
        return db.get(storeName, id);
    },

    async delete(storeName, id) {
        const db = await this.getDB();
        return db.delete(storeName, id);
    },

    async clear(storeName) {
        const db = await this.getDB();
        return db.clear(storeName);
    }
};
