import api from '../api/realApi';

export const getPurchaseApi = () => ({
  createPurchase: (data) => api.post('/purchases', data),
  getPurchases: (params = {}) => api.get('/purchases', { params }),
  getPurchase: (id) => api.get(`/purchases/${id}`),
  updatePurchase: (id, data) => api.put(`/purchases/${id}`, data),
  deletePurchase: (id) => api.delete(`/purchases/${id}`),
  getDailyPurchases: (date) => api.get('/purchases/daily', { params: { date } }),
  getPurchaseStats: () => api.get('/purchases/stats'),
  getPurchaseDashboardStats: () => api.get('/purchases/dashboard-stats'),
  createPurchaseOrder: (data) => api.post('/purchase-orders', data),
  getPurchaseOrders: (params = {}) => api.get('/purchase-orders', { params }),
  getPurchaseOrder: (id) => api.get(`/purchase-orders/${id}`),
  updatePurchaseOrder: (id, data) => api.put(`/purchase-orders/${id}`, data),
  deletePurchaseOrder: (id) => api.delete(`/purchase-orders/${id}`),
  approvePurchaseOrder: (id) => api.put(`/purchase-orders/${id}/approve`),
  getProducts: (params = {}) => api.get('/products', { params }),
  getSuppliers: (params = {}) => api.get('/suppliers', { params }),
});
