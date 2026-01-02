// Simple Network-First Service Worker for PWA
const CACHE_NAME = 'mama-africa-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/manifest.json',
    '/logo.png',
    '/pwa-192x192.png',
    '/pwa-512x512.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                // console.log('Opened cache');
                return cache.addAll(urlsToCache);
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
    // self.clients.claim(); // removed to avoid forcing clients to be claimed and avoid auto-reloads
});

self.addEventListener('fetch', (event) => {
    // Navigation requests should return the app shell (index.html) when offline
    if (event.request.mode === 'navigate' || (event.request.headers.get('accept') || '').includes('text/html')) {
        event.respondWith(
            fetch(event.request).catch(() => caches.match('/index.html'))
        );
        return;
    }

    const requestUrl = new URL(event.request.url);

    // Cache-first for same-origin static assets
    if (requestUrl.origin === self.location.origin) {
        event.respondWith(
            caches.match(event.request).then((cached) => {
                if (cached) return cached;
                return fetch(event.request)
                    .then((response) => {
                        if (!response || response.status !== 200 || response.type === 'opaque') return response;
                        const responseClone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
                        return response;
                    })
                    .catch(async () => {
                        // If network fails and nothing cached, fall back to index.html for navigations
                        // or return a 504-style Response to avoid throwing a TypeError in respondWith
                        const fallback = await caches.match('/index.html');
                        return fallback || new Response('Network error', { status: 504, statusText: 'Network error' });
                    });
            })
        );
        return;
    }

    // Fallback: network first for cross-origin resources, then cache
    event.respondWith(
        fetch(event.request)
            .then(res => res)
            .catch(async () => {
                const cached = await caches.match(event.request);
                return cached || new Response('Network error', { status: 504, statusText: 'Network error' });
            })
    );
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
