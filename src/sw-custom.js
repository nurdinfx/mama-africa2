import { openDB } from 'idb';

const DB_NAME = 'mama-africa-db';
const DB_VERSION = 2; // matches client DB

// Helper to open the same DB as client
async function getDB() {
  return openDB(DB_NAME, DB_VERSION);
}

self.addEventListener('install', (event) => {
  console.log('[SW] install event');
  // Do NOT call skipWaiting automatically — let the client decide when to apply updates.
  // The app can send a 'SKIP_WAITING' message to trigger immediate activation when appropriate.
});

self.addEventListener('activate', (event) => {
  console.log('[SW] activate event');
  // Do NOT call clients.claim() automatically — avoid forcing the page to reload.
});

// Listen for background sync event
self.addEventListener('sync', (event) => {
  if (event.tag === 'outbox-sync') {
    event.waitUntil(handleOutboxSync());
  }
});

// On message from client we can perform actions
self.addEventListener('message', (event) => {
  try {
    const data = event.data || {};
    // When the client notifies an outbox item was added, echo a retry request to all clients so they can flush with auth headers
    if (data && data.type === 'OUTBOX_ENQUEUED') {
      notifyClients({ type: 'RETRY_OUTBOX' });
    }

    // 'SKIP_WAITING' handling removed to avoid immediate activation/reloads; clients should reload manually if desired.
  } catch (e) {
    // ignore
  }
});

async function notifyClients(msg) {
  const clientsList = await self.clients.matchAll({ includeUncontrolled: true });
  for (const client of clientsList) {
    client.postMessage(msg);
  }
}

// Handle outbox: instead of making network requests directly from SW (which would need auth header),
// simply notify clients to flush their outbox (the window context has access to auth tokens and can attach headers).
async function handleOutboxSync() {
  try {
    await notifyClients({ type: 'RETRY_OUTBOX' });
  } catch (err) {
    console.error('Outbox sync failed in SW:', err);
  }
}

// Fallback for fetch - basic network-first strategy handled by generated precache/runtime from Workbox
self.addEventListener('fetch', (event) => {
  // Let Workbox handle precaching & runtime caching rules injected by build
});
