import api from '../api/realApi';
import { outboxService } from './outbox';

export const getPurchaseApi = () => ({
  createPurchase: async (data) => {
    try {
      return await api.post('/purchases', data);
    } catch (error) {
      if (!navigator.onLine) {
        console.warn('Offline: queuing purchase create');
        await outboxService.enqueue({ url: '/purchases', method: 'POST', body: data });
        return { success: true, queued: true, message: 'Queued purchase create' };
      }
      throw error;
    }
  },
  getPurchases: (params = {}) => api.get('/purchases', { params }),
  getPurchase: (id) => api.get(`/purchases/${id}`),
  updatePurchase: async (id, data) => {
    try {
      return await api.put(`/purchases/${id}`, data);
    } catch (error) {
      if (!navigator.onLine) {
        console.warn('Offline: queuing purchase update');
        await outboxService.enqueue({ url: `/purchases/${id}`, method: 'PUT', body: data });
        return { success: true, queued: true, message: 'Queued purchase update' };
      }
      throw error;
    }
  },
  deletePurchase: async (id) => {
    try {
      return await api.delete(`/purchases/${id}`);
    } catch (error) {
      if (!navigator.onLine) {
        console.warn('Offline: queuing purchase delete');
        await outboxService.enqueue({ url: `/purchases/${id}`, method: 'DELETE' });
        return { success: true, queued: true, message: 'Queued purchase delete' };
      }
      throw error;
    }
  },
  getDailyPurchases: (date) => api.get('/purchases/daily', { params: { date } }),
  getPurchaseStats: () => api.get('/purchases/stats'),
  getPurchaseDashboardStats: () => api.get('/purchases/dashboard-stats'),
  createPurchaseOrder: async (data) => {
    try {
      return await api.post('/purchase-orders', data);
    } catch (error) {
      if (!navigator.onLine) {
        console.warn('Offline: queuing purchase order create');
        await outboxService.enqueue({ url: '/purchase-orders', method: 'POST', body: data });
        return { success: true, queued: true, message: 'Queued purchase order create' };
      }
      throw error;
    }
  },
  getPurchaseOrders: (params = {}) => api.get('/purchase-orders', { params }),
  getPurchaseOrder: (id) => api.get(`/purchase-orders/${id}`),
  updatePurchaseOrder: async (id, data) => {
    try {
      return await api.put(`/purchase-orders/${id}`, data);
    } catch (error) {
      if (!navigator.onLine) {
        console.warn('Offline: queuing purchase order update');
        await outboxService.enqueue({ url: `/purchase-orders/${id}`, method: 'PUT', body: data });
        return { success: true, queued: true, message: 'Queued purchase order update' };
      }
      throw error;
    }
  },
  deletePurchaseOrder: async (id) => {
    try {
      return await api.delete(`/purchase-orders/${id}`);
    } catch (error) {
      if (!navigator.onLine) {
        console.warn('Offline: queuing purchase order delete');
        await outboxService.enqueue({ url: `/purchase-orders/${id}`, method: 'DELETE' });
        return { success: true, queued: true, message: 'Queued purchase order delete' };
      }
      throw error;
    }
  },
  approvePurchaseOrder: async (id) => {
    try {
      return await api.put(`/purchase-orders/${id}/approve`);
    } catch (error) {
      if (!navigator.onLine) {
        console.warn('Offline: queuing purchase order approve');
        await outboxService.enqueue({ url: `/purchase-orders/${id}/approve`, method: 'PUT' });
        return { success: true, queued: true, message: 'Queued purchase order approve' };
      }
      throw error;
    }
  },
  getProducts: (params = {}) => api.get('/products', { params }),
  getSuppliers: (params = {}) => api.get('/suppliers', { params }),
});
