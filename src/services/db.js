import { openDB } from 'idb';

const DB_NAME = 'mama-africa-db';
const DB_VERSION = 6; // bumped to add conflicts store for offline conflict resolution support

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
                // Generic outbox for queued mutating operations from the client
                if (!db.objectStoreNames.contains('outbox')) {
                    const outbox = db.createObjectStore('outbox', { keyPath: 'id', autoIncrement: true });
                    outbox.createIndex('timestamp', 'timestamp');
                }

                // Secrets store for encrypted keys and app secrets
                if (!db.objectStoreNames.contains('secrets')) {
                    db.createObjectStore('secrets', { keyPath: 'id' });
                }

                // Users store
                if (!db.objectStoreNames.contains('users')) {
                    db.createObjectStore('users', { keyPath: 'id' });
                }

                // Cache meta store: holds sizes & metadata for eviction (keyed by storeName__id)
                if (!db.objectStoreNames.contains('cache_meta')) {
                    db.createObjectStore('cache_meta', { keyPath: 'key' });
                }

                // Conflicts store: keep server/local conflict records for manual resolution
                if (!db.objectStoreNames.contains('conflicts')) {
                    const cs = db.createObjectStore('conflicts', { keyPath: 'id', autoIncrement: true });
                    cs.createIndex('status', 'status');
                    cs.createIndex('timestamp', 'timestamp');
                }
                // Customers store
                if (!db.objectStoreNames.contains('customers')) {
                    db.createObjectStore('customers', { keyPath: 'id' });
                }

                // Purchases store
                if (!db.objectStoreNames.contains('purchases')) {
                    db.createObjectStore('purchases', { keyPath: 'id' });
                }

                // Purchase Orders store
                if (!db.objectStoreNames.contains('purchase_orders')) {
                    db.createObjectStore('purchase_orders', { keyPath: 'id' });
                }

                // Suppliers store
                if (!db.objectStoreNames.contains('suppliers')) {
                    db.createObjectStore('suppliers', { keyPath: 'id' });
                }

                // Expenses store
                if (!db.objectStoreNames.contains('expenses')) {
                    db.createObjectStore('expenses', { keyPath: 'id' });
                }

                // Transactions / finance store
                if (!db.objectStoreNames.contains('transactions')) {
                    db.createObjectStore('transactions', { keyPath: 'id' });
                }

                // Inventory store
                if (!db.objectStoreNames.contains('inventory')) {
                    db.createObjectStore('inventory', { keyPath: 'id' });
                }
            },
        });
    },

    async put(storeName, data) {
        const db = await this.getDB();
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const now = Date.now();
        if (Array.isArray(data)) {
            for (let item of data) {
                if (item && typeof item === 'object') {
                    item._storedAt = item._storedAt || now;
                    item._lastAccessed = now;
                }
                await store.put(item);
            }
        } else {
            if (data && typeof data === 'object') {
                data._storedAt = data._storedAt || now;
                data._lastAccessed = now;
            }
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
        const item = await db.get(storeName, id);
        // Touch last accessed so eviction can operate on recency
        try {
            if (item && typeof item === 'object') {
                item._lastAccessed = Date.now();
                const tx = db.transaction(storeName, 'readwrite');
                const store = tx.objectStore(storeName);
                await store.put(item);
                await tx.done;
            }
        } catch (e) { /* ignore */ }
        return item;
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
