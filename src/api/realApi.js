// src/api/realApi.js
import axios from 'axios';
import { API_CONFIG } from '../config/api.config';

console.log('🔗 Initializing Real API with URL:', API_CONFIG.API_URL);

// Create axios instance with proper configuration
const api = axios.create({
  baseURL: API_CONFIG.API_URL,
  timeout: 30000, // 30 seconds timeout
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  withCredentials: false
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');

    if (token) {
      if (token.startsWith('demo-')) {
        config.headers.Authorization = token;
      } else {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }

    console.log(`📤 ${config.method.toUpperCase()} ${config.url}`, config.params || '');
    return config;
  },
  (error) => {
    console.error('❌ Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    console.log(`📥 Response from ${response.config.url}:`, response.status);
    console.log('📦 Raw response data:', response.data);

    // Handle different response formats
    if (response.data && typeof response.data === 'object') {
      // Check if response has success field (some APIs return {success: true, data: {...}})
      if (response.data.success !== undefined) {
        return {
          success: response.data.success,
          status: response.status,
          data: response.data.data || response.data,
          message: response.data.message || 'Success',
          pagination: response.data.pagination,
          meta: response.data.meta
        };
      }

      // Check if data is directly an array (e.g., [{...}, {...}])
      if (Array.isArray(response.data)) {
        return {
          success: true,
          status: response.status,
          data: response.data,
          message: 'Success'
        };
      }

      // Check if data has nested data property
      if (response.data.data !== undefined) {
        return {
          success: true,
          status: response.status,
          data: response.data.data,
          message: response.data.message || 'Success',
          pagination: response.data.pagination,
          meta: response.data.meta
        };
      }

      // Return the object as-is (might be a single object response)
      return {
        success: true,
        status: response.status,
        data: response.data,
        message: response.data.message || 'Success',
        pagination: response.data.pagination,
        meta: response.data.meta
      };
    }

    return {
      success: true,
      status: response.status,
      data: response.data,
      message: 'Success'
    };
  },
  (error) => {
    console.error('❌ API Error:', {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      data: error.response?.data
    });

    let errorMessage = 'Network error occurred';
    let errorCode = 'NETWORK_ERROR';

    if (error.response) {
      errorMessage = error.response.data?.message ||
        error.response.data?.error ||
        error.response.statusText;
      errorCode = `HTTP_${error.response.status}`;

      // Handle specific status codes
      if (error.response.status === 401) {
        localStorage.removeItem('token');
        sessionStorage.removeItem('token');
        window.location.href = '/login';
      }
    } else if (error.request) {
      errorMessage = 'No response from server. Please check if backend is running.';
      errorCode = 'NO_RESPONSE';
    }

    return Promise.reject({
      success: false,
      message: errorMessage,
      code: errorCode,
      status: error.response?.status,
      data: error.response?.data
    });
  }
);

// Helper functions
const buildUrl = (endpoint, params = {}) => {
  let url = endpoint;
  Object.keys(params).forEach(key => {
    url = url.replace(`{${key}}`, params[key]);
  });
  return url;
};

const handleApiError = (error, context) => {
  console.error(`❌ Error in ${context}:`, error);
  // Return a normalized error response instead of throwing to allow graceful fallbacks
  return {
    success: false,
    message: error?.message || 'Request failed',
    code: error?.code || (error?.response?.status ? `HTTP_${error.response.status}` : 'UNKNOWN_ERROR'),
    status: error?.response?.status,
    data: error?.response?.data
  };
};

// Consistent data extraction helper (used by pages)
const extractData = (response) => {
  if (!response) {
    console.warn('⚠️ extractData: No response provided');
    return null;
  }

  if (response.success === false) {
    console.warn('⚠️ extractData: Response indicates failure:', response.message);
    return null;
  }

  const data = response.data;

  console.log('🔍 extractData - Extracting from response:', {
    hasData: !!data,
    isArray: Array.isArray(data),
    isObject: data && typeof data === 'object',
    dataKeys: data && typeof data === 'object' ? Object.keys(data) : []
  });

  // If data is already an array, return it
  if (Array.isArray(data)) {
    console.log('✅ extractData: Returning array with', data.length, 'items');
    return data;
  }

  // If data is an object, check for common nested structures
  if (data && typeof data === 'object') {
    // Check for nested data property
    if (data.data !== undefined) {
      console.log('✅ extractData: Found nested data property');
      return Array.isArray(data.data) ? data.data : data.data;
    }

    // Check for common array properties
    if (data.items !== undefined && Array.isArray(data.items)) {
      console.log('✅ extractData: Found items array');
      return data.items;
    }
    if (data.results !== undefined && Array.isArray(data.results)) {
      console.log('✅ extractData: Found results array');
      return data.results;
    }
    if (data.users !== undefined && Array.isArray(data.users)) {
      console.log('✅ extractData: Found users array');
      return data.users;
    }
    if (data.products !== undefined && Array.isArray(data.products)) {
      console.log('✅ extractData: Found products array');
      return data.products;
    }
    if (data.orders !== undefined && Array.isArray(data.orders)) {
      console.log('✅ extractData: Found orders array');
      return data.orders;
    }
    if (data.customers !== undefined && Array.isArray(data.customers)) {
      console.log('✅ extractData: Found customers array');
      return data.customers;
    }
    if (data.tables !== undefined && Array.isArray(data.tables)) {
      console.log('✅ extractData: Found tables array');
      return data.tables;
    }
    if (data.expenses !== undefined && Array.isArray(data.expenses)) {
      console.log('✅ extractData: Found expenses array');
      return data.expenses;
    }

    // If it's an object but not an array, return it as-is (might be a single object)
    console.log('✅ extractData: Returning object as-is');
    return data;
  }

  console.log('✅ extractData: Returning data as-is');
  return data;
};

// ========== AUTHENTICATION API ==========
export const authAPI = {
  login: async (identifier, password) => {
    try {
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);
      const payload = {
        password,
        [isEmail ? 'email' : 'username']: identifier
      };
      const response = await api.post('/auth/login', payload);

      if (response.data?.token) {
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
      }

      return response;
    } catch (error) {
      return handleApiError(error, 'login');
    }
  },

  register: async (userData) => {
    try {
      return await api.post('/auth/register', userData);
    } catch (error) {
      return handleApiError(error, 'register');
    }
  },

  getMe: async () => {
    try {
      return await api.get('/auth/me');
    } catch (error) {
      return handleApiError(error, 'getMe');
    }
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      localStorage.clear();
      sessionStorage.clear();
    }
  },

  refreshToken: async () => {
    try {
      return await api.post('/auth/refresh');
    } catch (error) {
      return handleApiError(error, 'refreshToken');
    }
  }
};

