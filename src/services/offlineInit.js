// src/services/offlineInit.js
// Populate IndexedDB from cached /offline-seed.json on first run (or if DB empty)
import { dbService } from './db';

export const ensureSeeded = async () => {
  try {
    // If core stores already have data, skip
    const products = await dbService.getAll('products');
    const categories = await dbService.getAll('categories');
    const tables = await dbService.getAll('tables');
    const customers = await dbService.getAll('customers');

    if ((products && products.length) || (categories && categories.length) || (tables && tables.length) || (customers && customers.length)) {
      // Already seeded
      return { seeded: false, reason: 'already_has_data' };
    }

    // Try to fetch the cached seed (this will work offline because SW cached the file)
    let seed = null;
    try {
      const res = await fetch('/offline-seed.json');
      if (res.ok) seed = await res.json();
    } catch (e) {
      console.warn('Failed to fetch offline-seed.json', e);
    }

    if (!seed) return { seeded: false, reason: 'no_seed' };

    if (Array.isArray(seed.products) && seed.products.length) await dbService.put('products', seed.products);
    if (Array.isArray(seed.categories) && seed.categories.length) await dbService.put('categories', seed.categories);
    if (Array.isArray(seed.tables) && seed.tables.length) await dbService.put('tables', seed.tables);
    if (Array.isArray(seed.customers) && seed.customers.length) await dbService.put('customers', seed.customers);
    if (Array.isArray(seed.purchases) && seed.purchases.length) await dbService.put('purchases', seed.purchases);
    if (Array.isArray(seed.purchase_orders) && seed.purchase_orders.length) await dbService.put('purchase_orders', seed.purchase_orders);
    if (Array.isArray(seed.suppliers) && seed.suppliers.length) await dbService.put('suppliers', seed.suppliers);
    if (Array.isArray(seed.expenses) && seed.expenses.length) await dbService.put('expenses', seed.expenses);
    if (Array.isArray(seed.transactions) && seed.transactions.length) await dbService.put('transactions', seed.transactions);
    if (Array.isArray(seed.inventory) && seed.inventory.length) await dbService.put('inventory', seed.inventory);

    return { seeded: true };
  } catch (err) {
    console.error('Failed to seed DB:', err);
    return { seeded: false, error: err };
  }
};

// Download full dataset & assets into IndexedDB and instruct the SW to cache assets
export const downloadFullCache = async (progressCb = () => {}) => {
  if (typeof navigator === 'undefined' || !navigator.onLine) return { success: false, reason: 'offline' };

  try {
    // List of fetchers to populate DB and assets to cache
    const tasks = [
      { store: 'products', fetcher: () => import('../api/realApi').then(m => m.getProducts ? m.getProducts({ limit: 1000 }) : m.products.getProducts({ limit: 1000 })) },
      { store: 'categories', fetcher: () => import('../api/realApi').then(m => m.getCategories ? m.getCategories({ limit: 1000 }) : m.categories.getCategories({ limit: 1000 })) },
      { store: 'tables', fetcher: () => import('../api/realApi').then(m => m.getTables ? m.getTables() : m.tables.getTables()) },
      { store: 'customers', fetcher: () => import('../api/realApi').then(m => m.getCustomers ? m.getCustomers({ limit: 1000 }) : m.customers.getCustomers({ limit: 1000 })) },
      { store: 'purchases', fetcher: () => import('../api/realApi').then(m => m.getPurchases ? m.getPurchases({ limit: 1000 }) : m.purchases.getPurchases({ limit: 1000 })) },
      { store: 'purchase_orders', fetcher: () => import('../api/realApi').then(m => m.getPurchaseOrders ? m.getPurchaseOrders({ limit: 1000 }) : m.purchaseOrders.getPurchaseOrders({ limit: 1000 })) },
      { store: 'suppliers', fetcher: () => import('../api/realApi').then(m => m.getSuppliers ? m.getSuppliers({ limit: 1000 }) : m.suppliers.getSuppliers({ limit: 1000 })) },
      { store: 'expenses', fetcher: () => import('../api/realApi').then(m => m.getExpenses ? m.getExpenses({ limit: 1000 }) : m.expenses.getExpenses({ limit: 1000 })) },
      { store: 'transactions', fetcher: () => import('../api/realApi').then(m => m.getTransactions ? m.getTransactions({ limit: 1000 }) : m.transactions.getTransactions({ limit: 1000 })) },
      { store: 'inventory', fetcher: () => import('../api/realApi').then(m => m.getInventory ? m.getInventory({ limit: 1000 }) : m.inventory.getInventory({ limit: 1000 })) }
    ];

    const total = tasks.length;
    let done = 0;

    for (const t of tasks) {
      progressCb({ done, total, message: `Fetching ${t.store}...` });
      try {
        const res = await t.fetcher();
        const data = res && (res.data || res) ? (res.data || res) : null;
        if (Array.isArray(data) && data.length) {
          await dbService.put(t.store, data);
        }
      } catch (err) {
        console.warn('Failed to fetch', t.store, err);
      }
      done++;
      progressCb({ done, total, message: `Fetched ${t.store}` });
    }

    // Build list of application routes and static assets to cache
    const routes = [
      '/', '/index.html', '/manifest.json', '/offline-seed.json',
      '/pos', '/products', '/inventory', '/orders', '/settings', '/purchases', '/suppliers', '/expenses', '/finance', '/reports', '/tables'
    ];

    // Also include some common static assets (icons)
    const assets = ['/logo restaurant.jfif', '/pwa-192x192.png', '/pwa-512x512.png'];

    // Add API endpoints for key resources so responses are cached too
    const apiUrls = tasks.map(t => `/api/v1/${t.store}`);

    const urlsToCache = routes.concat(assets).concat(apiUrls);

    // Send list to service worker to cache and watch progress via messages
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'CACHE_URLS', urls: urlsToCache });
    } else if (navigator.serviceWorker && navigator.serviceWorker.ready) {
      progressCb({ done, total, message: 'Waiting for SW to become active...' });
      const reg = await navigator.serviceWorker.ready;
      if (reg && reg.active) {
        reg.active.postMessage({ type: 'CACHE_URLS', urls: urlsToCache });
      }
    }

    // Request a background sync so outbox flush will be attempted
    try {
      const reg = await navigator.serviceWorker.ready;
      if (reg && reg.sync) {
        await reg.sync.register('outbox-sync');
      }
    } catch (e) {
      // ignore
    }

    progressCb({ done: total, total, message: 'Done' });
    return { success: true, total: tasks.length };
  } catch (err) {
    console.error('downloadFullCache failed:', err);
    return { success: false, error: err };
  }
};
