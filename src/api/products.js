import api from './auth';

export const productAPI = {
  getProducts: (params = {}) => 
    api.get('/products', { params }),
  
  getProduct: (id) => 
    api.get(`/products/${id}`),
  
  createProduct: (productData) => 
    api.post('/products', productData),
  
  updateProduct: (id, productData) => 
    api.put(`/products/${id}`, productData),
  
  deleteProduct: (id) => 
    api.delete(`/products/${id}`),
  
  getLowStockProducts: () => 
    api.get('/products/low-stock'),
  
  updateStock: (id, stockData) => 
    api.put(`/products/${id}/stock`, stockData)
};