// ========== PURCHASE API ==========
export const purchaseAPI = {
  // Purchases
  getPurchases: async (params = {}) => {
    try {
      return await api.get('/purchases', { params });
    } catch (error) {
      return handleApiError(error, 'getPurchases');
    }
  },

  getPurchase: async (id) => {
    try {
      return await api.get(`/purchases/${id}`);
    } catch (error) {
      return handleApiError(error, 'getPurchase');
    }
  },

  createPurchase: async (data) => {
    try {
      return await api.post('/purchases', data);
    } catch (error) {
      return handleApiError(error, 'createPurchase');
    }
  },

  updatePurchase: async (id, data) => {
    try {
      return await api.put(`/purchases/${id}`, data);
    } catch (error) {
      return handleApiError(error, 'updatePurchase');
    }
  },

  deletePurchase: async (id) => {
    try {
      return await api.delete(`/purchases/${id}`);
    } catch (error) {
      return handleApiError(error, 'deletePurchase');
    }
  },

  getDailyPurchases: async (date) => {
    try {
      return await api.get('/purchases/daily', {
        params: { date }
      });
    } catch (error) {
      return handleApiError(error, 'getDailyPurchases');
    }
  },

  getPurchaseStats: async () => {
    try {
      return await api.get('/purchases/stats');
    } catch (error) {
      return handleApiError(error, 'getPurchaseStats');
    }
  },

  getPurchaseDashboardStats: async () => {
    try {
      return await api.get('/purchases/dashboard-stats');
    } catch (error) {
      return handleApiError(error, 'getPurchaseDashboardStats');
    }
  },

  // Purchase Orders
  getPurchaseOrders: async (params = {}) => {
    try {
      return await api.get('/purchase-orders', { params });
    } catch (error) {
      return handleApiError(error, 'getPurchaseOrders');
    }
  },

  getPurchaseOrder: async (id) => {
    try {
      return await api.get(`/purchase-orders/${id}`);
    } catch (error) {
      return handleApiError(error, 'getPurchaseOrder');
    }
  },

  createPurchaseOrder: async (data) => {
    try {
      return await api.post('/purchase-orders', data);
    } catch (error) {
      return handleApiError(error, 'createPurchaseOrder');
    }
  },

  updatePurchaseOrder: async (id, data) => {
    try {
      return await api.put(`/purchase-orders/${id}`, data);
    } catch (error) {
      return handleApiError(error, 'updatePurchaseOrder');
    }
  },

  deletePurchaseOrder: async (id) => {
    try {
      return await api.delete(`/purchase-orders/${id}`);
    } catch (error) {
      return handleApiError(error, 'deletePurchaseOrder');
    }
  },

  approvePurchaseOrder: async (id) => {
    try {
      return await api.put(`/purchase-orders/${id}/approve`);
    } catch (error) {
      return handleApiError(error, 'approvePurchaseOrder');
    }
  }
};

