import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';

const StatusModal = ({ isOpen, onClose, onSave, table }) => {
  const { user } = useAuth();
  const [statusData, setStatusData] = useState({
    status: 'available',
    customers: 1,
    waiterId: user?._id
  });

  useEffect(() => {
    if (table) {
      setStatusData({
        status: table.status,
        customers: table.currentSession?.customers || 1,
        waiterId: table.currentSession?.waiter?._id || user?._id
      });
    }
  }, [table, user, isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(statusData);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setStatusData(prev => ({ ...prev, [name]: value }));
  };

  if (!isOpen || !table) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full">
        <div className="p-6">
          <h2 className="text-2xl font-bold mb-2">
            Update Table Status
          </h2>
          <p className="text-gray-600 mb-4">
            Table {table.tableNumber} - {table.name}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status *
              </label>
              <select
                name="status"
                value={statusData.status}
                onChange={handleChange}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="available">Available</option>
                <option value="occupied">Occupied</option>
                <option value="reserved">Reserved</option>
                <option value="cleaning">Cleaning</option>
                <option value="maintenance">Maintenance</option>
              </select>
            </div>

            {/* Customers (only show for occupied status) */}
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
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Table capacity: {table.capacity} people
                </p>
              </div>
            )}

            {/* Waiter (only show for occupied status) */}
            {statusData.status === 'occupied' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Assigned Waiter
                </label>
                <input
                  type="text"
                  value={user?.name || 'Current User'}
                  disabled
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-100"
                />
                <input type="hidden" name="waiterId" value={user?._id} />
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
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

export default StatusModal;