// src/pages/Inventory.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { realApi } from '../api/realApi';
import { API_CONFIG } from '../config/api.config';

const Inventory = () => {
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [filters, setFilters] = useState({
    category: '',
    search: '',
    lowStock: false
  });
  const [error, setError] = useState('');
  const [categories, setCategories] = useState([]);
  const [newCategory, setNewCategory] = useState('');
  const [showNewCategory, setShowNewCategory] = useState(false);

  const { user } = useAuth();

  useEffect(() => {
    loadProducts();
    loadCategories();
  }, []);

  useEffect(() => {
    filterProducts();
  }, [products, filters]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await realApi.getProducts();
      console.log('🛒 Products API response:', response);

      if (response.success) {
        const productsData = realApi.extractData(response) || [];
        console.log('🛒 Extracted products data:', productsData.length, 'products');
        setProducts(Array.isArray(productsData) ? productsData : []);
      } else {
        throw new Error(response.message || 'Failed to load products');
      }
    } catch (error) {
      console.error('❌ Failed to load products:', error);
      setError(error.message || 'Failed to load products');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const response = await realApi.getCategories();
      console.log('📁 Categories API response:', response);
      if (response.success) {
        const categoriesData = realApi.extractData(response) || [];
        console.log('📁 Extracted categories data:', categoriesData);
        setCategories(Array.isArray(categoriesData) ? categoriesData : []);
      }
    } catch (error) {
      console.error('❌ Failed to load categories:', error);
      // Use default categories if API fails
      setCategories(['Main Course', 'Appetizers', 'Sides', 'Beverages', 'Desserts', 'Salads', 'Soup']);
    }
  };

  const filterProducts = () => {
    let filtered = Array.isArray(products) ? products : [];

    if (filters.category) {
      filtered = filtered.filter(product => product.category === filters.category);
    }

    if (filters.search) {
      filtered = filtered.filter(product =>
        product.name?.toLowerCase().includes(filters.search.toLowerCase()) ||
        product.description?.toLowerCase().includes(filters.search.toLowerCase())
      );
    }

    if (filters.lowStock) {
      filtered = filtered.filter(product => product.stock <= (product.minStock || 10));
    }

    setFilteredProducts(filtered);
  };

  const handleSaveProduct = async (productData) => {
    try {
      console.log('Saving product:', productData);

      let response;

      if (editingProduct) {
        response = await realApi.updateProduct(editingProduct._id, productData);
      } else {
        response = await realApi.createProduct(productData);
      }

      if (response.success) {
        await loadProducts();
        await loadCategories(); // Reload categories to include new ones
        setShowModal(false);
        setEditingProduct(null);
        setShowNewCategory(false);
        setNewCategory('');
      } else {
        throw new Error(response.message || 'Failed to save product');
      }
    } catch (error) {
      console.error('Failed to save product:', error);
      alert(`Failed to save product: ${error.message}`);
    }
  };

  const handleDeleteProduct = async (productId) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      try {
        const response = await realApi.deleteProduct(productId);

        if (response.success) {
          setProducts(prev => prev.filter(p => p._id !== productId));
        } else {
          throw new Error(response.message || 'Failed to delete product');
        }
      } catch (error) {
        console.error('Failed to delete product:', error);
        alert(error.message || 'Failed to delete product');
      }
    }
  };

  const updateStock = async (productId, newStock) => {
    try {
      const response = await realApi.updateStock(productId, { stock: newStock });

      if (response.success) {
        setProducts(prev =>
          prev.map(p =>
            p._id === productId ? { ...p, stock: newStock } : p
          )
        );
      } else {
        throw new Error(response.message || 'Failed to update stock');
      }
    } catch (error) {
      console.error('Failed to update stock:', error);
      alert(error.message || 'Failed to update stock');
    }
  };

  const getStockStatus = (stock, minStock = 10) => {
    if (stock === 0) return { color: 'bg-red-100 text-red-800', text: 'Out of Stock' };
    if (stock <= minStock) return { color: 'bg-yellow-100 text-yellow-800', text: 'Low Stock' };
    return { color: 'bg-green-100 text-green-800', text: 'In Stock' };
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const addNewCategory = () => {
    if (newCategory.trim() && !categories.includes(newCategory.trim())) {
      const updatedCategories = [...categories, newCategory.trim()];
      setCategories(updatedCategories);
      setFormData(prev => ({ ...prev, category: newCategory.trim() }));
      setNewCategory('');
      setShowNewCategory(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Inventory Management</h1>
          <p className="text-gray-600">Manage products, stock levels, and ingredients</p>
          {error && (
            <div className="mt-2 p-2 bg-red-100 text-red-700 rounded-md text-sm">
              {error}
            </div>
          )}
        </div>
        <button
          onClick={() => {
            setEditingProduct(null);
            setShowModal(true);
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium"
        >
          + Add Product
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              value={filters.category}
              onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="">All Categories</option>
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <input
              type="text"
              placeholder="Search products..."
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>

          <div className="flex items-end">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={filters.lowStock}
                onChange={(e) => setFilters(prev => ({ ...prev, lowStock: e.target.checked }))}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="ml-2 text-sm text-gray-700">Show Low Stock Only</span>
            </label>
          </div>

          <div className="flex items-end">
            <button
              onClick={() => setFilters({ category: '', search: '', lowStock: false })}
              className="w-full bg-gray-500 hover:bg-gray-600 text-white py-2 px-4 rounded-lg"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {Array.isArray(filteredProducts) && filteredProducts.map(product => {
          const stockStatus = getStockStatus(product.stock, product.minStock);
          // Fix for image 404s: If running locally but image has production URL, rewrite it to local backend
          const backendUrl = API_CONFIG.BACKEND_URL;
          let imageUrl = product.image ? product.image : '';

          if (imageUrl) {
            if (imageUrl.startsWith('http')) {
              // If it's a full URL, check if we need to rewrite it for local dev
              if (window.location.hostname === 'localhost' && imageUrl.includes('mama-africa1.onrender.com')) {
                imageUrl = imageUrl.replace('https://mama-africa1.onrender.com', 'http://localhost:5000');
              }
            } else {
              // Relative path, prepend backend URL
              imageUrl = `${backendUrl}${imageUrl}`;
            }
          } else {
            imageUrl = 'https://via.placeholder.com/200x200?text=No+Image';
          }

          return (
            <div key={product._id} className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
              <div className="h-48 bg-gray-200 overflow-hidden">
                <img
                  src={imageUrl}
                  alt={product.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.onerror = null; // Prevent infinite loop
                    e.target.src = '/placeholder.svg'; // Fallback image
                    if (e.target.parentNode) {
                      e.target.parentNode.classList.add('bg-gray-200', 'flex', 'items-center', 'justify-center');
                    }
                    e.target.parentNode.innerHTML = '<span class="text-gray-400 text-sm">No Image</span>';
                  }}
                />
              </div>
              <div className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold text-gray-900 text-lg">{product.name}</h3>
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${stockStatus.color}`}>
                    {stockStatus.text}
                  </span>
                </div>

                <p className="text-gray-600 text-sm mb-3 line-clamp-2">{product.description}</p>

                <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                  <div>
                    <span className="text-gray-500">Category:</span>
                    <p className="font-medium">{product.category}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Price:</span>
                    <p className="font-medium">${typeof product.price === 'number' ? product.price.toFixed(2) : '0.00'}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Cost:</span>
                    <p className="font-medium">${product.cost ? product.cost.toFixed(2) : 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Stock:</span>
                    <p className="font-medium">{product.stock}</p>
                  </div>
                </div>

                <div className="text-xs text-gray-500 mb-3">
                  Added: {formatDate(product.createdAt)}
                </div>

                <div className="flex space-x-2">
                  <button
                    onClick={() => {
                      setEditingProduct(product);
                      setShowModal(true);
                    }}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-3 rounded text-sm font-medium"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => updateStock(product._id, (product.stock || 0) + 1)}
                    className="bg-green-600 hover:bg-green-700 text-white py-2 px-3 rounded text-sm font-medium"
                  >
                    + Stock
                  </button>
                  <button
                    onClick={() => handleDeleteProduct(product._id)}
                    className="bg-red-600 hover:bg-red-700 text-white py-2 px-3 rounded text-sm font-medium"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {(!Array.isArray(filteredProducts) || filteredProducts.length === 0) && (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">No products found</p>
          <p className="text-gray-400">Try adjusting your filters or add new products</p>
        </div>
      )}

      {/* Product Modal */}
      {showModal && (
        <ProductModal
          product={editingProduct}
          categories={categories}
          newCategory={newCategory}
          setNewCategory={setNewCategory}
          showNewCategory={showNewCategory}
          setShowNewCategory={setShowNewCategory}
          addNewCategory={addNewCategory}
          onClose={() => {
            setShowModal(false);
            setEditingProduct(null);
            setShowNewCategory(false);
            setNewCategory('');
          }}
          onSave={handleSaveProduct}
        />
      )}
    </div>
  );
};

// Product Modal Component
const ProductModal = ({
  product,
  categories,
  newCategory,
  setNewCategory,
  showNewCategory,
  setShowNewCategory,
  addNewCategory,
  onClose,
  onSave
}) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    price: 0,
    cost: 0,
    stock: 0,
    minStock: 10,
    isAvailable: true,
    image: ''
  });
  const [uploading, setUploading] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name || '',
        description: product.description || '',
        category: product.category || '',
        price: product.price || 0,
        cost: product.cost || 0,
        stock: product.stock || 0,
        minStock: product.minStock || 10,
        isAvailable: product.isAvailable !== false,
        image: product.image || ''
      });
    } else {
      setFormData({
        name: '',
        description: '',
        category: '',
        price: 0,
        cost: 0,
        stock: 0,
        minStock: 10,
        isAvailable: true,
        image: ''
      });
    }
  }, [product]);

  const handleImageUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file (JPEG, PNG, etc.)');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert('Image size should be less than 10MB');
      return;
    }

    try {
      setUploading(true);
      const uploadFormData = new FormData();
      uploadFormData.append('image', file);

      const apiUrl = API_CONFIG.API_URL;
      const response = await fetch(`${apiUrl}/upload`, {
        method: 'POST',
        body: uploadFormData,
      });

      const result = await response.json();

      if (result.success) {
        setFormData(prev => ({
          ...prev,
          image: result.data.path
        }));
        setFormErrors(prev => ({ ...prev, image: '' }));
      } else {
        throw new Error(result.message || 'Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      setFormErrors(prev => ({ ...prev, image: 'Failed to upload image' }));
      alert('Failed to upload image: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const validateForm = () => {
    const errors = {};

    if (!formData.name.trim()) {
      errors.name = 'Product name is required';
    }

    if (!formData.category.trim()) {
      errors.category = 'Category is required';
    }

    if (!formData.price || formData.price <= 0) {
      errors.price = 'Valid price is required';
    }

    if (formData.stock < 0) {
      errors.stock = 'Stock cannot be negative';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const submitData = {
      ...formData,
      price: parseFloat(formData.price),
      cost: formData.cost ? parseFloat(formData.cost) : 0,
      stock: parseInt(formData.stock),
      minStock: parseInt(formData.minStock)
    };

    console.log('Submitting product data:', submitData);
    onSave(submitData);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));

    if (formErrors[name]) {
      setFormErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleCategoryChange = (e) => {
    const value = e.target.value;
    if (value === 'new') {
      setShowNewCategory(true);
      setFormData(prev => ({ ...prev, category: '' }));
    } else {
      setFormData(prev => ({ ...prev, category: value }));
      setShowNewCategory(false);
    }
  };

  const handleAddNewCategory = () => {
    if (newCategory.trim()) {
      setFormData(prev => ({ ...prev, category: newCategory.trim() }));
      if (!categories.includes(newCategory.trim())) {
        addNewCategory();
      } else {
        setShowNewCategory(false);
        setNewCategory('');
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-900">
              {product ? 'Edit Product' : 'Add New Product'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Image Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Product Image
              </label>
              <div className="flex items-center space-x-4">
                {formData.image && (
                  <img
                    src={(() => {
                      if (!formData.image) return '';
                      if (formData.image.startsWith('http')) {
                        if (window.location.hostname === 'localhost' && formData.image.includes('mama-africa1.onrender.com')) {
                          return formData.image.replace('https://mama-africa1.onrender.com', 'http://localhost:5000');
                        }
                        return formData.image;
                      }
                      return `${API_CONFIG.BACKEND_URL}${formData.image}`;
                    })()}
                    alt="Preview"
                    className="w-16 h-16 object-cover rounded border"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.style.display = 'none';
                      // Optionally show text adjacent
                    }}
                  />
                )}
                <div className="flex-1">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={uploading}
                    className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                  {uploading && <p className="text-sm text-blue-600 mt-1">Uploading...</p>}
                  {formErrors.image && <p className="text-sm text-red-600 mt-1">{formErrors.image}</p>}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Product Name *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className={`w-full border rounded-lg px-3 py-2 ${formErrors.name ? 'border-red-500' : 'border-gray-300'
                  }`}
                placeholder="Enter product name"
              />
              {formErrors.name && <p className="text-sm text-red-600 mt-1">{formErrors.name}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows="3"
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                placeholder="Enter product description (optional)"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category *
              </label>
              {!showNewCategory ? (
                <div>
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleCategoryChange}
                    className={`w-full border rounded-lg px-3 py-2 ${formErrors.category ? 'border-red-500' : 'border-gray-300'
                      }`}
                  >
                    <option value="">Select Category</option>
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                    <option value="new">+ Add New Category</option>
                  </select>
                  {formData.category && (
                    <p className="text-sm text-green-600 mt-1">
                      Selected: <strong>{formData.category}</strong>
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-blue-600">Adding new category:</p>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      placeholder="Enter new category name"
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddNewCategory();
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleAddNewCategory}
                      className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg"
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowNewCategory(false);
                        setNewCategory('');
                      }}
                      className="bg-gray-500 hover:bg-gray-600 text-white px-3 py-2 rounded-lg"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              {formErrors.category && <p className="text-sm text-red-600 mt-1">{formErrors.category}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Price *
                </label>
                <input
                  type="number"
                  name="price"
                  value={formData.price}
                  onChange={handleChange}
                  step="0.01"
                  min="0"
                  required
                  className={`w-full border rounded-lg px-3 py-2 ${formErrors.price ? 'border-red-500' : 'border-gray-300'
                    }`}
                  placeholder="0.00"
                />
                {formErrors.price && <p className="text-sm text-red-600 mt-1">{formErrors.price}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cost
                </label>
                <input
                  type="number"
                  name="cost"
                  value={formData.cost}
                  onChange={handleChange}
                  step="0.01"
                  min="0"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Stock *
                </label>
                <input
                  type="number"
                  name="stock"
                  value={formData.stock}
                  onChange={handleChange}
                  min="0"
                  required
                  className={`w-full border rounded-lg px-3 py-2 ${formErrors.stock ? 'border-red-500' : 'border-gray-300'
                    }`}
                />
                {formErrors.stock && <p className="text-sm text-red-600 mt-1">{formErrors.stock}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Min Stock
                </label>
                <input
                  type="number"
                  name="minStock"
                  value={formData.minStock}
                  onChange={handleChange}
                  min="1"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>
            </div>

            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  name="isAvailable"
                  checked={formData.isAvailable}
                  onChange={handleChange}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">Available for sale</span>
              </label>
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
                {product ? 'Update' : 'Create'} Product
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Inventory;
