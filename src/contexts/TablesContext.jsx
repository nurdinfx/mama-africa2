import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const TablesContext = createContext();

export const useTables = () => {
  const context = useContext(TablesContext);
  if (!context) {
    throw new Error('useTables must be used within TablesProvider');
  }
  return context;
};

export const TablesProvider = ({ children }) => {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState(null);

  const fetchTables = async (filters = {}) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });

      const response = await axios.get(`/api/tables?${params}`);
      setTables(response.data.data.tables);
    } catch (error) {
      console.error('Error fetching tables:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const response = await axios.get('/api/tables/analytics/summary');
      setAnalytics(response.data.data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    }
  };

  const createTable = async (tableData) => {
    try {
      const response = await axios.post('/api/tables', tableData);
      await fetchTables();
      return { success: true, data: response.data.data.table };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error creating table'
      };
    }
  };

  const updateTable = async (tableId, tableData) => {
    try {
      const response = await axios.put(`/api/tables/${tableId}`, tableData);
      await fetchTables();
      return { success: true, data: response.data.data.table };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error updating table'
      };
    }
  };

  const deleteTable = async (tableId) => {
    try {
      await axios.delete(`/api/tables/${tableId}`);
      await fetchTables();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error deleting table'
      };
    }
  };

  const updateTableStatus = async (tableId, status) => {
    try {
      const response = await axios.post(`/api/tables/${tableId}/status`, { status });
      await fetchTables();
      return { success: true, data: response.data.data.table };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error updating table status'
      };
    }
  };

  useEffect(() => {
    fetchTables();
    fetchAnalytics();
  }, []);

  const value = {
    tables,
    loading,
    analytics,
    fetchTables,
    fetchAnalytics,
    createTable,
    updateTable,
    deleteTable,
    updateTableStatus
  };

  return (
    <TablesContext.Provider value={value}>
      {children}
    </TablesContext.Provider>
  );
};