// ========== SUPPLIER API ==========
export const supplierAPI = {
  getSuppliers: async (params = {}) => {
    try {
      return await api.get('/suppliers', { params });
    } catch (error) {
      return handleApiError(error, 'getSuppliers');
    }
  },

  getSupplier: async (id) => {
    try {
      return await api.get(`/suppliers/${id}`);
    } catch (error) {
      return handleApiError(error, 'getSupplier');
    }
  },

  createSupplier: async (data) => {
    try {
      return await api.post('/suppliers', data);
    } catch (error) {
      return handleApiError(error, 'createSupplier');
    }
  },

  updateSupplier: async (id, data) => {
    try {
      return await api.put(`/suppliers/${id}`, data);
    } catch (error) {
      return handleApiError(error, 'updateSupplier');
    }
  },

  deleteSupplier: async (id) => {
    try {
      return await api.delete(`/suppliers/${id}`);
    } catch (error) {
      return handleApiError(error, 'deleteSupplier');
    }
  }
};

// ========== PRODUCT API ==========
export const productAPI = {
  getProducts: async (params = {}) => {
    try {
      return await api.get('/products', { params });
    } catch (error) {
      return handleApiError(error, 'getProducts');
    }
  },

  getProduct: async (id) => {
    try {
      return await api.get(`/products/${id}`);
    } catch (error) {
      return handleApiError(error, 'getProduct');
    }
  },

  createProduct: async (data) => {
    try {
      return await api.post('/products', data);
    } catch (error) {
      return handleApiError(error, 'createProduct');
    }
  },

  updateProduct: async (id, data) => {
    try {
      return await api.put(`/products/${id}`, data);
    } catch (error) {
      return handleApiError(error, 'updateProduct');
    }
  },

  deleteProduct: async (id) => {
    try {
      return await api.delete(`/products/${id}`);
    } catch (error) {
      return handleApiError(error, 'deleteProduct');
    }
  },

  getCategories: async () => {
    try {
      return await api.get('/products/categories');
    } catch (error) {
      return handleApiError(error, 'getCategories');
    }
  },

  getLowStockProducts: async () => {
    try {
      return await api.get('/products/low-stock');
    } catch (error) {
      return handleApiError(error, 'getLowStockProducts');
    }
  },

  updateStock: async (id, stockData) => {
    try {
      return await api.patch(`/products/${id}/stock`, stockData);
    } catch (error) {
      return handleApiError(error, 'updateStock');
    }
  }
};

