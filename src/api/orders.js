import api from './auth';
import { API_CONFIG } from '../config/api.config';

// Dynamic imports helper for services to avoid circular dependencies
const getServices = async () => {
  const { dbService } = await import('../services/db');
  const { outboxService } = await import('../services/outbox');
  return { dbService, outboxService };
};

export const orderAPI = {
  createOrder: async (orderData) => {
    try {
      const response = await api.post('/orders', orderData);
      return response;
    } catch (error) {
      if (!navigator.onLine) {
        console.warn('Offline: queuing order creation');
        const { dbService, outboxService } = await getServices();

        // Create a temporary ID and structure for offline storage
        const tempId = `temp_order_${Date.now()}`;
        const offlineOrder = {
          ...orderData,
          _id: tempId,
          id: tempId,
          orderNumber: `OFF-${Date.now().toString().slice(-6)}`,
          status: 'pending',
          isOffline: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        // Save to local DB so it appears in UI immediately
        try {
          await dbService.put('orders', offlineOrder);
        } catch (e) {
          console.error('Failed to save offline order to IDB:', e);
        }

        // Queue for sync
        await outboxService.enqueue({
          url: `${API_CONFIG.API_URL}/orders`,
          method: 'POST',
          body: orderData
        });

        return {
          success: true,
          data: offlineOrder,
          message: 'Order created offline (queued for sync)'
        };
      }
      throw error;
    }
  },

  getOrders: async (params = {}) => {
    try {
      return await api.get('/orders', { params });
    } catch (error) {
      console.warn('Network failed; loading orders from IDB');
      try {
        const { dbService } = await getServices();
        const cached = await dbService.getAll('orders');
        // Sort by date desc
        const sorted = (cached || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        return { success: true, data: { orders: sorted, pagination: { total: sorted.length } }, message: 'Loaded from offline cache' };
      } catch (e) {
        throw error;
      }
    }
  },

  getOrder: async (id) => {
    try {
      return await api.get(`/orders/${id}`);
    } catch (error) {
      try {
        const { dbService } = await getServices();
        const cached = await dbService.get('orders', id);
        if (cached) return { success: true, data: cached };
      } catch (e) { }
      throw error;
    }
  },

  updateOrderStatus: async (id, status) => {
    try {
      return await api.put(`/orders/${id}/status`, { status });
    } catch (error) {
      if (!navigator.onLine) {
        console.warn('Offline: queuing order status update');
        const { dbService, outboxService } = await getServices();

        // Update local
        try {
          const order = await dbService.get('orders', id);
          if (order) {
            order.status = status;
            order.updatedAt = new Date().toISOString();
            await dbService.put('orders', order);
          }
        } catch (e) { }

        await outboxService.enqueue({
          url: `${API_CONFIG.API_URL}/orders/${id}/status`,
          method: 'PUT',
          body: { status }
        });

        return { success: true, message: 'Status updated offline' };
      }
      throw error;
    }
  },

  cancelOrder: async (id) => {
    try {
      return await api.put(`/orders/${id}/cancel`); // Or DELETE if we use that now
    } catch (error) {
      // Similar offline logic if needed
      throw error;
    }
  },

  getKitchenOrders: () =>
    api.get('/orders/kitchen'),

  getOrderStats: (params = {}) =>
    api.get('/orders/stats', { params })
};