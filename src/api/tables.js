import api from './auth';

export const tableAPI = {
  getTables: (params = {}) => 
    api.get('/tables', { params }),
  
  getTable: (id) => 
    api.get(`/tables/${id}`),
  
  createTable: (tableData) => 
    api.post('/tables', tableData),
  
  updateTable: (id, tableData) => 
    api.put(`/tables/${id}`, tableData),
  
  deleteTable: (id) => 
    api.delete(`/tables/${id}`),
  
  updateTableStatus: (id, statusData) => 
    api.put(`/tables/${id}/status`, statusData),
  
  assignOrderToTable: (id, orderId) => 
    api.put(`/tables/${id}/assign-order`, { orderId }),
  
  getTableStats: () => 
    api.get('/tables/stats'),
  
  getTablesByLocation: () => 
    api.get('/tables/by-location')
};