import api from './auth';

export const tableAPI = {
  getTables: async (params = {}) => {
    try {
      return await api.get('/tables', { params });
    } catch (error) {
      console.warn('Network failed, loading tables from IDB');
      const cached = await (await import('../services/db')).dbService.getAll('tables');
      return { success: true, data: cached || [], message: 'Loaded from offline cache' };
    }
  },

  getTable: async (id) => {
    try {
      return await api.get(`/tables/${id}`);
    } catch (error) {
      const cached = await (await import('../services/db')).dbService.get('tables', id);
      if (cached) return { success: true, data: cached, message: 'Loaded from offline cache' };
      return { success: false, message: 'Table not available offline', status: 404 };
    }
  },

  createTable: async (tableData) => {
    try {
      const res = await api.post('/tables', tableData);
      if (res && res.success && res.data) { try { (await import('../services/db')).dbService.put('tables', res.data); } catch (e) {} }
      return res;
    } catch (error) {
      if (!navigator.onLine) {
        console.warn('Offline: queuing table create and saving locally');
        const id = `temp_table_${Date.now()}`;
        const temp = { ...tableData, id, _id: id, isOffline: true, createdAt: new Date().toISOString() };
        try { await (await import('../services/db')).dbService.put('tables', temp); } catch (e) { console.warn('Failed to store temp table', e); }
        await (await import('../services/outbox')).outboxService.enqueue({ url: (await import('../config/api.config')).API_CONFIG.API_URL + '/tables', method: 'POST', body: temp });
        return { success: true, queued: true, data: temp, message: 'Queued table create (offline)' };
      }
      throw error;
    }
  },

  updateTable: async (id, tableData) => {
    try {
      const res = await api.put(`/tables/${id}`, tableData);
      if (res && res.success && res.data) { try { (await import('../services/db')).dbService.put('tables', res.data); } catch (e) {} }
      return res;
    } catch (error) {
      if (!navigator.onLine) {
        console.warn('Offline: queuing table update and applying locally');
        const local = { ...(tableData || {}), id, _id: id, updatedAt: new Date().toISOString(), isOfflineUpdate: true };
        try { await (await import('../services/db')).dbService.put('tables', local); } catch (e) { console.warn('Failed to update local table', e); }
        await (await import('../services/outbox')).outboxService.enqueue({ url: (await import('../config/api.config')).API_CONFIG.API_URL + `/tables/${id}`, method: 'PUT', body: tableData });
        return { success: true, queued: true, data: local, message: 'Queued table update (offline)' };
      }
      throw error;
    }
  },

  deleteTable: async (id) => {
    try {
      const res = await api.delete(`/tables/${id}`);
      if (res && res.success) { try { (await import('../services/db')).dbService.delete('tables', id); } catch (e) {} }
      return res;
    } catch (error) {
      if (!navigator.onLine) {
        console.warn('Offline: queuing table delete and marking locally');
        try { const existing = await (await import('../services/db')).dbService.get('tables', id); if (existing) { existing._deleted = true; await (await import('../services/db')).dbService.put('tables', existing); } } catch (e) { console.warn('Failed to mark local table deleted', e); }
        await (await import('../services/outbox')).outboxService.enqueue({ url: (await import('../config/api.config')).API_CONFIG.API_URL + `/tables/${id}`, method: 'DELETE' });
        return { success: true, queued: true, message: 'Queued table delete (offline)' };
      }
      throw error;
    }
  },

  updateTableStatus: (id, statusData) => 
    api.put(`/tables/${id}/status`, statusData),
  
  assignOrderToTable: (id, orderId) => 
    api.put(`/tables/${id}/assign-order`, { orderId }),
  
  getTableStats: () => 
    api.get('/tables/stats'),
  
  getTablesByLocation: () => 
    api.get('/tables/by-location')
};