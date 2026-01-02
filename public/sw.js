// Simple Network-First Service Worker for PWA
const CACHE_NAME = 'mama-africa-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/manifest.json',
    '/logo.png',
    '/pwa-192x192.png',
    '/pwa-512x512.png',
    '/offline-seed.json', // initial data snapshot for fresh installs
    // Pre-cache commonly used routes so they are available offline immediately
    '/pos',
    '/products',
    '/inventory',
    '/orders',
    '/settings',
    '/purchases',
    '/suppliers',
    '/expenses',
    '/finance'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                // console.log('Opened cache');
                return cache.addAll(urlsToCache);
            }).then(async () => {
                // If there are already open clients, this is an update; notify them
                try {
                    const allClients = await self.clients.matchAll({ type: 'window' });
                    if (allClients && allClients.length) {
                        allClients.forEach(c => c.postMessage({ type: 'NEW_VERSION_AVAILABLE' }));
                    }
                } catch (e) { /* ignore */ }
            })
    );
    // self.skipWaiting(); // removed to avoid forcing activation and auto-reload
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    // Let this service worker take control immediately once activated so the app runs fully offline
    try { self.clients.claim(); } catch (e) { /* some browsers may throw here */ }
});

self.addEventListener('fetch', (event) => {
    const request = event.request;

    // Navigation requests should return the app shell (index.html) when offline
    if (request.mode === 'navigate' || (request.headers.get('accept') || '').includes('text/html')) {
        event.respondWith(
            fetch(request).then((res) => {
                // Keep a cached copy of index.html up-to-date
                if (res && res.status === 200) {
                    const clone = res.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', clone));
                }
                return res;
            }).catch(() => caches.match('/index.html'))
        );
        return;
    }

    const requestUrl = new URL(request.url);

    // Utility to prune cache size (simple FIFO prune based on cache.keys())
    async function pruneCache(cacheName, maxEntries) {
        try {
            const cache = await caches.open(cacheName);
            const keys = await cache.keys();
            if (keys.length <= maxEntries) return;
            // Remove oldest entries first
            const removeCount = keys.length - maxEntries;
            for (let i = 0; i < removeCount; i++) {
                try { await cache.delete(keys[i]); } catch (e) { /* ignore individual errors */ }
            }
        } catch (e) { /* ignore prune errors */ }
    }

    // Expose a message to request the SW to prune its cache to a specific maximum entries count
    if (requestUrl.pathname === '/__sw_prune' && request.method === 'POST') {
        event.respondWith((async () => {
            try {
                const reqClone = request.clone();
                const body = await reqClone.json().catch(() => ({}));
                const maxEntries = body.maxEntries || 200;
                await pruneCache(CACHE_NAME, maxEntries);
                return new Response(JSON.stringify({ success: true, message: 'Pruned' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
            } catch (e) {
                return new Response(JSON.stringify({ success: false, error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
            }
        })());
        return;
    }

    // API GET requests — network first, then cache fallback
    if (requestUrl.pathname.startsWith('/api') && request.method === 'GET') {
        event.respondWith(
            fetch(request).then(async (res) => {
                if (res && res.status === 200) {
                    const clone = res.clone();
                    const cache = await caches.open(CACHE_NAME);
                    await cache.put(request, clone);
                    // prune API/cache entries to avoid unbounded growth
                    await pruneCache(CACHE_NAME, 300);
                }
                return res;
            }).catch(async () => {
                const cached = await caches.match(request);
                if (cached) return cached;
                return new Response(JSON.stringify({ success: false, message: 'Offline' }), {
                    status: 503,
                    headers: { 'Content-Type': 'application/json' }
                });
            })
        );
        return;
    }

    // Same-origin static assets: cache-first then network-and-cache
    if (requestUrl.origin === self.location.origin) {
        event.respondWith(
            caches.match(request).then((cached) => {
                if (cached) return cached;
                return fetch(request).then((response) => {
                    if (!response || response.status !== 200 || response.type === 'opaque') return response;
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then(async (cache) => {
                        await cache.put(request, responseClone);
                        // prune static cache entries (keep a reasonable limit)
                        await pruneCache(CACHE_NAME, 400);
                    }).catch(() => {});
                    return response;
                }).catch(() => {
                    return new Response('Offline', { status: 504, statusText: 'Offline' });
                });
            })
        );
        return;
    }

    // Cross-origin requests: network first with cache fallback
    event.respondWith(
        fetch(request).catch(async () => {
            const cached = await caches.match(request);
            return cached || new Response('Network error', { status: 504, statusText: 'Network error' });
        })
    );
});

// Allow clients to ask the SW to skipWaiting (apply update) and notify clients on new versions
self.addEventListener('message', (event) => {
  if (!event.data) return;

  // Apply update immediately when requested by client
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  // Cache a list of URLs on demand (used by admin 'Download Full Offline Cache')
  if (event.data.type === 'CACHE_URLS' && Array.isArray(event.data.urls)) {
    const urls = event.data.urls;
    // Notify clients of progress as we cache items
    event.waitUntil((async () => {
      try {
        const cache = await caches.open(CACHE_NAME);
        const clientsList = await self.clients.matchAll({ type: 'window' });
        let done = 0;

        for (let i = 0; i < urls.length; i++) {
          const url = urls[i];
          try {
            const res = await fetch(url);
            if (res && res.status === 200) {
              try {
                await cache.put(url, res.clone());
              } catch (e) {
                // put may fail for opaque responses or cross-origin restrictions
              }
            }
            done++;
            clientsList.forEach(c => c.postMessage({ type: 'CACHE_PROGRESS', total: urls.length, done, url }));
          } catch (err) {
            // Report error but continue
            clientsList.forEach(c => c.postMessage({ type: 'CACHE_PROGRESS', total: urls.length, done, url, error: true }));
          }
        }

        // Final notification
        clientsList.forEach(c => c.postMessage({ type: 'CACHE_COMPLETE', total: urls.length, done }));
      } catch (err) {
        const clientsList = await self.clients.matchAll({ type: 'window' });
        clientsList.forEach(c => c.postMessage({ type: 'CACHE_ERROR', message: err.message }));
      }
    })());
  }
});

// Background Sync handler: flush outbox when 'outbox-sync' event fires
self.addEventListener('sync', (event) => {
  if (event.tag === 'outbox-sync') {
    event.waitUntil((async () => {
      try {
        const dbOpen = indexedDB.open('mama-africa-db');
        const items = await new Promise((resolve, reject) => {
          dbOpen.onsuccess = () => {
            const db = dbOpen.result;
            const tx = db.transaction('outbox', 'readonly');
            const store = tx.objectStore('outbox');
            const all = store.getAll();
            all.onsuccess = () => resolve(all.result || []);
            all.onerror = () => resolve([]);
          };
          dbOpen.onerror = () => resolve([]);
        });

        if (!items || items.length === 0) return;

        // Build operations for batch sync endpoint
        const operations = items.map(it => ({ method: it.method || 'POST', url: it.url, body: it.body }));

        // Use auth header from first item if available
        const authHeader = items[0]?.headers?.Authorization;
        const headers = { 'Content-Type': 'application/json' };
        if (authHeader) headers['Authorization'] = authHeader;

        const res = await fetch('/api/v1/sync', {
          method: 'POST',
          headers,
          body: JSON.stringify({ operations })
        });

        if (!res.ok) {
          throw new Error('Sync failed with status ' + res.status);
        }

        const json = await res.json();
        // On success, remove items that were processed
        // Assume results array aligns with items
        const dbOpen2 = indexedDB.open('mama-africa-db');
        dbOpen2.onsuccess = () => {
          const db = dbOpen2.result;
          const tx = db.transaction('outbox', 'readwrite');
          const store = tx.objectStore('outbox');
          for (let i = 0; i < items.length; i++) {
            // If server returned success for the op, delete local item
            const r = json.results && json.results[i];
            if (!r || r.success) {
              try { store.delete(items[i].id); } catch (e) { }
            }
          }
        };

      } catch (err) {
        console.error('Background outbox sync failed:', err);
        throw err; // Let sync retry later
      }
    })());
  }
});