// ========== ORDER API ==========
export const orderAPI = {
  getOrders: async (params = {}) => {
    try {
      return await api.get('/orders', { params });
    } catch (error) {
      return handleApiError(error, 'getOrders');
    }
  },

  getOrder: async (id) => {
    try {
      return await api.get(`/orders/${id}`);
    } catch (error) {
      return handleApiError(error, 'getOrder');
    }
  },

  createOrder: async (data) => {
    try {
      return await api.post('/orders', data);
    } catch (error) {
      return handleApiError(error, 'createOrder');
    }
  },

  updateOrder: async (id, data) => {
    try {
      return await api.put(`/orders/${id}`, data);
    } catch (error) {
      return handleApiError(error, 'updateOrder');
    }
  },

  deleteOrder: async (id) => {
    try {
      return await api.delete(`/orders/${id}`);
    } catch (error) {
      return handleApiError(error, 'deleteOrder');
    }
  },

  getKitchenOrders: async (params = {}) => {
    try {
      return await api.get('/orders/kitchen', { params });
    } catch (error) {
      return handleApiError(error, 'getKitchenOrders');
    }
  },

  updateOrderStatus: async (id, statusData) => {
    try {
      return await api.put(`/orders/${id}/status`, statusData);
    } catch (error) {
      return handleApiError(error, 'updateOrderStatus');
    }
  },

  processPayment: async (id, paymentData) => {
    try {
      return await api.post(`/orders/${id}/payment`, paymentData);
    } catch (error) {
      return handleApiError(error, 'processPayment');
    }
  },

  getOrderStats: async (period = 'today') => {
    try {
      return await api.get('/orders/stats', { params: { period } });
    } catch (error) {
      return handleApiError(error, 'getOrderStats');
    }
  }
};

// ========== CUSTOMER API ==========
export const customerAPI = {
  getCustomers: async (params = {}) => {
    try {
      return await api.get('/customers', { params });
    } catch (error) {
      return handleApiError(error, 'getCustomers');
    }
  },

  getCustomer: async (id) => {
    try {
      return await api.get(`/customers/${id}`);
    } catch (error) {
      return handleApiError(error, 'getCustomer');
    }
  },

  createCustomer: async (data) => {
    try {
      return await api.post('/customers', data);
    } catch (error) {
      return handleApiError(error, 'createCustomer');
    }
  },

  updateCustomer: async (id, data) => {
    try {
      return await api.put(`/customers/${id}`, data);
    } catch (error) {
      return handleApiError(error, 'updateCustomer');
    }
  },

  deleteCustomer: async (id) => {
    try {
      return await api.delete(`/customers/${id}`);
    } catch (error) {
      return handleApiError(error, 'deleteCustomer');
    }
  },

  // Customer Ledger APIs
  getCustomerLedger: async (id, params = {}) => {
    try {
      return await api.get(`/customers/${id}/ledger`, { params });
    } catch (error) {
      return handleApiError(error, 'getCustomerLedger');
    }
  },

  getCustomerSummary: async (id) => {
    try {
      return await api.get(`/customers/${id}/summary`);
    } catch (error) {
      return handleApiError(error, 'getCustomerSummary');
    }
  },

  addLedgerTransaction: async (data) => {
    try {
      return await api.post('/customers/ledger/transaction', data);
    } catch (error) {
      return handleApiError(error, 'addLedgerTransaction');
    }
  }
};

// ========== DASHBOARD API ==========
export const dashboardAPI = {
  getStats: async () => {
    try {
      return await api.get('/dashboard/stats');
    } catch (error) {
      return handleApiError(error, 'getDashboardStats');
    }
  },

  getRevenueData: async (period = 'week') => {
    try {
      return await api.get('/dashboard/revenue', { params: { period } });
    } catch (error) {
      return handleApiError(error, 'getRevenueData');
    }
  },

  getTopProducts: async (limit = 5, period = 'month') => {
    try {
      return await api.get('/dashboard/top-products', { params: { limit, period } });
    } catch (error) {
      return handleApiError(error, 'getTopProducts');
    }
  },

  getRecentActivity: async (limit = 10) => {
    try {
      return await api.get('/dashboard/recent-activity', { params: { limit } });
    } catch (error) {
      return handleApiError(error, 'getRecentActivity');
    }
  }
};

// ========== INVENTORY API ==========
export const inventoryAPI = {
  getInventory: async (params = {}) => {
    try {
      return await api.get('/inventory', { params });
    } catch (error) {
      return handleApiError(error, 'getInventory');
    }
  },

  updateInventory: async (id, data) => {
    try {
      return await api.put(`/inventory/${id}`, data);
    } catch (error) {
      return handleApiError(error, 'updateInventory');
    }
  },

  getInventoryReport: async (params = {}) => {
    try {
      return await api.get('/inventory/report', { params });
    } catch (error) {
      return handleApiError(error, 'getInventoryReport');
    }
  }
};

