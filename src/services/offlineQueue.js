const STORAGE_KEY = 'offlineQueue';

const readQueue = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const writeQueue = (queue) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch {}
};

export const enqueue = (type, payload) => {
  const queue = readQueue();
  queue.push({ type, payload, timestamp: new Date().toISOString() });
  writeQueue(queue);
};

export const processQueue = async (handlers = {}) => {
  const queue = readQueue();
  const remaining = [];
  await Promise.all(
    queue.map(async (item) => {
      const handler = handlers[item.type];
      if (typeof handler === 'function') {
        try {
          await handler(item.payload);
        } catch {
          remaining.push(item);
        }
      } else {
        remaining.push(item);
      }
    })
  );
  writeQueue(remaining);
};
