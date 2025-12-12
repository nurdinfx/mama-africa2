import React from 'react';

const TableList = ({ tables, onEditTable, onStatusChange, onDeleteTable }) => {
  const getStatusBadge = (status) => {
    const colors = {
      available: 'bg-green-100 text-green-800',
      occupied: 'bg-red-100 text-red-800',
      reserved: 'bg-yellow-100 text-yellow-800',
      cleaning: 'bg-blue-100 text-blue-800',
      maintenance: 'bg-gray-100 text-gray-800'
    };
    return `px-3 py-1 rounded-full text-sm font-medium ${colors[status]}`;
  };

  const getLocationBadge = (location) => {
    return `px-2 py-1 rounded text-xs bg-gray-100 text-gray-700 capitalize`;
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Table
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Capacity
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Location
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Current Session
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Order
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {tables.map((table) => (
            <tr key={table._id} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap">
                <div>
                  <div className="text-sm font-medium text-gray-900">
                    {table.name}
                  </div>
                  <div className="text-sm text-gray-500">
                    #{table.tableNumber}
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm text-gray-900">{table.capacity}</div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className={getLocationBadge(table.location)}>
                  {table.location}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className={getStatusBadge(table.status)}>
                  {table.status}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                {table.currentSession ? (
                  <div className="text-sm text-gray-900">
                    <div>Customers: {table.currentSession.customers}</div>
                    {table.currentSession.waiter && (
                      <div className="text-xs text-gray-500">
                        Waiter: {table.currentSession.waiter.name}
                      </div>
                    )}
                  </div>
                ) : (
                  <span className="text-sm text-gray-400">No session</span>
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                {table.currentOrder ? (
                  <span className="text-sm text-blue-600 font-medium">
                    #{table.currentOrder.orderNumber}
                  </span>
                ) : (
                  <span className="text-sm text-gray-400">No order</span>
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <div className="flex space-x-2">
                  <button
                    onClick={() => onStatusChange(table)}
                    className="text-blue-600 hover:text-blue-900"
                  >
                    Status
                  </button>
                  <button
                    onClick={() => onEditTable(table)}
                    className="text-gray-600 hover:text-gray-900"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => onDeleteTable(table._id)}
                    className="text-red-600 hover:text-red-900"
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      
      {tables.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">No tables found</p>
          <p className="text-gray-400">Try adjusting your filters</p>
        </div>
      )}
    </div>
  );
};

export default TableList;