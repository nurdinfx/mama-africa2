// src/pages/Tables.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { realApi } from '../api/realApi';

import { useOptimisticData } from '../hooks/useOptimisticData';

const Tables = ({ isPosMode = false }) => {
  // Optimistic data fetching
  const {
    data: tables,
    loading,
    error: hookError,
    refresh: loadTables,
    setData: setTables // Expose setter for optimistic updates
  } = useOptimisticData('tables_list', async () => {
    console.log('🔄 Loading tables from backend...');
    const response = await realApi.getTables();
    if (response.success) {
      return realApi.extractData(response) || [];
    }
    throw new Error(response.message || 'Failed to load tables');
  }, []);

  const [filteredTables, setFilteredTables] = useState([]);
  // const [loading, setLoading] = useState(true); // Handled by hook
  const [showModal, setShowModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [editingTable, setEditingTable] = useState(null);
  const [selectedTable, setSelectedTable] = useState(null);
  const [filters, setFilters] = useState({
    status: '',
    location: '',
    search: ''
  });
  const [error, setError] = useState('');

  const { user } = useAuth();

  // Sync hook error
  useEffect(() => {
    if (hookError) setError(hookError.message);
  }, [hookError]);

  // Initial load handled by hook
  // useEffect(() => {
  //   loadTables();
  // }, []);

  useEffect(() => {
    filterTables();
  }, [tables, filters]);

  // loadTables function replaced by hook's refresh
  /* 
  const loadTables = async () => {
    try {
      setLoading(true);
      // ... original logic ...
    } finally {
      setLoading(false);
    }
  };
  */

  const filterTables = () => {
    let filtered = Array.isArray(tables) ? tables : [];

    if (filters.status) {
      filtered = filtered.filter(table => table.status === filters.status);
    }

    if (filters.location) {
      filtered = filtered.filter(table => table.location === filters.location);
    }

    if (filters.search) {
      filtered = filtered.filter(table =>
        table.number?.toLowerCase().includes(filters.search.toLowerCase()) ||
        table.tableNumber?.toLowerCase().includes(filters.search.toLowerCase()) ||
        table.name?.toLowerCase().includes(filters.search.toLowerCase())
      );
    }

    setFilteredTables(filtered);
  };

  const handleSaveTable = async (tableData) => {
    try {
      console.log('💾 Saving table:', tableData);

      let response;

      if (editingTable) {
        response = await realApi.updateTable(editingTable._id, tableData);
      } else {
        response = await realApi.createTable(tableData);
      }

      if (response.success) {
        // Instead of reloading, add the new table to local state immediately
        if (editingTable) {
          // Update existing table in local state
          setTables(prev => prev.map(t =>
            t._id === editingTable._id
              ? { ...t, ...tableData, updatedAt: new Date().toISOString(), isOfflineUpdate: response.queued ? true : t.isOfflineUpdate }
              : t
          ));
        } else {
          // Add new table to local state with proper structure
          const newTable = {
            _id: response.data?._id || `table-${Date.now()}`,
            id: response.data?.id || response.data?._id || `table-${Date.now()}`,
            number: tableData.tableNumber,
            tableNumber: tableData.tableNumber,
            name: tableData.name,
            capacity: parseInt(tableData.capacity),
            location: tableData.location,
            status: 'available',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            isLocal: response.queued ? true : false,
            ...response.data // Include any additional data from backend
          };
          setTables(prev => [...prev, newTable]);
        }

        setShowModal(false);
        setEditingTable(null);
        if (response.queued) alert(response.message || 'Table saved locally and will sync when online'); else alert(`Table ${editingTable ? 'updated' : 'created'} successfully!`);
      } else {
        throw new Error(response.message || 'Failed to save table');
      }
    } catch (error) {
      console.error('❌ Failed to save table:', error);
      alert('Failed to save table: ' + error.message);
    }
  };

  const handleUpdateStatus = async (statusData) => {
    try {
      console.log('🔄 Updating table status:', statusData);

      const response = await realApi.updateTableStatus(selectedTable._id, statusData);

      if (response.success) {
        // Update local state immediately
        setTables(prev => prev.map(t =>
          t._id === selectedTable._id
            ? {
              ...t,
              status: statusData.status,
              updatedAt: new Date().toISOString(),
              currentSession: statusData.status === 'occupied' ? {
                startedAt: new Date().toISOString(),
                customers: statusData.customers || 1,
                waiter: {
                  _id: user?._id || 'system',
                  name: user?.name || 'System'
                }
              } : null
            }
            : t
        ));

        setShowStatusModal(false);
        setSelectedTable(null);
        alert('Table status updated successfully!');
      } else {
        throw new Error(response.message || 'Failed to update table status');
      }
    } catch (error) {
      console.error('❌ Failed to update table status:', error);
      alert('Failed to update table status: ' + error.message);
    }
  };

  const handleDeleteTable = async (tableId) => {
    if (window.confirm('Are you sure you want to delete this table?')) {
      try {
        const response = await realApi.deleteTable(tableId);

        if (response.success) {
          // If queued (offline), mark as deleted locally; otherwise remove
          if (response.queued) {
            setTables(prev => prev.map(t => t._id === tableId ? { ...t, isDeleted: true } : t));
            alert(response.message || 'Table delete queued (offline)');
          } else {
            setTables(prev => prev.filter(t => t._id !== tableId));
            alert('Table deleted successfully!');
          }
        } else {
          throw new Error(response.message || 'Failed to delete table');
        }
      } catch (error) {
        console.error('❌ Failed to delete table:', error);
        alert('Failed to delete table: ' + error.message);
      }
    }
  };

  // ... (keep helpers)
  const getStatusColor = (status) => {
    const colors = {
      available: 'bg-green-100 text-green-800 border-green-200',
      occupied: 'bg-red-100 text-red-800 border-red-200',
      reserved: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      cleaning: 'bg-blue-100 text-blue-800 border-blue-200',
      maintenance: 'bg-gray-100 text-gray-800 border-gray-200'
    };
    return colors[status] || colors.available;
  };

  const getLocationColor = (location) => {
    const colors = {
      indoor: 'border-blue-300 bg-blue-50',
      outdoor: 'border-green-300 bg-green-50',
      terrace: 'border-yellow-300 bg-yellow-50',
      vip: 'border-purple-300 bg-purple-50'
    };
    return colors[location] || 'border-gray-300 bg-gray-50';
  };

  const getStatusStats = () => {
    const tablesArray = Array.isArray(tables) ? tables : [];

    const stats = {
      total: tablesArray.length,
      available: tablesArray.filter(t => t.status === 'available').length,
      occupied: tablesArray.filter(t => t.status === 'occupied').length,
      reserved: tablesArray.filter(t => t.status === 'reserved').length,
      cleaning: tablesArray.filter(t => t.status === 'cleaning').length,
      maintenance: tablesArray.filter(t => t.status === 'maintenance').length
    };

    return stats;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return 'Invalid Date';
    }
  };

  const getSessionDuration = (startedAt) => {
    if (!startedAt) return null;
    try {
      const start = new Date(startedAt);
      const now = new Date();
      const diffMs = now - start;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);

      if (diffHours > 0) {
        return `${diffHours}h ${diffMins % 60}m`;
      }
      return `${diffMins}m`;
    } catch (error) {
      return null;
    }
  };

  const statusStats = getStatusStats();

  if (loading) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-[#f4f7fb]">
        <div className="flex items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          <p className="ml-4 text-gray-600">Loading tables...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-content flex flex-col gap-6 h-full overflow-auto">
      {!isPosMode && (
        <div className="card bg-gradient-to-r from-blue-600 to-blue-700 text-white border-0 shadow-lg">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="heading-1 text-white mb-2">Table Management</h1>
              <p className="text-blue-100">Total tables: {tables.length} · Status synced with active orders</p>
              {error && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                  {error}
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={loadTables}
                className="bg-white/20 text-white border border-white/30 px-4 py-2 rounded-lg font-medium hover:bg-white/30 transition-colors"
              >
                🔄 Refresh
              </button>
              <button
                onClick={() => {
                  setEditingTable(null);
                  setShowModal(true);
                }}
                className="bg-white text-blue-600 px-4 py-2 rounded-lg font-medium shadow-sm hover:bg-blue-50 transition-colors"
              >
                + Add Table
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-blue-500">
          <div className="text-2xl font-bold text-gray-900">{statusStats.total}</div>
          <div className="text-sm text-gray-600">Total Tables</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-green-500">
          <div className="text-2xl font-bold text-green-600">{statusStats.available}</div>
          <div className="text-sm text-gray-600">Available</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-red-500">
          <div className="text-2xl font-bold text-red-600">{statusStats.occupied}</div>
          <div className="text-sm text-gray-600">Occupied</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-yellow-500">
          <div className="text-2xl font-bold text-yellow-600">{statusStats.reserved}</div>
          <div className="text-sm text-gray-600">Reserved</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-blue-300">
          <div className="text-2xl font-bold text-blue-600">{statusStats.cleaning}</div>
          <div className="text-sm text-gray-600">Cleaning</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-gray-500">
          <div className="text-2xl font-bold text-gray-600">{statusStats.maintenance}</div>
          <div className="text-sm text-gray-600">Maintenance</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="">All Status</option>
              <option value="available">Available</option>
              <option value="occupied">Occupied</option>
              <option value="reserved">Reserved</option>
              <option value="cleaning">Cleaning</option>
              <option value="maintenance">Maintenance</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
            <select
              value={filters.location}
              onChange={(e) => setFilters(prev => ({ ...prev, location: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="">All Locations</option>
              <option value="indoor">Indoor</option>
              <option value="outdoor">Outdoor</option>
              <option value="terrace">Terrace</option>
              <option value="vip">VIP</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <input
              type="text"
              placeholder="Search tables..."
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>

          <div className="flex items-end space-x-2">
            <button
              onClick={() => setFilters({ status: '', location: '', search: '' })}
              className="flex-1 bg-gray-500 hover:bg-gray-600 text-white py-2 px-4 rounded-lg"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Tables Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredTables.map((table) => (
          <div
            key={table._id}
            className={`border-2 rounded-lg p-4 cursor-pointer transition-all hover:shadow-lg ${getLocationColor(table.location)}`}
            onClick={() => {
              setSelectedTable(table);
              setShowStatusModal(true);
            }}
          >
            {/* Status Indicator */}
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center">
                <div
                  className={`w-3 h-3 rounded-full mr-2 ${table.status === 'available' ? 'bg-green-500' :
                    table.status === 'occupied' ? 'bg-red-500' :
                      table.status === 'reserved' ? 'bg-yellow-500' :
                        table.status === 'cleaning' ? 'bg-blue-500' :
                          'bg-gray-500'
                    }`}
                ></div>
                <span className="text-sm font-medium capitalize text-gray-600">
                  {table.status}
                </span>
              </div>
              <span className="text-xs bg-gray-100 px-2 py-1 rounded capitalize">
                {table.location}
              </span>
            </div>

            {/* Table Info */}
            <div className="text-left mb-4">
              <h3 className="text-xl font-bold text-gray-900">
                <div className="flex items-center gap-2">
                  <span>{table.name || `Table ${table.number || table.tableNumber}`}</span>
                  {table.isLocal && (
                    <span className="px-2 py-0.5 rounded text-xs bg-yellow-100 text-yellow-800">Local</span>
                  )}
                  {table.isOfflineUpdate && (
                    <span className="px-2 py-0.5 rounded text-xs bg-orange-100 text-orange-800">Pending</span>
                  )}
                  {table.isDeleted && (
                    <span className="px-2 py-0.5 rounded text-xs bg-red-100 text-red-800">Deleted</span>
                  )}
                </div>
              </h3>
              <p className="text-gray-600">Table {table.number || table.tableNumber}</p>
              <p className="text-sm text-gray-500">
                Capacity: {table.capacity} people
              </p>
              {table.createdAt && (
                <p className="text-xs text-gray-400 mt-1">
                  Created: {formatDate(table.createdAt)}
                </p>
              )}
              {table.updatedAt && table.updatedAt !== table.createdAt && (
                <p className="text-xs text-gray-400">
                  Updated: {formatDate(table.updatedAt)}
                </p>
              )}
            </div>

            {/* Current Session Info */}
            {table.currentSession && (
              <div className="bg-gray-50 rounded p-3 mb-3 border">
                <p className="text-sm text-gray-600">
                  <strong>Customers:</strong> {table.currentSession.customers}
                </p>
                {table.currentSession.waiter && (
                  <p className="text-sm text-gray-600">
                    <strong>Waiter:</strong> {table.currentSession.waiter.name}
                  </p>
                )}
                {table.currentSession.startedAt && (
                  <p className="text-sm text-gray-600">
                    <strong>Duration:</strong> {getSessionDuration(table.currentSession.startedAt)}
                  </p>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-between space-x-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedTable(table);
                  setShowStatusModal(true);
                }}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-3 rounded text-sm font-medium"
              >
                Status
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingTable(table);
                  setShowModal(true);
                }}
                className="bg-gray-600 hover:bg-gray-700 text-white py-2 px-3 rounded text-sm font-medium"
              >
                Edit
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteTable(table._id);
                }}
                className="bg-red-600 hover:bg-red-700 text-white py-2 px-3 rounded text-sm font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredTables.length === 0 && !loading && (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500 text-lg">No tables found</p>
          <p className="text-gray-400 mt-2">Try adjusting your filters or add new tables</p>
          <button
            onClick={() => {
              setEditingTable(null);
              setShowModal(true);
            }}
            className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium"
          >
            + Add Your First Table
          </button>
        </div>
      )}

      {/* Table Modal */}
      {showModal && (
        <TableModal
          table={editingTable}
          onClose={() => {
            setShowModal(false);
            setEditingTable(null);
          }}
          onSave={handleSaveTable}
        />
      )}

      {/* Status Modal */}
      {showStatusModal && selectedTable && (
        <StatusModal
          table={selectedTable}
          onClose={() => {
            setShowStatusModal(false);
            setSelectedTable(null);
          }}
          onSave={handleUpdateStatus}
        />
      )}
    </div>
  );
};

// Table Modal Component
const TableModal = ({ table, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    tableNumber: '',
    name: '',
    capacity: 4,
    location: 'indoor'
  });

  useEffect(() => {
    if (table) {
      setFormData({
        tableNumber: table.tableNumber || table.number || '',
        name: table.name || '',
        capacity: table.capacity || 4,
        location: table.location || 'indoor'
      });
    } else {
      setFormData({
        tableNumber: '',
        name: '',
        capacity: 4,
        location: 'indoor'
      });
    }
  }, [table]);

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!formData.tableNumber.trim()) {
      alert('Please enter a table number');
      return;
    }
    if (!formData.name.trim()) {
      alert('Please enter a table name');
      return;
    }
    if (formData.capacity < 1) {
      alert('Capacity must be at least 1');
      return;
    }

    onSave(formData);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'capacity' ? parseInt(value) || 1 : value
    }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-900">
              {table ? 'Edit Table' : 'Add New Table'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Table Number *
              </label>
              <input
                type="text"
                name="tableNumber"
                value={formData.tableNumber}
                onChange={handleChange}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                placeholder="e.g., T01"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Table Name *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                placeholder="e.g., Window Table 1"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Capacity *
              </label>
              <input
                type="number"
                name="capacity"
                value={formData.capacity}
                onChange={handleChange}
                min="1"
                max="20"
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Location
              </label>
              <select
                name="location"
                value={formData.location}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="indoor">Indoor</option>
                <option value="outdoor">Outdoor</option>
                <option value="terrace">Terrace</option>
                <option value="vip">VIP</option>
              </select>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {table ? 'Update' : 'Create'} Table
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// Status Modal Component
const StatusModal = ({ table, onClose, onSave }) => {
  const [statusData, setStatusData] = useState({
    status: 'available',
    customers: 1
  });

  useEffect(() => {
    if (table) {
      setStatusData({
        status: table.status || 'available',
        customers: table.currentSession?.customers || 1
      });
    }
  }, [table]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(statusData);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setStatusData(prev => ({
      ...prev,
      [name]: name === 'customers' ? parseInt(value) || 1 : value
    }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-900">
              Update Table Status
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>

          <div className="mb-4">
            <p className="text-gray-600">
              Table: <strong>{table.name || `Table ${table.number || table.tableNumber}`}</strong> ({table.number || table.tableNumber})
            </p>
            <p className="text-gray-600">
              Capacity: <strong>{table.capacity} people</strong>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status *
              </label>
              <select
                name="status"
                value={statusData.status}
                onChange={handleChange}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="available">Available</option>
                <option value="occupied">Occupied</option>
                <option value="reserved">Reserved</option>
                <option value="cleaning">Cleaning</option>
                <option value="maintenance">Maintenance</option>
              </select>
            </div>

            {statusData.status === 'occupied' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Number of Customers *
                </label>
                <input
                  type="number"
                  name="customers"
                  value={statusData.customers}
                  onChange={handleChange}
                  min="1"
                  max={table.capacity}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Table capacity: {table.capacity} people
                </p>
              </div>
            )}

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Update Status
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Tables;
