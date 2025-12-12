import React from 'react';

const TableStats = ({ stats }) => {
  const statusDistribution = stats.statusDistribution || [];
  const totalTables = stats.totalTables || 0;
  const occupiedTables = stats.occupiedTables || 0;
  const utilizationRate = stats.utilizationRate || 0;

  const getStatusCount = (status) => {
    const statusObj = statusDistribution.find(s => s._id === status);
    return statusObj ? statusObj.count : 0;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      {/* Total Tables */}
      <div className="bg-white p-4 rounded-lg shadow border-l-4 border-blue-500">
        <h3 className="text-lg font-semibold text-gray-900">Total Tables</h3>
        <p className="text-3xl font-bold text-blue-600">{totalTables}</p>
      </div>

      {/* Occupied Tables */}
      <div className="bg-white p-4 rounded-lg shadow border-l-4 border-red-500">
        <h3 className="text-lg font-semibold text-gray-900">Occupied</h3>
        <p className="text-3xl font-bold text-red-600">{occupiedTables}</p>
      </div>

      {/* Available Tables */}
      <div className="bg-white p-4 rounded-lg shadow border-l-4 border-green-500">
        <h3 className="text-lg font-semibold text-gray-900">Available</h3>
        <p className="text-3xl font-bold text-green-600">
          {getStatusCount('available')}
        </p>
      </div>

      {/* Utilization Rate */}
      <div className="bg-white p-4 rounded-lg shadow border-l-4 border-purple-500">
        <h3 className="text-lg font-semibold text-gray-900">Utilization</h3>
        <p className="text-3xl font-bold text-purple-600">
          {utilizationRate}%
        </p>
      </div>

      {/* Reserved Tables */}
      <div className="bg-white p-4 rounded-lg shadow border-l-4 border-yellow-500">
        <h3 className="text-lg font-semibold text-gray-900">Reserved</h3>
        <p className="text-3xl font-bold text-yellow-600">
          {getStatusCount('reserved')}
        </p>
      </div>
    </div>
  );
};

export default TableStats;