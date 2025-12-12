import React from 'react';

const TableGrid = ({ tables, onEditTable, onStatusChange, onDeleteTable }) => {
  const getStatusColor = (status) => {
    const colors = {
      available: 'bg-green-500',
      occupied: 'bg-red-500',
      reserved: 'bg-yellow-500',
      cleaning: 'bg-blue-500',
      maintenance: 'bg-gray-500'
    };
    return colors[status] || 'bg-gray-300';
  };

  const getLocationColor = (location) => {
    const colors = {
      indoor: 'border-blue-300',
      outdoor: 'border-green-300',
      terrace: 'border-yellow-300',
      vip: 'border-purple-300'
    };
    return colors[location] || 'border-gray-300';
  };

  return (
    <div className="p-6">
      {tables.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">No tables found</p>
          <p className="text-gray-400">Try adjusting your filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {tables.map((table) => (
            <div
              key={table._id}
              className={`border-2 rounded-lg p-4 cursor-pointer transition-all hover:shadow-lg ${getLocationColor(
                table.location
              )}`}
              onClick={() => onStatusChange(table)}
            >
              {/* Status Indicator */}
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center">
                  <div
                    className={`w-3 h-3 rounded-full ${getStatusColor(
                      table.status
                    )} mr-2`}
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
              <div className="text-center mb-4">
                <h3 className="text-xl font-bold text-gray-900">
                  {table.name}
                </h3>
                <p className="text-gray-600">Table {table.tableNumber}</p>
                <p className="text-sm text-gray-500">
                  Capacity: {table.capacity} people
                </p>
              </div>

              {/* Current Session Info */}
              {table.currentSession && (
                <div className="bg-gray-50 rounded p-3 mb-3">
                  <p className="text-sm text-gray-600">
                    <strong>Customers:</strong> {table.currentSession.customers}
                  </p>
                  {table.currentSession.waiter && (
                    <p className="text-sm text-gray-600">
                      <strong>Waiter:</strong> {table.currentSession.waiter.name}
                    </p>
                  )}
                  {table.currentSession.startedAt && (
                    <p className="text-xs text-gray-500">
                      Started: {new Date(table.currentSession.startedAt).toLocaleTimeString()}
                    </p>
                  )}
                </div>
              )}

              {/* Current Order */}
              {table.currentOrder && (
                <div className="bg-blue-50 border border-blue-200 rounded p-2 mb-3">
                  <p className="text-sm font-medium text-blue-800">
                    Active Order
                  </p>
                  <p className="text-xs text-blue-600">
                    #{table.currentOrder.orderNumber}
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-between space-x-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onStatusChange(table);
                  }}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-3 rounded text-sm font-medium transition-colors"
                >
                  Status
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditTable(table);
                  }}
                  className="bg-gray-600 hover:bg-gray-700 text-white py-2 px-3 rounded text-sm font-medium transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteTable(table._id);
                  }}
                  className="bg-red-600 hover:bg-red-700 text-white py-2 px-3 rounded text-sm font-medium transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TableGrid;