import React, { useState, useEffect } from 'react';

const TableModal = ({ isOpen, onClose, onSave, table }) => {
  const [formData, setFormData] = useState({
    tableNumber: '',
    name: '',
    capacity: 4,
    location: 'indoor',
    shape: 'rectangle',
    size: { width: 100, height: 100 },
    position: { x: 0, y: 0 }
  });

  useEffect(() => {
    if (table) {
      setFormData({
        tableNumber: table.tableNumber,
        name: table.name,
        capacity: table.capacity,
        location: table.location,
        shape: table.shape,
        size: table.size || { width: 100, height: 100 },
        position: table.position || { x: 0, y: 0 }
      });
    } else {
      setFormData({
        tableNumber: '',
        name: '',
        capacity: 4,
        location: 'indoor',
        shape: 'rectangle',
        size: { width: 100, height: 100 },
        position: { x: 0, y: 0 }
      });
    }
  }, [table, isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSizeChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      size: { ...prev.size, [name]: parseInt(value) || 0 }
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-2xl font-bold mb-4">
            {table ? 'Edit Table' : 'Add New Table'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Table Number */}
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
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., T01"
              />
            </div>

            {/* Table Name */}
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
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Window Table 1"
              />
            </div>

            {/* Capacity */}
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
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Location */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Location
              </label>
              <select
                name="location"
                value={formData.location}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="indoor">Indoor</option>
                <option value="outdoor">Outdoor</option>
                <option value="terrace">Terrace</option>
                <option value="vip">VIP</option>
              </select>
            </div>

            {/* Shape */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Shape
              </label>
              <select
                name="shape"
                value={formData.shape}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="rectangle">Rectangle</option>
                <option value="circle">Circle</option>
                <option value="square">Square</option>
              </select>
            </div>

            {/* Size */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Width (px)
                </label>
                <input
                  type="number"
                  name="width"
                  value={formData.size.width}
                  onChange={handleSizeChange}
                  min="50"
                  max="300"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Height (px)
                </label>
                <input
                  type="number"
                  name="height"
                  value={formData.size.height}
                  onChange={handleSizeChange}
                  min="50"
                  max="300"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

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
                {table ? 'Update' : 'Create'} Table
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default TableModal;