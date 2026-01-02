import { dbService } from './db';

// Outbox entry shape:
// { id?, url, method = 'POST', body, headers = {}, timestamp }

export const outboxService = {
  async enqueue(entry) {
    try {
      const item = {
        ...entry,
        method: entry.method || 'POST',
        headers: entry.headers || { 'Content-Type': 'application/json' },
        timestamp: Date.now(),
        attempts: 0
      };
      await dbService.put('outbox', item);

      // Attach current auth token to headers so SW can perform authenticated sync when needed
      try {
        const token = localStorage.getItem('token');
        if (token) {
          const authHeader = token.startsWith('demo-') ? token : `Bearer ${token}`;
          item.headers = { ...(item.headers || {}), Authorization: authHeader };
          // Update stored item with header
          await dbService.put('outbox', item);
        }
      } catch (e) {
        // ignore
      }

      // Try to register Background Sync if supported
      try {
        if ('serviceWorker' in navigator && 'SyncManager' in window) {
          const reg = await navigator.serviceWorker.ready;
          try {
            await reg.sync.register('outbox-sync');
            console.log('Background sync registered: outbox-sync');
          } catch (e) {
            console.warn('Sync registration failed', e);
          }
        }

        // If the service worker controller exists, notify it to trigger a retry notification to clients
        if (navigator.serviceWorker && navigator.serviceWorker.controller) {
          try {
            navigator.serviceWorker.controller.postMessage({ type: 'OUTBOX_ENQUEUED' });
          } catch (e) {
            // ignore
          }
        }
      } catch (e) {
        // ignore
      }

      // If we are online, try to flush immediately from the client context (has access to auth headers)
      try {
        if (navigator.onLine) {
          setTimeout(() => {
            this.flushOutbox();
          }, 500);
        }
      } catch (e) {}

      return true;
    } catch (e) {
      console.error('Failed to enqueue outbox item', e);
      return false;
    }
  },

  async getAll() {
    try {
      return await dbService.getAll('outbox');
    } catch (e) {
      console.error('Failed to read outbox', e);
      return [];
    }
  },

  async remove(id) {
    try {
      return await dbService.delete('outbox', id);
    } catch (e) {
      console.error('Failed to delete outbox item', e);
    }
  },

  async flushOutbox() {
    try {
      if (!navigator.onLine) return;
      const items = await this.getAll();
      if (!items.length) return;

      console.log(`📤 Flushing ${items.length} outbox items...`);

      // If there are multiple items, try batching them to /api/v1/sync (server supports batch endpoint)
      if (items.length > 1) {
        try {
          const operations = items.map(it => ({ method: it.method, url: it.url, body: it.body }));
          const firstHeaders = items[0].headers || { 'Content-Type': 'application/json' };
          const res = await fetch('/api/v1/sync', {
            method: 'POST',
            headers: firstHeaders,
            body: JSON.stringify({ operations })
          });

          if (res && res.ok) {
            const json = await res.json();
            // json.results expected to be an array aligned with operations
            if (Array.isArray(json.results)) {
              for (let i = 0; i < json.results.length; i++) {
                const result = json.results[i];
                const original = items[i];
                // If success, remove corresponding outbox item
                if (result && result.success) {
                  await this.remove(original.id);
                } else {
                  // If conflict, store in conflicts DB for manual resolution and remove outbox item
                  const isConflict = result && (result.code === 'CONFLICT' || result.status === 409 || result.conflict === true);
                  if (isConflict) {
                    try {
                      await dbService.put('conflicts', {
                        type: 'outbox',
                        url: original.url,
                        method: original.method,
                        resource: original.url.replace(/^\/api\/v1\//, '').split('/')[0],
                        local: original.body,
                        server: result.data || result.server || result.record || null,
                        timestamp: Date.now(),
                        status: 'pending'
                      });
                      await this.remove(original.id);
                      // Notify clients
                      try { if (navigator.serviceWorker && navigator.serviceWorker.controller) navigator.serviceWorker.controller.postMessage({ type: 'CONFLICT_DETECTED' }); } catch (e) {}
                    } catch (e) { console.warn('Failed to store conflict', e); }
                  }
                }
              }
            } else {
              // If results not present, remove items and proceed
              for (const it of items) {
                await this.remove(it.id);
              }
            }

            console.log(`✅ Processed ${items.length} outbox items via /sync`);

            // Trigger a data sync to refresh local DB with authoritative server ids/state
            try {
              const { syncService } = await import('./SyncService');
              syncService.syncDataDown();
            } catch (e) { console.warn('Failed to trigger data sync after flush', e); }

            return;
          } else {
            console.warn('Batch sync failed or rejected, falling back to individual flush');
          }
        } catch (err) {
          console.warn('Batch sync network error, falling back to individual flush', err);
        }
      }

      for (const item of items) {
        try {
          const res = await fetch(item.url, {
            method: item.method || 'POST',
            headers: item.headers || { 'Content-Type': 'application/json' },
            body: item.body ? JSON.stringify(item.body) : undefined
          });

          if (res && res.ok) {
            await this.remove(item.id);
            console.log(`✅ Flushed outbox item ${item.id}`);
          } else {
            const status = res ? res.status : null;
            let json = null;
            try { json = res ? await res.clone().json() : null; } catch (e) { /* ignore */ }

            // Detect conflict cases (409 or explicit conflict code)
            const isConflict = status === 409 || (json && (json.code === 'CONFLICT' || json.conflict === true));
            if (isConflict) {
              try {
                await dbService.put('conflicts', {
                  type: 'outbox',
                  url: item.url,
                  method: item.method,
                  resource: item.url.replace(/^\/api\/v1\//, '').split('/')[0],
                  local: item.body,
                  server: json && (json.data || json.server || json.record) || null,
                  timestamp: Date.now(),
                  status: 'pending'
                });
                await this.remove(item.id);
                try { if (navigator.serviceWorker && navigator.serviceWorker.controller) navigator.serviceWorker.controller.postMessage({ type: 'CONFLICT_DETECTED' }); } catch (e) {}
                continue; // Move to next item
              } catch (e) {
                console.warn('Failed to store conflict', e);
              }
            }

            // Other server errors: log and remove to avoid blocking (may be improved to 'failed' queue)
            const text = res ? await res.text() : 'no response';
            console.error(`❌ Server rejected outbox item ${item.id}:`, text);
            await this.remove(item.id);
          }
        } catch (err) {
          console.warn('Network error while flushing outbox, will retry later', err);
          // Network error—we stop processing further items to retry later
          break;
        }
      }

      // After processing individual items, attempt a full data sync to reconcile IDs/state
      try {
        const { syncService } = await import('./SyncService');
        syncService.syncDataDown();
      } catch (e) { console.warn('Failed to trigger data sync after individual flush', e); }
    } catch (err) {
      console.error('Failed to flush outbox', err);
    }
  }
};
