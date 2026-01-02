import api from './auth';
import { outboxService } from '../services/outbox';
import { API_CONFIG } from '../config/api.config';

const buildUrl = (path) => `${API_CONFIG.API_URL.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;

export const productAPI = {
  getProducts: (params = {}) => 
    api.get('/products', { params }),
  
  getProduct: (id) => 
    api.get(`/products/${id}`),
  
  createProduct: async (productData) => {
    try {
      return await api.post('/products', productData);
    } catch (error) {
      if (!navigator.onLine) {
        console.warn('Offline: queuing product create');
        await outboxService.enqueue({ url: buildUrl('/products'), method: 'POST', body: productData });
        return { success: true, queued: true, message: 'Queued product create' };
      }
      throw error;
    }
  },
  
  updateProduct: async (id, productData) => {
    try {
      return await api.put(`/products/${id}`, productData);
    } catch (error) {
      if (!navigator.onLine) {
        console.warn('Offline: queuing product update');
        await outboxService.enqueue({ url: buildUrl(`/products/${id}`), method: 'PUT', body: productData });
        return { success: true, queued: true, message: 'Queued product update' };
      }
      throw error;
    }
  },
  
  deleteProduct: async (id) => {
    try {
      return await api.delete(`/products/${id}`);
    } catch (error) {
      if (!navigator.onLine) {
        console.warn('Offline: queuing product delete');
        await outboxService.enqueue({ url: buildUrl(`/products/${id}`), method: 'DELETE' });
        return { success: true, queued: true, message: 'Queued product delete' };
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