// ========== TABLES API ==========
export const tableAPI = {
  getTables: async (params = {}) => {
    try {
      return await api.get('/tables', { params });
    } catch (error) {
      return handleApiError(error, 'getTables');
    }
  },

  getTable: async (id) => {
    try {
      return await api.get(`/tables/${id}`);
    } catch (error) {
      return handleApiError(error, 'getTable');
    }
  },

  createTable: async (data) => {
    try {
      return await api.post('/tables', data);
    } catch (error) {
      return handleApiError(error, 'createTable');
    }
  },

  updateTable: async (id, data) => {
    try {
      return await api.put(`/tables/${id}`, data);
    } catch (error) {
      return handleApiError(error, 'updateTable');
    }
  },

  deleteTable: async (id) => {
    try {
      return await api.delete(`/tables/${id}`);
    } catch (error) {
      return handleApiError(error, 'deleteTable');
    }
  },

  updateTableStatus: async (id, statusData) => {
    try {
      return await api.patch(`/tables/${id}/status`, statusData);
    } catch (error) {
      return handleApiError(error, 'updateTableStatus');
    }
  },

  getAvailableTables: async () => {
    try {
      return await api.get('/tables/available');
    } catch (error) {
      return handleApiError(error, 'getAvailableTables');
    }
  }
};

// ========== EXPENSE API ==========
export const expenseAPI = {
  getExpenses: async (params = {}) => {
    try {
      return await api.get('/expenses', { params });
    } catch (error) {
      return handleApiError(error, 'getExpenses');
    }
  },

  getExpense: async (id) => {
    try {
      return await api.get(`/expenses/${id}`);
    } catch (error) {
      return handleApiError(error, 'getExpense');
    }
  },

  createExpense: async (data) => {
    try {
      return await api.post('/expenses', data);
    } catch (error) {
      return handleApiError(error, 'createExpense');
    }
  },

  updateExpense: async (id, data) => {
    try {
      return await api.put(`/expenses/${id}`, data);
    } catch (error) {
      return handleApiError(error, 'updateExpense');
    }
  },

  deleteExpense: async (id) => {
    try {
      return await api.delete(`/expenses/${id}`);
    } catch (error) {
      return handleApiError(error, 'deleteExpense');
    }
  }
};

// ========== TRANSACTION API (for financial data) ==========
export const transactionAPI = {
  getTransactions: async (params = {}) => {
    try {
      return await api.get('/finance/transactions', { params });
    } catch (error) {
      return handleApiError(error, 'getTransactions');
    }
  },

  getTransaction: async (id) => {
    try {
      return await api.get(`/finance/transactions/${id}`);
    } catch (error) {
      return handleApiError(error, 'getTransaction');
    }
  },

  createTransaction: async (data) => {
    try {
      return await api.post('/finance/transactions', data);
    } catch (error) {
      return handleApiError(error, 'createTransaction');
    }
  },

  getFinanceDashboard: async () => {
    try {
      return await api.get('/finance/dashboard');
    } catch (error) {
      return handleApiError(error, 'getFinanceDashboard');
    }
  }
};

// ========== REPORTS API ==========
export const reportAPI = {
  getPurchaseReports: async (params = {}) => {
    try {
      return await api.get('/reports/purchases', { params });
    } catch (error) {
      return handleApiError(error, 'getPurchaseReports');
    }
  },

  getInventoryReport: async (params = {}) => {
    try {
      return await api.get('/reports/inventory', { params });
    } catch (error) {
      return handleApiError(error, 'getInventoryReport');
    }
  },

  generateFinancialReport: async (data) => {
    try {
      return await api.post('/finance/reports/generate', data);
    } catch (error) {
      return handleApiError(error, 'generateFinancialReport');
    }
  }
};

