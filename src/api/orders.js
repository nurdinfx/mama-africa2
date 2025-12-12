import api from './auth';

export const orderAPI = {
  createOrder: (orderData) => 
    api.post('/orders', orderData),
  
  getOrders: (params = {}) => 
    api.get('/orders', { params }),
  
  getOrder: (id) => 
    api.get(`/orders/${id}`),
  
  updateOrderStatus: (id, status) => 
    api.put(`/orders/${id}/status`, { status }),
  
  cancelOrder: (id) => 
    api.put(`/orders/${id}/cancel`),
  
  getKitchenOrders: () => 
    api.get('/orders/kitchen'),
  
  getOrderStats: (params = {}) => 
    api.get('/orders/stats', { params })
};