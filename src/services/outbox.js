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
            // 4xx/5xx response: log and remove to avoid blocking; you may want to move to a failed store instead
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
    } catch (err) {
      console.error('Failed to flush outbox', err);
    }
  }
};
