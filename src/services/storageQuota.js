import { dbService } from './db';

const CACHE_NAME = 'mama-africa-v1';

export const humanBytes = (bytes) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const estimateIndexedDBSize = async (stores = [
  'products', 'categories', 'tables', 'customers', 'purchases', 'purchase_orders', 'suppliers', 'expenses', 'transactions', 'inventory', 'offline_orders', 'outbox', 'users'
]) => {
  let total = 0;
  const details = {};
  for (const store of stores) {
    try {
      const items = await dbService.getAll(store);
      let size = 0;
      if (Array.isArray(items) && items.length) {
        for (const it of items) {
          try {
            const s = JSON.stringify(it).length;
            size += s;
          } catch (e) {}
        }
      }
      details[store] = { count: items ? items.length : 0, size };
      total += size;
    } catch (e) {
      details[store] = { count: 0, size: 0, error: true };
    }
  }
  return { total, details };
};

export const estimateCacheSize = async () => {
  try {
    const cache = await caches.open(CACHE_NAME);
    const keys = await cache.keys();
    let total = 0;
    for (const req of keys) {
      try {
        const res = await cache.match(req);
        if (!res) continue;
        const buf = await res.clone().arrayBuffer();
        total += buf.byteLength;
      } catch (e) {
        // Opaque/cross-origin responses may fail to measure; skip
      }
    }
    return { total, entries: keys.length };
  } catch (e) {
    return { total: 0, entries: 0, error: true };
  }
};

// Evict oldest IndexedDB items (LRU by _lastAccessed/_storedAt) until size <= targetBytes
export const evictIndexedDBToLimit = async (targetBytes, stores = [
  'transactions', 'purchases', 'purchase_orders', 'offline_orders', 'outbox', 'inventory', 'expenses', 'suppliers', 'products', 'customers', 'categories'
]) => {
  // Collect all entries with approximate size and timestamp
  const items = [];
  let total = 0;
  for (const store of stores) {
    const list = await dbService.getAll(store).catch(() => []);
    for (const it of (list || [])) {
      const id = it.id || it.tempId || null;
      if (!id) continue;
      const size = JSON.stringify(it).length;
      const ts = it._lastAccessed || it._storedAt || 0;
      items.push({ store, id, size, ts });
      total += size;
    }
  }

  if (total <= targetBytes) return { success: true, freed: 0, before: total, after: total };

  // Sort by timestamp ascending (oldest first)
  items.sort((a, b) => (a.ts || 0) - (b.ts || 0));

  let freed = 0;
  for (const it of items) {
    if (total - freed <= targetBytes) break;
    try {
      await dbService.delete(it.store, it.id).catch(() => {});
      freed += it.size;
    } catch (e) {
      // ignore individual errors
    }
  }

  return { success: true, freed, before: total, after: Math.max(0, total - freed) };
};

// Evict cache entries (oldest-first) until entries <= maxEntries
export const evictCacheToEntries = async (maxEntries = 200) => {
  try {
    const cache = await caches.open(CACHE_NAME);
    const keys = await cache.keys();
    if (keys.length <= maxEntries) return { success: true, removed: 0, before: keys.length, after: keys.length };
    const removeCount = keys.length - maxEntries;
    let removed = 0;
    for (let i = 0; i < removeCount; i++) {
      try {
        await cache.delete(keys[i]);
        removed++;
      } catch (e) {}
    }
    return { success: true, removed, before: keys.length, after: keys.length - removed };
  } catch (e) {
    return { success: false, error: e.message };
  }
};