// ========== SETTINGS API ==========
export const settingsAPI = {
  getSettings: async () => {
    try {
      return await api.get('/settings');
    } catch (error) {
      return handleApiError(error, 'getSettings');
    }
  },

  updateSettings: async (data) => {
    try {
      return await api.put('/settings', data);
    } catch (error) {
      return handleApiError(error, 'updateSettings');
    }
  },

  getBranchSettings: async (branchId) => {
    try {
      return await api.get(`/settings/branch/${branchId}`);
    } catch (error) {
      return handleApiError(error, 'getBranchSettings');
    }
  },

  updateBranchSettings: async (branchId, data) => {
    try {
      return await api.put(`/settings/branch/${branchId}`, data);
    } catch (error) {
      return handleApiError(error, 'updateBranchSettings');
    }
  },

  uploadBranchLogo: async (branchId, formData) => {
    try {
      return await api.post(`/settings/branch/${branchId}/logo`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
    } catch (error) {
      return handleApiError(error, 'uploadBranchLogo');
    }
  },

  getSystemSettings: async () => {
    try {
      return await api.get('/settings/system');
    } catch (error) {
      return handleApiError(error, 'getSystemSettings');
    }
  }
};

// ========== USER API ==========
export const userAPI = {
  getUsers: async (params = {}) => {
    try {
      return await api.get('/users', { params });
    } catch (error) {
      return handleApiError(error, 'getUsers');
    }
  },

  getUser: async (id) => {
    try {
      return await api.get(`/users/${id}`);
    } catch (error) {
      return handleApiError(error, 'getUser');
    }
  },

  createUser: async (data) => {
    try {
      return await api.post('/users', data);
    } catch (error) {
      return handleApiError(error, 'createUser');
    }
  },

  updateUser: async (id, data) => {
    try {
      return await api.put(`/users/${id}`, data);
    } catch (error) {
      return handleApiError(error, 'updateUser');
    }
  },

  deleteUser: async (id) => {
    try {
      return await api.delete(`/users/${id}`);
    } catch (error) {
      return handleApiError(error, 'deleteUser');
    }
  }
};

// ========== MAIN EXPORT ==========
export const realApi = {
  // Core
  api,
  API_CONFIG,
  extractData,

  // APIs by category
  auth: authAPI,
  purchases: purchaseAPI,
  suppliers: supplierAPI,
  products: productAPI,
  orders: orderAPI,
  tables: tableAPI,
  customers: customerAPI,
  dashboard: dashboardAPI,
  expenses: expenseAPI,
  transactions: transactionAPI,
  reports: reportAPI,
  settings: settingsAPI,
  users: userAPI,
  inventory: inventoryAPI,

  // Flatten commonly used methods for backwards compatibility
  // Auth
  login: authAPI.login,
  register: authAPI.register,
  getMe: authAPI.getMe,
  logout: authAPI.logout,
  refreshToken: authAPI.refreshToken,

  // Products
  getProducts: productAPI.getProducts,
  getProduct: productAPI.getProduct,
  createProduct: productAPI.createProduct,
  updateProduct: productAPI.updateProduct,
  deleteProduct: productAPI.deleteProduct,
  getCategories: productAPI.getCategories,
  getLowStockProducts: productAPI.getLowStockProducts,
  updateStock: productAPI.updateStock,

  // Orders
  getOrders: orderAPI.getOrders,
  getOrder: orderAPI.getOrder,
  createOrder: orderAPI.createOrder,
  updateOrder: orderAPI.updateOrder,
  deleteOrder: orderAPI.deleteOrder,
  getKitchenOrders: orderAPI.getKitchenOrders,
  updateOrderStatus: orderAPI.updateOrderStatus,
  processPayment: orderAPI.processPayment,
  getOrderStats: orderAPI.getOrderStats,

  // Tables
  getTables: tableAPI.getTables,
  getTable: tableAPI.getTable,
  createTable: tableAPI.createTable,
  updateTable: tableAPI.updateTable,
  deleteTable: tableAPI.deleteTable,
  updateTableStatus: tableAPI.updateTableStatus,
  getAvailableTables: tableAPI.getAvailableTables,

  // Customers
  getCustomers: customerAPI.getCustomers,
  getCustomer: customerAPI.getCustomer,
  createCustomer: customerAPI.createCustomer,
  updateCustomer: customerAPI.updateCustomer,
  deleteCustomer: customerAPI.deleteCustomer,
  getCustomerLedger: customerAPI.getCustomerLedger,
  getCustomerSummary: customerAPI.getCustomerSummary,
  addLedgerTransaction: customerAPI.addLedgerTransaction,

  // Purchases
  getPurchases: purchaseAPI.getPurchases,
  getPurchase: purchaseAPI.getPurchase,
  createPurchase: purchaseAPI.createPurchase,
  updatePurchase: purchaseAPI.updatePurchase,
  deletePurchase: purchaseAPI.deletePurchase,
  getDailyPurchases: purchaseAPI.getDailyPurchases,
  getPurchaseStats: purchaseAPI.getPurchaseStats,
  getPurchaseDashboardStats: purchaseAPI.getPurchaseDashboardStats,
  getPurchaseOrders: purchaseAPI.getPurchaseOrders,
  getPurchaseOrder: purchaseAPI.getPurchaseOrder,
  createPurchaseOrder: purchaseAPI.createPurchaseOrder,
  updatePurchaseOrder: purchaseAPI.updatePurchaseOrder,
  deletePurchaseOrder: purchaseAPI.deletePurchaseOrder,
  approvePurchaseOrder: purchaseAPI.approvePurchaseOrder,

  // Settings
  getSettings: settingsAPI.getSettings,
  updateSettings: settingsAPI.updateSettings,
  getBranchSettings: settingsAPI.getBranchSettings,
  updateBranchSettings: settingsAPI.updateBranchSettings,
  uploadBranchLogo: settingsAPI.uploadBranchLogo,
  getSystemSettings: settingsAPI.getSystemSettings,

  // Users
  getUsers: userAPI.getUsers,
  getUser: userAPI.getUser,
  createUser: userAPI.createUser,
  updateUser: userAPI.updateUser,
  deleteUser: userAPI.deleteUser,

  // Expenses
  getExpenses: expenseAPI.getExpenses,
  getExpense: expenseAPI.getExpense,
  createExpense: expenseAPI.createExpense,
  updateExpense: expenseAPI.updateExpense,
  deleteExpense: expenseAPI.deleteExpense,

  // Finance/Transactions
  getTransactions: transactionAPI.getTransactions,
  getTransaction: transactionAPI.getTransaction,
  createTransaction: transactionAPI.createTransaction,
  getFinanceDashboard: transactionAPI.getFinanceDashboard,

  // Reports
  getPurchaseReports: reportAPI.getPurchaseReports,
  generateFinancialReport: reportAPI.generateFinancialReport,

  // Dashboard
  getStats: dashboardAPI.getStats,
  getRevenueData: dashboardAPI.getRevenueData,
  getTopProducts: dashboardAPI.getTopProducts,
  getRecentActivity: dashboardAPI.getRecentActivity,

  // Inventory
  getInventory: inventoryAPI.getInventory,
  updateInventory: inventoryAPI.updateInventory,

  // Suppliers
  getSuppliers: supplierAPI.getSuppliers,
  getSupplier: supplierAPI.getSupplier,
  createSupplier: supplierAPI.createSupplier,
  updateSupplier: supplierAPI.updateSupplier,
  deleteSupplier: supplierAPI.deleteSupplier,

  // Helper methods
  testConnection: async () => {
    try {
      const response = await api.get('/health');
      return {
        success: true,
        message: 'Backend is connected and healthy',
        data: response.data
      };
    } catch (error) {
      console.error('Connection test failed:', error);
      return {
        success: false,
        message: error.message || 'Cannot connect to backend',
        error: error.code
      };
    }
  },

  // Optional audit logs API (falls back if not available)
  getAuditLogs: async (params = {}) => {
    try {
      const res = await api.get('/audit/logs', { params });
      return res;
    } catch (error) {
      return { success: false, message: 'Audit API not available' };
    }
  },

  clearAuth: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.clear();
  }
};

// For compatibility
export const demoLocalAPI = {
  simulateDelay: () => new Promise(resolve => setTimeout(resolve, 0)),
  getDemoPurchases: async () => ({
    success: false,
    message: 'Real API is required. Backend might be down.'
  }),
  // Add other demo methods that return error messages
};

export const shouldUseDemoData = () => false;

// Default export is axios instance for compatibility with services/api.js
export default api;
