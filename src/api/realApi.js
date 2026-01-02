// src/api/realApi.js
import axios from 'axios';
import { API_CONFIG } from '../config/api.config';
import { dbService } from '../services/db';

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
        // Clear tokens and notify app of logout instead of forcing a navigation here
        localStorage.removeItem('token');
        sessionStorage.removeItem('token');
        try {
          window.dispatchEvent(new CustomEvent('auth.logout', { detail: { status: 401 } }));
        } catch (e) {
          console.warn('Failed to dispatch auth.logout event; manual logout may be required', e);
        }
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

      try {
        const response = await api.post('/auth/login', payload);

        if (response.data?.token) {
          localStorage.setItem('token', response.data.token);
          localStorage.setItem('user', JSON.stringify(response.data.user));

          // Store a local hash of the password (so the user can login while offline)
          try {
            if (password) {
              const { hashPassword } = await import('../services/password');
              const hash = await hashPassword(password);
              const userRecord = {
                id: response.data.user._id || response.data.user.id,
                email: response.data.user.email,
                username: response.data.user.username,
                name: response.data.user.name,
                role: response.data.user.role || 'staff',
                passwordHash: hash
              };
              await dbService.put('users', userRecord);
            }
          } catch (e) {
            console.warn('Failed to store offline password hash', e);
          }
        }

        return response;
      } catch (error) {
        // Network or backend error — attempt offline login via DB
        console.warn('Login network failed, attempting offline login fallback', error);
        try {
          const users = await dbService.getAll('users');
          const found = users.find(u => u.email === identifier || u.username === identifier || u.id === identifier);
          if (found && found.passwordHash) {
            const { verifyPassword } = await import('../services/password');
            const ok = await verifyPassword(password, found.passwordHash);
            if (ok) {
              const token = `local-${found.id}-${Date.now()}`;
              localStorage.setItem('token', token);
              localStorage.setItem('user', JSON.stringify({ _id: found.id, name: found.name, email: found.email, username: found.username, role: found.role }));
              return { success: true, status: 200, data: { token, user: { _id: found.id, name: found.name, email: found.email } }, message: 'Logged in offline' };
            }
          }
        } catch (e) {
          console.warn('Offline login fallback failed', e);
        }

        return handleApiError(error, 'login');
      }
    } catch (err) {
      return handleApiError(err, 'login');
    }
  },

  register: async (userData) => {
    try {
      return await api.post('/auth/register', userData);
    } catch (error) {
      // If offline, register locally in IDB so the user can login while offline
      console.warn('Register failed, attempting local registration', error);
      if (!navigator.onLine) {
        try {
          const id = `local-${Date.now()}`;
          const { hashPassword } = await import('../services/password');
          const pwdHash = userData.password ? await hashPassword(userData.password) : null;
          const record = {
            id,
            _id: id,
            name: userData.name || (userData.fullName || userData.username),
            email: userData.email || userData.username,
            username: userData.username || userData.email,
            role: userData.role || 'staff',
            passwordHash: pwdHash,
            createdAt: new Date().toISOString(),
            isLocal: true
          };

          // Persist to IDB
          await dbService.put('users', record);

          // Update local users cache (use optimistic localStorage update so UI reflects change immediately)
          try {
            const key = 'users_list';
            const raw = localStorage.getItem(key);
            if (raw) {
              try {
                const parsed = JSON.parse(raw);
                const arr = Array.isArray(parsed.data) ? parsed.data : (Array.isArray(parsed) ? parsed : []);
                const next = [{ _id: id, ...record }, ...arr];
                localStorage.setItem(key, JSON.stringify({ timestamp: Date.now(), data: next }));
              } catch (e) {
                // If parse failed, set new wrapper
                localStorage.setItem(key, JSON.stringify({ timestamp: Date.now(), data: [{ _id: id, ...record }] }));
              }
            } else {
              localStorage.setItem(key, JSON.stringify({ timestamp: Date.now(), data: [{ _id: id, ...record }] }));
            }

            // Notify listeners in this window
            try { window.dispatchEvent(new Event('users-updated')); } catch (e) { /* ignore */ }
          } catch (e) { console.warn('Failed to update local users cache', e); }

          return { success: true, status: 201, data: { user: { _id: id, ...record } }, message: 'Registered offline' };
        } catch (e) {
          console.warn('Local registration failed', e);
          return handleApiError(error, 'register');
        }
      }

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
      console.warn('Network failed; loading purchases from IDB');
      try {
        const cached = await (await import('../services/db')).dbService.getAll('purchases');
        return { success: true, data: cached || [], message: 'Loaded from offline cache' };
      } catch (e) {
        return handleApiError(error, 'getPurchases');
      }
    }
  },

  getPurchase: async (id) => {
    try {
      return await api.get(`/purchases/${id}`);
    } catch (error) {
      try {
        const cached = await (await import('../services/db')).dbService.get('purchases', id);
        if (cached) return { success: true, data: cached, message: 'Loaded from offline cache' };
      } catch (e) {}
      return handleApiError(error, 'getPurchase');
    }
  },

  createPurchase: async (data) => {
    try {
      const res = await api.post('/purchases', data);
      if (res && res.success && res.data) {
        try { (await import('../services/db')).dbService.put('purchases', res.data); } catch (e) {}
      }
      return res;
    } catch (error) {
      if (!navigator.onLine) {
        console.warn('Offline: queuing purchase create and saving locally');
        const id = `temp_purchase_${Date.now()}`;
        const temp = { ...data, id, _id: id, isOffline: true, createdAt: new Date().toISOString() };
        try { await (await import('../services/db')).dbService.put('purchases', temp); } catch (e) { console.warn('Failed to store temp purchase', e); }
        await (await import('../services/outbox')).outboxService.enqueue({ url: (await import('../config/api.config')).API_CONFIG.API_URL + '/purchases', method: 'POST', body: temp });
        return { success: true, queued: true, data: temp, message: 'Queued purchase create (offline)' };
      }
      return handleApiError(error, 'createPurchase');
    }
  },

  updatePurchase: async (id, data) => {
    try {
      const res = await api.put(`/purchases/${id}`, data);
      if (res && res.success && res.data) {
        try { (await import('../services/db')).dbService.put('purchases', res.data); } catch (e) {}
      }
      return res;
    } catch (error) {
      if (!navigator.onLine) {
        console.warn('Offline: queuing purchase update and applying locally');
        const local = { ...(data || {}), id, _id: id, updatedAt: new Date().toISOString(), isOfflineUpdate: true };
        try { await (await import('../services/db')).dbService.put('purchases', local); } catch (e) { console.warn('Failed to update local purchase', e); }
        await (await import('../services/outbox')).outboxService.enqueue({ url: (await import('../config/api.config')).API_CONFIG.API_URL + `/purchases/${id}`, method: 'PUT', body: data });
        return { success: true, queued: true, data: local, message: 'Queued purchase update (offline)' };
      }
      return handleApiError(error, 'updatePurchase');
    }
  },

  deletePurchase: async (id) => {
    try {
      const res = await api.delete(`/purchases/${id}`);
      if (res && res.success) { try { (await import('../services/db')).dbService.delete('purchases', id); } catch (e) {} }
      return res;
    } catch (error) {
      if (!navigator.onLine) {
        console.warn('Offline: queuing purchase delete and marking locally');
        try { const existing = await (await import('../services/db')).dbService.get('purchases', id); if (existing) { existing._deleted = true; await (await import('../services/db')).dbService.put('purchases', existing); } } catch (e) { console.warn('Failed to mark local purchase deleted', e); }
        await (await import('../services/outbox')).outboxService.enqueue({ url: (await import('../config/api.config')).API_CONFIG.API_URL + `/purchases/${id}`, method: 'DELETE' });
        return { success: true, queued: true, message: 'Queued purchase delete (offline)' };
      }
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
      const res = await api.post('/purchase-orders', data);
      if (res && res.success && res.data) { try { (await import('../services/db')).dbService.put('purchase_orders', res.data); } catch (e) {} }
      return res;
    } catch (error) {
      if (!navigator.onLine) {
        console.warn('Offline: queuing purchase order create and saving locally');
        const id = `temp_po_${Date.now()}`;
        const temp = { ...data, id, _id: id, isOffline: true, createdAt: new Date().toISOString() };
        try { await (await import('../services/db')).dbService.put('purchase_orders', temp); } catch (e) { console.warn('Failed to store temp purchase order', e); }
        await (await import('../services/outbox')).outboxService.enqueue({ url: (await import('../config/api.config')).API_CONFIG.API_URL + '/purchase-orders', method: 'POST', body: temp });
        return { success: true, queued: true, data: temp, message: 'Queued purchase order create (offline)' };
      }
      return handleApiError(error, 'createPurchaseOrder');
    }
  },

  updatePurchaseOrder: async (id, data) => {
    try {
      const res = await api.put(`/purchase-orders/${id}`, data);
      if (res && res.success && res.data) { try { (await import('../services/db')).dbService.put('purchase_orders', res.data); } catch (e) {} }
      return res;
    } catch (error) {
      if (!navigator.onLine) {
        console.warn('Offline: queuing purchase order update and applying locally');
        const local = { ...(data || {}), id, _id: id, updatedAt: new Date().toISOString(), isOfflineUpdate: true };
        try { await (await import('../services/db')).dbService.put('purchase_orders', local); } catch (e) { console.warn('Failed to update local purchase_order', e); }
        await (await import('../services/outbox')).outboxService.enqueue({ url: (await import('../config/api.config')).API_CONFIG.API_URL + `/purchase-orders/${id}`, method: 'PUT', body: data });
        return { success: true, queued: true, data: local, message: 'Queued purchase order update (offline)' };
      }
      return handleApiError(error, 'updatePurchaseOrder');
    }
  },

  deletePurchaseOrder: async (id) => {
    try {
      const res = await api.delete(`/purchase-orders/${id}`);
      if (res && res.success) { try { (await import('../services/db')).dbService.delete('purchase_orders', id); } catch (e) {} }
      return res;
    } catch (error) {
      if (!navigator.onLine) {
        console.warn('Offline: queuing purchase order delete and marking locally');
        try { const existing = await (await import('../services/db')).dbService.get('purchase_orders', id); if (existing) { existing._deleted = true; await (await import('../services/db')).dbService.put('purchase_orders', existing); } } catch (e) { console.warn('Failed to mark local purchase_order deleted', e); }
        await (await import('../services/outbox')).outboxService.enqueue({ url: (await import('../config/api.config')).API_CONFIG.API_URL + `/purchase-orders/${id}`, method: 'DELETE' });
        return { success: true, queued: true, message: 'Queued purchase order delete (offline)' };
      }
      return handleApiError(error, 'deletePurchaseOrder');
    }
  },

  approvePurchaseOrder: async (id) => {
    try {
      return await api.put(`/purchase-orders/${id}/approve`);
    } catch (error) {
      if (!navigator.onLine) {
        console.warn('Offline: queuing purchase order approval');
        await (await import('../services/outbox')).outboxService.enqueue({ url: (await import('../config/api.config')).API_CONFIG.API_URL + `/purchase-orders/${id}/approve`, method: 'PUT' });
        // mark locally as pending approval
        try { const existing = await (await import('../services/db')).dbService.get('purchase_orders', id); if (existing) { existing.approvalPending = true; await (await import('../services/db')).dbService.put('purchase_orders', existing); } } catch (e) {}
        return { success: true, queued: true, message: 'Queued purchase order approval (offline)' };
      }
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
      console.warn('Network failed; loading suppliers from IDB');
      try { const cached = await (await import('../services/db')).dbService.getAll('suppliers'); return { success: true, data: cached || [], message: 'Loaded from offline cache' }; } catch (e) { return handleApiError(error, 'getSuppliers'); }
    }
  },

  getSupplier: async (id) => {
    try {
      return await api.get(`/suppliers/${id}`);
    } catch (error) {
      try { const cached = await (await import('../services/db')).dbService.get('suppliers', id); if (cached) return { success: true, data: cached, message: 'Loaded from offline cache' }; } catch (e) {}
      return handleApiError(error, 'getSupplier');
    }
  },

  createSupplier: async (data) => {
    try {
      const res = await api.post('/suppliers', data);
      if (res && res.success && res.data) { try { (await import('../services/db')).dbService.put('suppliers', res.data); } catch (e) {} }
      return res;
    } catch (error) {
      if (!navigator.onLine) {
        console.warn('Offline: queuing supplier create and saving locally');
        const id = `temp_supplier_${Date.now()}`;
        const temp = { ...data, id, _id: id, isOffline: true, createdAt: new Date().toISOString() };
        try { await (await import('../services/db')).dbService.put('suppliers', temp); } catch (e) { console.warn('Failed to store temp supplier', e); }
        await (await import('../services/outbox')).outboxService.enqueue({ url: (await import('../config/api.config')).API_CONFIG.API_URL + '/suppliers', method: 'POST', body: temp });
        return { success: true, queued: true, data: temp, message: 'Queued supplier create (offline)' };
      }
      return handleApiError(error, 'createSupplier');
    }
  },

  updateSupplier: async (id, data) => {
    try {
      const res = await api.put(`/suppliers/${id}`, data);
      if (res && res.success && res.data) { try { (await import('../services/db')).dbService.put('suppliers', res.data); } catch (e) {} }
      return res;
    } catch (error) {
      if (!navigator.onLine) {
        console.warn('Offline: queuing supplier update and applying locally');
        const local = { ...(data || {}), id, _id: id, updatedAt: new Date().toISOString(), isOfflineUpdate: true };
        try { await (await import('../services/db')).dbService.put('suppliers', local); } catch (e) { console.warn('Failed to update local supplier', e); }
        await (await import('../services/outbox')).outboxService.enqueue({ url: (await import('../config/api.config')).API_CONFIG.API_URL + `/suppliers/${id}`, method: 'PUT', body: data });
        return { success: true, queued: true, data: local, message: 'Queued supplier update (offline)' };
      }
      return handleApiError(error, 'updateSupplier');
    }
  },

  deleteSupplier: async (id) => {
    try {
      const res = await api.delete(`/suppliers/${id}`);
      if (res && res.success) { try { (await import('../services/db')).dbService.delete('suppliers', id); } catch (e) {} }
      return res;
    } catch (error) {
      if (!navigator.onLine) {
        console.warn('Offline: queuing supplier delete and marking locally');
        try { const existing = await (await import('../services/db')).dbService.get('suppliers', id); if (existing) { existing._deleted = true; await (await import('../services/db')).dbService.put('suppliers', existing); } } catch (e) { console.warn('Failed to mark local supplier deleted', e); }
        await (await import('../services/outbox')).outboxService.enqueue({ url: (await import('../config/api.config')).API_CONFIG.API_URL + `/suppliers/${id}`, method: 'DELETE' });
        return { success: true, queued: true, message: 'Queued supplier delete (offline)' };
      }
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
      console.warn('Network request failed, trying offline DB for products');
      const cachedProducts = await dbService.getAll('products');
      if (cachedProducts && cachedProducts.length > 0) {
        return { success: true, data: cachedProducts, message: 'Loaded from offline cache' };
      }
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
      console.warn('Network request failed, trying offline DB for categories');
      const cachedCategories = await dbService.getAll('categories');
      if (cachedCategories && cachedCategories.length > 0) {
        return { success: true, data: cachedCategories, message: 'Loaded from offline cache' };
      }
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
      console.warn('Network request failed; returning offline orders');
      try {
        const offlineOrders = await (await import('../services/db')).dbService.getAll('offline_orders');
        return { success: true, data: offlineOrders || [], message: 'Loaded offline orders' };
      } catch (e) {
        return handleApiError(error, 'getOrders');
      }
    }
  },

  getOrder: async (id) => {
    try {
      return await api.get(`/orders/${id}`);
    } catch (error) {
      console.warn('Network request failed; trying offline orders for order', id);
      try {
        const offlineOrders = await (await import('../services/db')).dbService.getAll('offline_orders');
        const found = (offlineOrders || []).find(o => o.tempId === id || o._id === id || o.id === id);
        if (found) return { success: true, data: found, message: 'Loaded offline order' };
      } catch (e) {}
      return handleApiError(error, 'getOrder');
    }
  },

  createOrder: async (data) => {
    try {
      return await api.post('/orders', data);
    } catch (error) {
      if (!navigator.onLine) {
        console.warn('Offline mode: Saving order to queue');
        const tempOrder = {
          ...data,
          tempId: `temp_${Date.now()}`,
          timestamp: new Date().toISOString(),
          status: 'pending',
          isOffline: true
        };
        await dbService.put('offline_orders', tempOrder);
        return { success: true, data: tempOrder, message: 'Order saved offline' };
      }
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
      console.warn('Network request failed, trying offline DB for customers');
      const cachedCustomers = await dbService.getAll('customers');
      if (cachedCustomers && cachedCustomers.length > 0) {
        return { success: true, data: cachedCustomers, message: 'Loaded from offline cache' };
      }
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
      const res = await api.post('/customers', data);
      if (res && res.success && res.data) {
        try { (await import('../services/db')).dbService.put('customers', res.data); } catch (e) {}
      }
      return res;
    } catch (error) {
      if (!navigator.onLine) {
        console.warn('Offline: queuing customer create and saving locally');
        const id = `temp_customer_${Date.now()}`;
        const temp = { ...data, id, _id: id, isOffline: true, createdAt: new Date().toISOString() };
        try { await (await import('../services/db')).dbService.put('customers', temp); } catch (e) { console.warn('Failed to store temp customer', e); }
        await (await import('../services/outbox')).outboxService.enqueue({ url: (await import('../config/api.config')).API_CONFIG.API_URL + '/customers', method: 'POST', body: temp });
        return { success: true, queued: true, data: temp, message: 'Queued customer create (offline)' };
      }
      return handleApiError(error, 'createCustomer');
    }
  },

  updateCustomer: async (id, data) => {
    try {
      const res = await api.put(`/customers/${id}`, data);
      if (res && res.success && res.data) {
        try { (await import('../services/db')).dbService.put('customers', res.data); } catch (e) {}
      }
      return res;
    } catch (error) {
      if (!navigator.onLine) {
        console.warn('Offline: queuing customer update and applying locally');
        const local = { ...(data || {}), id, _id: id, updatedAt: new Date().toISOString(), isOfflineUpdate: true };
        try { await (await import('../services/db')).dbService.put('customers', local); } catch (e) { console.warn('Failed to update local customer', e); }
        await (await import('../services/outbox')).outboxService.enqueue({ url: (await import('../config/api.config')).API_CONFIG.API_URL + `/customers/${id}`, method: 'PUT', body: data });
        return { success: true, queued: true, data: local, message: 'Queued customer update (offline)' };
      }
      return handleApiError(error, 'updateCustomer');
    }
  },

  deleteCustomer: async (id) => {
    try {
      const res = await api.delete(`/customers/${id}`);
      if (res && res.success) { try { (await import('../services/db')).dbService.delete('customers', id); } catch (e) {} }
      return res;
    } catch (error) {
      if (!navigator.onLine) {
        console.warn('Offline: queuing customer delete and marking locally');
        try { const existing = await (await import('../services/db')).dbService.get('customers', id); if (existing) { existing._deleted = true; await (await import('../services/db')).dbService.put('customers', existing); } } catch (e) { console.warn('Failed to mark local customer deleted', e); }
        await (await import('../services/outbox')).outboxService.enqueue({ url: (await import('../config/api.config')).API_CONFIG.API_URL + `/customers/${id}`, method: 'DELETE' });
        return { success: true, queued: true, message: 'Queued customer delete (offline)' };
      }
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

  getDailySales: async (period = 'today') => {
    try {
      return await api.get('/dashboard/revenue', { params: { period } });
    } catch (error) {
      return handleApiError(error, 'getDailySales');
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
      console.warn('Network failed; loading inventory from IDB');
      try { const cached = await (await import('../services/db')).dbService.getAll('inventory'); return { success: true, data: cached || [], message: 'Loaded from offline cache' }; } catch (e) { return handleApiError(error, 'getInventory'); }
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
      console.warn('Network request failed, trying offline DB for tables');
      const cachedTables = await dbService.getAll('tables');
      if (cachedTables && cachedTables.length > 0) {
        return { success: true, data: cachedTables, message: 'Loaded from offline cache' };
      }
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
      console.warn('Network failed; loading expenses from IDB');
      try { const cached = await (await import('../services/db')).dbService.getAll('expenses'); return { success: true, data: cached || [], message: 'Loaded from offline cache' }; } catch (e) { return handleApiError(error, 'getExpenses'); }
    }
  },

  getExpense: async (id) => {
    try {
      return await api.get(`/expenses/${id}`);
    } catch (error) {
      try { const cached = await (await import('../services/db')).dbService.get('expenses', id); if (cached) return { success: true, data: cached, message: 'Loaded from offline cache' }; } catch (e) {}
      return handleApiError(error, 'getExpense');
    }
  },

  createExpense: async (data) => {
    try {
      const res = await api.post('/expenses', data);
      if (res && res.success && res.data) { try { (await import('../services/db')).dbService.put('expenses', res.data); } catch (e) {} }
      return res;
    } catch (error) {
      if (!navigator.onLine) {
        console.warn('Offline: queuing expense create and saving locally');
        const id = `temp_expense_${Date.now()}`;
        const temp = { ...data, id, _id: id, isOffline: true, createdAt: new Date().toISOString() };
        try { await (await import('../services/db')).dbService.put('expenses', temp); } catch (e) { console.warn('Failed to store temp expense', e); }
        await (await import('../services/outbox')).outboxService.enqueue({ url: (await import('../config/api.config')).API_CONFIG.API_URL + '/expenses', method: 'POST', body: temp });
        return { success: true, queued: true, data: temp, message: 'Queued expense create (offline)' };
      }
      return handleApiError(error, 'createExpense');
    }
  },

  updateExpense: async (id, data) => {
    try {
      const res = await api.put(`/expenses/${id}`, data);
      if (res && res.success && res.data) { try { (await import('../services/db')).dbService.put('expenses', res.data); } catch (e) {} }
      return res;
    } catch (error) {
      if (!navigator.onLine) {
        console.warn('Offline: queuing expense update and applying locally');
        const local = { ...(data || {}), id, _id: id, updatedAt: new Date().toISOString(), isOfflineUpdate: true };
        try { await (await import('../services/db')).dbService.put('expenses', local); } catch (e) { console.warn('Failed to update local expense', e); }
        await (await import('../services/outbox')).outboxService.enqueue({ url: (await import('../config/api.config')).API_CONFIG.API_URL + `/expenses/${id}`, method: 'PUT', body: data });
        return { success: true, queued: true, data: local, message: 'Queued expense update (offline)' };
      }
      return handleApiError(error, 'updateExpense');
    }
  },

  deleteExpense: async (id) => {
    try {
      const res = await api.delete(`/expenses/${id}`);
      if (res && res.success) { try { (await import('../services/db')).dbService.delete('expenses', id); } catch (e) {} }
      return res;
    } catch (error) {
      if (!navigator.onLine) {
        console.warn('Offline: queuing expense delete and marking locally');
        try { const existing = await (await import('../services/db')).dbService.get('expenses', id); if (existing) { existing._deleted = true; await (await import('../services/db')).dbService.put('expenses', existing); } } catch (e) { console.warn('Failed to mark local expense deleted', e); }
        await (await import('../services/outbox')).outboxService.enqueue({ url: (await import('../config/api.config')).API_CONFIG.API_URL + `/expenses/${id}`, method: 'DELETE' });
        return { success: true, queued: true, message: 'Queued expense delete (offline)' };
      }
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
      console.warn('Network failed; loading transactions from IDB');
      try { const cached = await (await import('../services/db')).dbService.getAll('transactions'); return { success: true, data: cached || [], message: 'Loaded from offline cache' }; } catch (e) { return handleApiError(error, 'getTransactions'); }
    }
  },

  getTransaction: async (id) => {
    try {
      return await api.get(`/finance/transactions/${id}`);
    } catch (error) {
      try { const cached = await (await import('../services/db')).dbService.get('transactions', id); if (cached) return { success: true, data: cached, message: 'Loaded from offline cache' }; } catch (e) {}
      return handleApiError(error, 'getTransaction');
    }
  },

  createTransaction: async (data) => {
    try {
      const res = await api.post('/finance/transactions', data);
      if (res && res.success && res.data) { try { (await import('../services/db')).dbService.put('transactions', res.data); } catch (e) {} }
      return res;
    } catch (error) {
      if (!navigator.onLine) {
        console.warn('Offline: queuing transaction create and saving locally');
        const id = `temp_txn_${Date.now()}`;
        const temp = { ...data, id, _id: id, isOffline: true, createdAt: new Date().toISOString() };
        try { await (await import('../services/db')).dbService.put('transactions', temp); } catch (e) { console.warn('Failed to store temp transaction', e); }
        await (await import('../services/outbox')).outboxService.enqueue({ url: (await import('../config/api.config')).API_CONFIG.API_URL + '/finance/transactions', method: 'POST', body: temp });
        return { success: true, queued: true, data: temp, message: 'Queued transaction create (offline)' };
      }
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
      console.warn('Network failed; loading purchases from IDB for report');
      try {
        const purchases = await (await import('../services/db')).dbService.getAll('purchases');
        return { success: true, data: purchases || [], message: 'Loaded offline purchases' };
      } catch (e) {
        return handleApiError(error, 'getPurchaseReports');
      }
    }
  },

  getInventoryReport: async (params = {}) => {
    try {
      return await api.get('/reports/inventory', { params });
    } catch (error) {
      console.warn('Network failed; computing inventory report from local data');
      try {
        const products = await (await import('../services/db')).dbService.getAll('products');
        const orders = (await (await import('../services/db')).dbService.getAll('orders')) || (await (await import('../services/db')).dbService.getAll('offline_orders')) || [];

        // Calculate product usage
        const productUsage = {};
        orders.forEach(order => {
          if (order.items && Array.isArray(order.items)) {
            order.items.forEach(item => {
              const productId = item.product?._id || item.product;
              if (!productUsage[productId]) productUsage[productId] = 0;
              productUsage[productId] += item.quantity || 1;
            });
          }
        });

        const inventoryData = (products || []).map(product => ({
          ...product,
          usage: productUsage[product._id] || 0,
          stockStatus: ((product.stock || 0) <= (product.lowStockThreshold || 10)) ? 'low' : 'ok',
          reorderNeeded: (product.stock || 0) <= (product.lowStockThreshold || 10),
          value: (product.stock || 0) * (product.costPrice || product.cost || 0)
        }));

        return { success: true, data: { inventory: inventoryData }, message: 'Computed inventory report from local data' };
      } catch (e) {
        return handleApiError(error, 'getInventoryReport');
      }
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
      console.warn('Network failed; loading users from IDB');
      try {
        const cached = await (await import('../services/db')).dbService.getAll('users');
        return { success: true, data: cached || [], message: 'Loaded from offline cache' };
      } catch (e) {
        return handleApiError(error, 'getUsers');
      }
    }
  },

  getUser: async (id) => {
    try {
      return await api.get(`/users/${id}`);
    } catch (error) {
      console.warn('Network failed; loading user from IDB', id);
      try {
        const cached = await (await import('../services/db')).dbService.get(id);
        if (cached) return { success: true, data: cached, message: 'Loaded from offline cache' };
        const all = await (await import('../services/db')).dbService.getAll('users');
        const found = (all || []).find(u => u.id === id || u._id === id);
        if (found) return { success: true, data: found, message: 'Loaded from offline cache' };
      } catch (e) {}
      return handleApiError(error, 'getUser');
    }
  },

  createUser: async (data) => {
    try {
      const res = await api.post('/users', data);
      if (res && res.success && res.data) {
        try { (await import('../services/db')).dbService.put('users', res.data); } catch (e) {}
      }
      return res;
    } catch (error) {
      if (!navigator.onLine) {
        console.warn('Offline: creating user locally and queuing for sync');
        try {
          const id = `local-${Date.now()}`;
          const { hashPassword } = await import('../services/password');
          const pwdHash = data.password ? await hashPassword(data.password) : null;
          const record = {
            id,
            _id: id,
            name: data.name || data.fullName || data.username,
            email: data.email || data.username,
            username: data.username || data.email,
            role: data.role || 'staff',
            phone: data.phone || null,
            address: data.address || null,
            passwordHash: pwdHash,
            createdAt: new Date().toISOString(),
            isLocal: true
          };
          await (await import('../services/db')).dbService.put('users', record);

          // Update local users cache so UI updates immediately
          try {
            const key = 'users_list';
            const raw = localStorage.getItem(key);
            if (raw) {
              try {
                const parsed = JSON.parse(raw);
                const arr = Array.isArray(parsed.data) ? parsed.data : (Array.isArray(parsed) ? parsed : []);
                const next = [{ _id: id, ...record }, ...arr];
                localStorage.setItem(key, JSON.stringify({ timestamp: Date.now(), data: next }));
              } catch (e) {
                localStorage.setItem(key, JSON.stringify({ timestamp: Date.now(), data: [{ _id: id, ...record }] }));
              }
            } else {
              localStorage.setItem(key, JSON.stringify({ timestamp: Date.now(), data: [{ _id: id, ...record }] }));
            }
            try { window.dispatchEvent(new Event('users-updated')); } catch (e) { }
          } catch (e) { console.warn('Failed to update local users cache', e); }

          // Enqueue an outbox entry so the server can be created when back online
          await (await import('../services/outbox')).outboxService.enqueue({
            url: (await import('../config/api.config')).API_CONFIG.API_URL + '/users',
            method: 'POST',
            body: { ...data }
          });

          return { success: true, queued: true, data: { _id: id, ...record }, message: 'Created user locally and queued for sync' };
        } catch (e) {
          console.warn('Failed to create local user', e);
          return handleApiError(error, 'createUser');
        }
      }
      return handleApiError(error, 'createUser');
    }
  },

  updateUser: async (id, data) => {
    try {
      const res = await api.put(`/users/${id}`, data);
      if (res && res.success && res.data) {
        try { (await import('../services/db')).dbService.put('users', res.data); } catch (e) {}
      }
      return res;
    } catch (error) {
      if (!navigator.onLine) {
        console.warn('Offline: queuing user update and applying locally');
        try {
          // If password is being updated, hash it for local login
          let pwdHash = null;
          if (data && data.password) {
            const { hashPassword } = await import('../services/password');
            pwdHash = await hashPassword(data.password);
          }

          const local = { ...(data || {}), id, _id: id, updatedAt: new Date().toISOString(), isOfflineUpdate: true };
          // Merge with existing record if present
          const existing = (await (await import('../services/db')).dbService.get('users', id)) || {};
          const merged = { ...existing, ...local };
          if (pwdHash) {
            merged.passwordHash = pwdHash;
            // Do not store plain password locally
            delete merged.password;
          }

          await (await import('../services/db')).dbService.put('users', merged);
          await (await import('../services/outbox')).outboxService.enqueue({
            url: (await import('../config/api.config')).API_CONFIG.API_URL + `/users/${id}`,
            method: 'PUT',
            body: data
          });
          return { success: true, queued: true, data: merged, message: 'Queued user update (offline)' };
        } catch (e) {
          console.warn('Failed to apply local user update', e);
          return handleApiError(error, 'updateUser');
        }
      }
      return handleApiError(error, 'updateUser');
    }
  },

  deleteUser: async (id) => {
    try {
      const res = await api.delete(`/users/${id}`);
      if (res && res.success) { try { (await import('../services/db')).dbService.delete('users', id); } catch (e) {} }
      return res;
    } catch (error) {
      if (!navigator.onLine) {
        console.warn('Offline: queuing user delete');
        try {
          // If it's a local-only user, just delete it locally
          if (String(id).startsWith('local-')) {
            await (await import('../services/db')).dbService.delete('users', id);
          } else {
            const record = await (await import('../services/db')).dbService.get('users', id) || { id, _id: id };
            record.isDeleted = true;
            await (await import('../services/db')).dbService.put('users', record);
            await (await import('../services/outbox')).outboxService.enqueue({
              url: (await import('../config/api.config')).API_CONFIG.API_URL + `/users/${id}`,
              method: 'DELETE',
              body: {}
            });
          }
          return { success: true, queued: true, data: { _id: id }, message: 'Queued user delete (offline)' };
        } catch (e) {
          console.warn('Failed to queue user delete', e);
          return handleApiError(error, 'deleteUser');
        }
      }
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
  getDailySales: dashboardAPI.getDailySales,
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
