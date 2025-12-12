import axios from 'axios';
import { API_CONFIG } from '../config/api.config';

// Only log in development
if (import.meta.env.DEV) {
  console.log('🔗 (auth) API URL:', API_CONFIG.API_URL);
}

// Create axios instance and set baseURL per request to pick up runtime config
const api = axios.create({
  timeout: 10000,
  withCredentials: false,
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Always reflect latest runtime API URL
    config.baseURL = API_CONFIG.API_URL;
    const token = localStorage.getItem('token');
    
    if (token) {
      if (token.startsWith('demo-')) {
        config.headers.Authorization = token;
      } else {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    
    config.headers['Content-Type'] = 'application/json';
    return config;
  },
  (error) => {
    console.error('❌ Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// FIXED Response interceptor - handle different response structures
api.interceptors.response.use(
  (response) => {
    // Handle different API response structures
    const responseData = response.data;
    
    // If the response already has a success field (our custom format)
    if (responseData && typeof responseData.success !== 'undefined') {
      return responseData;
    }
    
    // If it's a standard REST response with data field
    if (responseData && responseData.data !== undefined) {
      return {
        success: true,
        data: responseData.data,
        message: responseData.message,
        status: response.status
      };
    }
    
    // If it's a direct array or object response
    return {
      success: true,
      data: responseData,
      status: response.status
    };
  },
  (error) => {
    // Enhanced error handling
    const errorDetails = {
      url: error.config?.url,
      status: error.response?.status,
      message: error.message,
      code: error.code
    };

    console.error('❌ API Response error:', errorDetails);

    // Network errors
    if (!error.response) {
      const networkError = {
        success: false,
        message: 'Cannot connect to server. Please check if backend is running.',
        code: 'NETWORK_ERROR',
        details: `Failed to connect to ${API_URL}`
      };
      return Promise.reject(networkError);
    }

    // HTTP errors - extract message from different response structures
    const errorResponse = error.response.data;
    let errorMessage = 'Request failed';
    
    if (typeof errorResponse === 'string') {
      errorMessage = errorResponse;
    } else if (errorResponse?.message) {
      errorMessage = errorResponse.message;
    } else if (errorResponse?.error) {
      errorMessage = errorResponse.error;
    }

    const httpError = {
      success: false,
      message: errorMessage,
      code: `HTTP_${error.response.status}`,
      status: error.response.status,
      data: errorResponse
    };

    return Promise.reject(httpError);
  }
);

// Enhanced test connection function
export const testBackendConnection = async () => {
  try {
    if (import.meta.env.DEV) {
      console.log('🧪 Testing backend connection...');
    }
    
    // Try the root endpoint which should always work
    const response = await api.get('/');
    if (import.meta.env.DEV) {
      console.log('✅ Backend connection test:', response);
    }
    return response;
  } catch (error) {
    console.error('❌ Backend connection test failed:', error);
    return { 
      success: false, 
      error: error.message || 'Connection failed',
      usingDemo: true 
    };
  }
};

// Helper function to extract data from different response structures
const extractData = (response) => {
  if (!response || !response.success) {
    return null;
  }
  
  const data = response.data;
  
  // Handle different data structures
  if (Array.isArray(data)) {
    return data;
  }
  
  if (data && typeof data === 'object') {
    // Common patterns in REST APIs
    if (data.data !== undefined) {
      return data.data;
    }
    if (data.items !== undefined) {
      return data.items;
    }
    if (data.results !== undefined) {
      return data.results;
    }
    if (data.users !== undefined) {
      return data.users;
    }
    if (data.products !== undefined) {
      return data.products;
    }
    if (data.orders !== undefined) {
      return data.orders;
    }
    if (data.customers !== undefined) {
      return data.customers;
    }
    if (data.tables !== undefined) {
      return data.tables;
    }
    if (data.expenses !== undefined) {
      return data.expenses;
    }
  }
  
  return data;
};

// Dashboard API endpoints
export const dashboardAPI = {
  getStats: () => api.get('/dashboard/stats'),
  getRevenueData: (period = 'week') => api.get(`/dashboard/revenue?period=${period}`),
  getTopProducts: (limit = 5, period = 'month') => api.get(`/dashboard/top-products?limit=${limit}&period=${period}`),
  getRecentActivity: (limit = 10) => api.get(`/dashboard/recent-activity?limit=${limit}`)
};

// Real API endpoints with enhanced error handling
export const realApi = {
  // Test connection
  testConnection: testBackendConnection,
  
  // Helper function for consistent data extraction
  extractData,
  
  // Auth endpoints (using the main api instance)
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (userData) => api.post('/auth/register', userData),
  getMe: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
  getDemoAccounts: () => api.get('/auth/demo-accounts'),
  checkEmail: (email) => api.get('/auth/check-email', { params: { email } }),

  // Dashboard
  ...dashboardAPI,

  // Orders
  getOrders: (params = {}) => api.get('/orders', { params }),
  getOrder: (id) => api.get(`/orders/${id}`),
  createOrder: (orderData) => api.post('/orders', orderData),
  updateOrderStatus: (id, statusData) => api.put(`/orders/${id}/status`, statusData),
  processPayment: (id, paymentData) => api.post(`/orders/${id}/payment`, paymentData),
  getOrderStats: (period = 'today') => api.get(`/orders/stats?period=${period}`),

  // Products
  getProducts: (params = {}) => api.get('/products', { params }),
  getProduct: (id) => api.get(`/products/${id}`),
  createProduct: (productData) => api.post('/products', productData),
  updateProduct: (id, productData) => api.put(`/products/${id}`, productData),
  deleteProduct: (id) => api.delete(`/products/${id}`),
  updateStock: (id, stockData) => api.patch(`/products/${id}/stock`, stockData),
  getCategories: () => api.get('/products/categories'),
  getLowStockProducts: () => api.get('/products/low-stock'),

  // Customers
  getCustomers: (params = {}) => api.get('/customers', { params }),
  getCustomer: (id) => api.get(`/customers/${id}`),
  createCustomer: (customerData) => api.post('/customers', customerData),
  updateCustomer: (id, customerData) => api.put(`/customers/${id}`, customerData),
  deleteCustomer: (id) => api.delete(`/customers/${id}`),
  searchCustomers: (query) => api.get('/customers/search', { params: { query } }),
  getCustomerSummary: (id) => api.get(`/customers/${id}/ledger/summary`),
  getCustomerLedger: (id, params = {}) => api.get(`/customers/${id}/ledger`, { params }),
  addLedgerTransaction: (transactionData) => api.post(`/customers/${transactionData.customerId}/ledger`, transactionData),

  // Tables
  getTables: (params = {}) => api.get('/tables', { params }),
  getTable: (id) => api.get(`/tables/${id}`),
  createTable: (tableData) => api.post('/tables', tableData),
  updateTable: (id, tableData) => api.put(`/tables/${id}`, tableData),
  updateTableStatus: (id, statusData) => api.patch(`/tables/${id}/status`, statusData),
  deleteTable: (id) => api.delete(`/tables/${id}`),
  getAvailableTables: () => api.get('/tables/available'),

  // Expenses
  getExpenses: (params = {}) => api.get('/expenses', { params }),
  getExpense: (id) => api.get(`/expenses/${id}`),
  createExpense: (expenseData) => api.post('/expenses', expenseData),
  updateExpense: (id, expenseData) => api.put(`/expenses/${id}`, expenseData),
  deleteExpense: (id) => api.delete(`/expenses/${id}`),

  // Users
  getUsers: () => api.get('/users'),
  getUser: (id) => api.get(`/users/${id}`),
  createUser: (userData) => api.post('/users', userData),
  updateUser: (id, userData) => api.put(`/users/${id}`, userData),
  deleteUser: (id) => api.delete(`/users/${id}`),
  toggleUserStatus: (id) => api.patch(`/users/${id}/status`)
};

// Enhanced Demo API with better structure
export const demoLocalAPI = {
  // Simulate API delay
  simulateDelay: () => new Promise(resolve => setTimeout(resolve, 500)),
  
  getDemoProducts: async () => {
    await demoLocalAPI.simulateDelay();
    return {
      success: true,
      data: [
        { 
          _id: '1', 
          name: 'Pizza Margherita', 
          price: 12.99, 
          category: 'Main Course', 
          stock: 45,
          isAvailable: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        { 
          _id: '2', 
          name: 'Chicken Burger', 
          price: 8.99, 
          category: 'Main Course', 
          stock: 32,
          isAvailable: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        { 
          _id: '3', 
          name: 'Caesar Salad', 
          price: 6.99, 
          category: 'Salads', 
          stock: 28,
          isAvailable: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        { 
          _id: '4', 
          name: 'French Fries', 
          price: 4.99, 
          category: 'Sides', 
          stock: 50,
          isAvailable: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        { 
          _id: '5', 
          name: 'Coca Cola', 
          price: 2.99, 
          category: 'Beverages', 
          stock: 100,
          isAvailable: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        { 
          _id: '6', 
          name: 'Chocolate Cake', 
          price: 5.99, 
          category: 'Desserts', 
          stock: 20,
          isAvailable: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ]
    };
  },
  
  getDemoCategories: async () => {
    await demoLocalAPI.simulateDelay();
    return {
      success: true,
      data: ['Main Course', 'Salads', 'Sides', 'Beverages', 'Desserts']
    };
  },
  
  getDemoTables: async () => {
    await demoLocalAPI.simulateDelay();
    return {
      success: true,
      data: [
        { 
          _id: '1', 
          number: 'T01', 
          capacity: 4, 
          status: 'available',
          location: 'indoor',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        { 
          _id: '2', 
          number: 'T02', 
          capacity: 2, 
          status: 'occupied',
          location: 'indoor',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        { 
          _id: '3', 
          number: 'T03', 
          capacity: 6, 
          status: 'available',
          location: 'outdoor',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        { 
          _id: '4', 
          number: 'T04', 
          capacity: 4, 
          status: 'available',
          location: 'indoor',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ]
    };
  },
  
  createDemoOrder: async (orderData) => {
    await demoLocalAPI.simulateDelay();
    const orderId = 'demo-order-' + Date.now();
    const orderNumber = 'ORD-DEMO-' + Date.now().toString().slice(-6);
    const createdAt = new Date().toISOString();
    const finalTotal = orderData.items.reduce((total, item) => total + (item.price * item.quantity), 0);
    
    return {
      success: true,
      message: 'Demo order created successfully',
      data: {
        ...orderData,
        _id: orderId,
        orderNumber: orderNumber,
        status: 'pending',
        createdAt: createdAt,
        updatedAt: createdAt,
        finalTotal: finalTotal,
        orderDate: createdAt
      }
    };
  },
  
  getDemoCustomers: async () => {
    await demoLocalAPI.simulateDelay();
    return {
      success: true,
      data: [
        {
          _id: '1',
          name: 'John Doe',
          phone: '+1234567890',
          email: 'john@example.com',
          loyaltyPoints: 150,
          totalOrders: 12,
          totalSpent: 450.75,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastOrder: new Date(Date.now() - 86400000).toISOString()
        },
        {
          _id: '2', 
          name: 'Jane Smith',
          phone: '+0987654321',
          email: 'jane@example.com',
          loyaltyPoints: 75,
          totalOrders: 8,
          totalSpent: 285.50,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastOrder: new Date(Date.now() - 172800000).toISOString()
        },
        {
          _id: '3',
          name: 'Mike Johnson',
          phone: '+1122334455',
          email: 'mike@example.com',
          loyaltyPoints: 200,
          totalOrders: 15,
          totalSpent: 625.25,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastOrder: new Date().toISOString()
        }
      ]
    };
  },
  
  getDemoOrders: async () => {
    await demoLocalAPI.simulateDelay();
    return {
      success: true,
      data: {
        orders: [
          {
            _id: '1',
            orderNumber: 'ORD-001',
            status: 'completed',
            customerName: 'John Doe',
            finalTotal: 45.50,
            createdAt: new Date(Date.now() - 3600000).toISOString(),
            items: [
              { product: { name: 'Pizza Margherita' }, quantity: 1, price: 12.99 },
              { product: { name: 'Coca Cola' }, quantity: 2, price: 2.99 }
            ]
          },
          {
            _id: '2',
            orderNumber: 'ORD-002', 
            status: 'preparing',
            customerName: 'Jane Smith',
            finalTotal: 32.75,
            createdAt: new Date(Date.now() - 1800000).toISOString(),
            items: [
              { product: { name: 'Chicken Burger' }, quantity: 1, price: 8.99 },
              { product: { name: 'French Fries' }, quantity: 1, price: 4.99 }
            ]
          }
        ],
        pagination: {
          currentPage: 1,
          totalPages: 1,
          totalItems: 2
        }
      }
    };
  },
  
  getDemoExpenses: async () => {
    await demoLocalAPI.simulateDelay();
    return {
      success: true,
      data: [
        {
          _id: '1',
          description: 'Vegetables and Fruits',
          amount: 245.75,
          category: 'food',
          date: new Date().toISOString(),
          recordedBy: { name: 'Demo Manager' },
          createdAt: new Date().toISOString()
        },
        {
          _id: '2',
          description: 'Kitchen Supplies',
          amount: 89.50,
          category: 'supplies',
          date: new Date(Date.now() - 86400000).toISOString(),
          recordedBy: { name: 'Demo Manager' },
          createdAt: new Date().toISOString()
        }
      ]
    };
  },
  
  getDemoUsers: async () => {
    await demoLocalAPI.simulateDelay();
    return {
      success: true,
      data: [
        {
          _id: '1',
          name: 'Demo Admin',
          email: 'admin@demo.com',
          role: 'admin',
          phone: '+1234567890',
          isActive: true,
          createdAt: new Date().toISOString(),
          lastLogin: new Date().toISOString()
        },
        {
          _id: '2',
          name: 'Demo Manager',
          email: 'manager@demo.com',
          role: 'manager',
          phone: '+1234567891',
          isActive: true,
          createdAt: new Date().toISOString(),
          lastLogin: new Date(Date.now() - 86400000).toISOString()
        }
      ]
    };
  }
};

// Enhanced utility function to check if we should use demo data
export const shouldUseDemoData = (error) => {
  return error?.code === 'NETWORK_ERROR' || 
         error?.code === 'ECONNREFUSED' || 
         error?.status === 404 ||
         error?.message?.includes('connect') ||
         !navigator.onLine;
};

// Helper function for consistent data handling in components
export const handleApiResponse = (response, fallbackData = []) => {
  if (!response || !response.success) {
    return fallbackData;
  }
  
  return extractData(response) || fallbackData;
};

export default api;
