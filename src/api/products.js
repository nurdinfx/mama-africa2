import api from './auth';
import { outboxService } from '../services/outbox';
import { API_CONFIG } from '../config/api.config';

const buildUrl = (path) => `${API_CONFIG.API_URL.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;

export const productAPI = {
  getProducts: async (params = {}) => {
    try {
      return await api.get('/products', { params });
    } catch (error) {
      console.warn('Network failed, loading products from IDB');
      const cached = await (await import('../services/db')).dbService.getAll('products');
      return { success: true, data: cached || [], message: 'Loaded from offline cache' };
    }
  },

  getProduct: async (id) => {
    try {
      return await api.get(`/products/${id}`);
    } catch (error) {
      const db = await import('../services/db');
      const cached = await db.dbService.get('products', id);
      if (cached) return { success: true, data: cached, message: 'Loaded from offline cache' };
      return { success: false, message: 'Product not available offline', status: 404 };
    }
  },

  createProduct: async (productData) => {
    try {
      const res = await api.post('/products', productData);
      // If successful, persist to IDB for offline reads
      if (res && res.success && res.data) {
        try { (await import('../services/db')).dbService.put('products', res.data); } catch (e) {}
      }
      return res;
    } catch (error) {
      if (!navigator.onLine) {
        console.warn('Offline: queuing product create and saving locally');
        const tempId = `temp_prod_${Date.now()}`;
        const temp = { ...productData, id: tempId, _id: tempId, isOffline: true, createdAt: new Date().toISOString() };
        // store locally so UI can use it immediately
        try { await (await import('../services/db')).dbService.put('products', temp); } catch (e) { console.warn('Failed to store temp product', e); }
        await outboxService.enqueue({ url: buildUrl('/products'), method: 'POST', body: temp });
        return { success: true, queued: true, data: temp, message: 'Queued product create (offline)' };
      }
      throw error;
    }
  },

  updateProduct: async (id, productData) => {
    try {
      const res = await api.put(`/products/${id}`, productData);
      if (res && res.success && res.data) {
        try { (await import('../services/db')).dbService.put('products', res.data); } catch (e) {}
      }
      return res;
    } catch (error) {
      if (!navigator.onLine) {
        console.warn('Offline: queuing product update and applying locally');
        const local = { ...(productData || {}), id, _id: id, updatedAt: new Date().toISOString(), isOfflineUpdate: true };
        try { await (await import('../services/db')).dbService.put('products', local); } catch (e) { console.warn('Failed to update local product', e); }
        await outboxService.enqueue({ url: buildUrl(`/products/${id}`), method: 'PUT', body: productData });
        return { success: true, queued: true, data: local, message: 'Queued product update (offline)' };
      }
      throw error;
    }
  },

  deleteProduct: async (id) => {
    try {
      const res = await api.delete(`/products/${id}`);
      if (res && res.success) {
        // remove from local DB
        try { (await import('../services/db')).dbService.delete('products', id); } catch (e) {}
      }
      return res;
    } catch (error) {
      if (!navigator.onLine) {
        console.warn('Offline: queuing product delete and marking locally');
        try { const existing = await (await import('../services/db')).dbService.get('products', id); if (existing) { existing._deleted = true; await (await import('../services/db')).dbService.put('products', existing); } } catch (e) { console.warn('Failed to mark local product deleted', e); }
        await outboxService.enqueue({ url: buildUrl(`/products/${id}`), method: 'DELETE' });
        return { success: true, queued: true, message: 'Queued product delete (offline)' };
      }
      throw error;
    }
  },
  
  getLowStockProducts: () => 
    api.get('/products/low-stock'),
  
  updateStock: async (id, stockData) => {
    try {
      return await api.put(`/products/${id}/stock`, stockData);
    } catch (error) {
      if (!navigator.onLine) {
        console.warn('Offline: queuing stock update');
        await outboxService.enqueue({ url: buildUrl(`/products/${id}/stock`), method: 'PUT', body: stockData });
        return { success: true, queued: true, message: 'Queued stock update' };
      }
      throw error;
    }
  }
};