// src/pages/Inventory.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { realApi } from '../api/realApi';
import { API_CONFIG } from '../config/api.config';
import {
  Search,
  Plus,
  Filter,
  Edit,
  Trash2,
  PackagePlus,
  Upload,
  Loader,
  Image as ImageIcon
} from 'lucide-react';

import { useOptimisticData } from '../hooks/useOptimisticData';

const Inventory = () => {
  // Products hook
  const {
    data: products,
    loading: productsLoading,
    error: productsError,
    refresh: loadProducts
  } = useOptimisticData('inventory_products', async () => {
    const response = await realApi.getProducts();
    if (response.success) {
      return realApi.extractData(response) || [];
    }
    throw new Error(response.message || 'Failed to load products');
  }, []);

  // Categories hook
  const {
    data: categories,
    refresh: loadCategories
  } = useOptimisticData('inventory_categories', async () => {
    try {
      const response = await realApi.getCategories();
      if (response.success) {
        return realApi.extractData(response) || [];
      }
    } catch (e) {
      return ['Main Course', 'Appetizers', 'Sides', 'Beverages', 'Desserts', 'Salads', 'Soup'];
    }
    return [];
  }, ['Main Course', 'Appetizers', 'Sides', 'Beverages', 'Desserts', 'Salads', 'Soup']);

  // const [products, setProducts] = useState([]); // Replaced by hook
  const [filteredProducts, setFilteredProducts] = useState([]);
  // const [loading, setLoading] = useState(true); // Replaced by hook
  const loading = productsLoading;

  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [filters, setFilters] = useState({
    category: '',
    search: '',
    lowStock: false
  });
  const [error, setError] = useState('');
  // const [categories, setCategories] = useState([]); // Replaced by hook

  const [newCategory, setNewCategory] = useState('');
  const [showNewCategory, setShowNewCategory] = useState(false);

  const { user } = useAuth();

  useEffect(() => {
    if (productsError) {
      console.error('❌ Failed to load products:', productsError);
      setError(productsError.message);
    }
  }, [productsError]);

  // Initial load handled by hook
  // useEffect(() => {
  //   loadProducts();
  //   loadCategories();
  // }, []);

  // loadProducts replaced by hook
  /*
  const loadProducts = async () => {
    // ...
  };
  */

  /* loadCategories replaced by hook */

  // Handled by hook
  // const loadCategories = async () => {
  //   // ...
  // };

  useEffect(() => {
    filterProducts();
  }, [products, filters]);

  // filterProducts logic stays same

  const filterProducts = () => {
    let filtered = Array.isArray(products) ? products : [];
    // ... same logic
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
      let response;
      if (editingProduct) {
        response = await realApi.updateProduct(editingProduct._id, productData);
      } else {
        response = await realApi.createProduct(productData);
      }

      if (response.success) {
        await loadProducts(); // Refresh via hook
        await loadCategories(); // Refresh via hook
        setShowModal(false);
        setEditingProduct(null);
        setShowNewCategory(false);
        setNewCategory('');
      } else {
        throw new Error(response.message || 'Failed to save product');
      }
    } catch (error) {
      alert(`Failed to save product: ${error.message}`);
    }
  };

  const handleDeleteProduct = async (productId) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      try {
        const response = await realApi.deleteProduct(productId);
        if (response.success) {
          // Ideally optimistically update, but refresh is fine for now
          // setProducts(prev => prev.filter(p => p._id !== productId));
          await loadProducts();
        } else {
          throw new Error(response.message || 'Failed to delete product');
        }
      } catch (error) {
        alert(error.message || 'Failed to delete product');
      }
    }
  };

  const updateStock = async (productId, newStock) => {
    try {
      const response = await realApi.updateStock(productId, { stock: newStock });
      if (response.success) {
        // Optimistic update difficult without exposed setter, just refresh
        // setProducts(prev => ...);
        await loadProducts();
      } else {
        throw new Error(response.message || 'Failed to update stock');
      }
    } catch (error) {
      alert(error.message || 'Failed to update stock');
    }
  };

  const getStockStatus = (stock, minStock = 10) => {
    if (stock === 0) return { color: 'bg-red-100 text-red-800', text: 'Out' };
    if (stock <= minStock) return { color: 'bg-orange-100 text-orange-800', text: 'Low' };
    return { color: 'bg-green-100 text-green-800', text: 'OK' };
  };

  const addNewCategory = () => {
    if (newCategory.trim() && !categories.includes(newCategory.trim())) {
      setCategories(prev => [...prev, newCategory.trim()]);
      setNewCategory('');
      setShowNewCategory(false);
    }
  };

  return (
    <div className="page-content flex flex-col gap-4 h-full overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>{products.length} Products</span>
            {loading && <Loader className="animate-spin w-3 h-3" />}
          </div>
        </div>
        <button
          onClick={() => {
            setEditingProduct(null);
            setShowModal(true);
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors shadow-sm"
        >
          <Plus size={18} />
          <span>Add Product</span>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row gap-3 flex-shrink-0">
        <div className="flex flex-1 items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
          <Search size={18} className="text-gray-400" />
          <input
            type="text"
            placeholder="Search products..."
            value={filters.search}
            onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
            className="bg-transparent border-none outline-none w-full text-sm"
          />
        </div>

        <select
          value={filters.category}
          onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
          className="border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        >
          <option value="">All Categories</option>
          {categories.map(category => (
            <option key={category} value={category}>{category}</option>
          ))}
        </select>

        <label className="flex items-center gap-2 px-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={filters.lowStock}
            onChange={(e) => setFilters(prev => ({ ...prev, lowStock: e.target.checked }))}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700 whitespace-nowrap">Low Stock</span>
        </label>

        {(filters.category || filters.search || filters.lowStock) && (
          <button
            onClick={() => setFilters({ category: '', search: '', lowStock: false })}
            className="px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Products Grid */}
      <div className="flex-1 overflow-y-auto min-h-0 bg-gray-50/50 rounded-xl border border-gray-200 p-4">
        {loading && products.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        ) : filteredProducts.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
            {filteredProducts.map(product => {
              const stockStatus = getStockStatus(product.stock, product.minStock);
              const backendUrl = API_CONFIG.BACKEND_URL;
              let imageUrl = product.image || '';

              if (imageUrl && !imageUrl.startsWith('http')) {
                imageUrl = `${backendUrl}${imageUrl}`;
              } else if (imageUrl && imageUrl.includes('mama-africa1.onrender.com') && window.location.hostname === 'localhost') {
                imageUrl = imageUrl.replace('https://mama-africa1.onrender.com', 'http://localhost:5000');
              } else if (!imageUrl) {
                imageUrl = 'https://via.placeholder.com/200x200?text=No+Image';
              }

              return (
                <div key={product._id} className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow flex flex-col overflow-hidden group h-[280px]">
                  <div className="h-32 bg-gray-100 relative overflow-hidden flex-shrink-0">
                    <img
                      src={imageUrl}
                      alt={product.name}
                      className="w-full h-full object-cover transition-transform group-hover:scale-105"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="%23ccc" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"%3E%3Crect x="3" y="3" width="18" height="18" rx="2" ry="2"/%3E%3Ccircle cx="8.5" cy="8.5" r="1.5"/%3E%3Cpolyline points="21 15 16 10 5 21"/%3E%3C/svg%3E';
                        e.target.style.padding = '2rem';
                      }}
                    />
                    <div className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${stockStatus.color}`}>
                      {stockStatus.text}
                    </div>
                  </div>

                  <div className="p-3 flex flex-col flex-1">
                    <div className="mb-auto">
                      <div className="flex justify-between items-start gap-1">
                        <h3 className="font-semibold text-gray-900 text-sm line-clamp-1" title={product.name}>{product.name}</h3>
                      </div>
                      <p className="text-xs text-gray-500 mt-1 mb-2 line-clamp-1">{product.category}</p>

                      <div className="flex justify-between items-end mt-1">
                        <div>
                          <span className="text-[10px] text-gray-400 block uppercase tracking-wider">Stock</span>
                          <span className="font-medium text-gray-700 text-sm">{product.stock}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-gray-400 block uppercase tracking-wider">Price</span>
                          <span className="font-bold text-blue-600 text-sm">${typeof product.price === 'number' ? product.price.toFixed(2) : '0.00'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-1 pt-3 mt-2 border-t border-gray-50">
                      <button
                        onClick={() => updateStock(product._id, (product.stock || 0) + 1)}
                        className="flex items-center justify-center p-1.5 rounded-lg text-emerald-600 bg-emerald-50 hover:bg-emerald-100 transition-colors"
                        title="Add Stock"
                      >
                        <PackagePlus size={16} />
                      </button>
                      <button
                        onClick={() => {
                          setEditingProduct(product);
                          setShowModal(true);
                        }}
                        className="flex items-center justify-center p-1.5 rounded-lg text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors"
                        title="Edit Product"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(product._id)}
                        className="flex items-center justify-center p-1.5 rounded-lg text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
                        title="Delete Product"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <PackagePlus size={48} className="mb-4 opacity-20" />
            <p className="text-lg font-medium text-gray-500">No products found</p>
            <p className="text-sm">Try adjusting your filters or add new products</p>
          </div>
        )}
      </div>

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

// Simplified Product Modal
const ProductModal = ({
  product, categories, newCategory, setNewCategory,
  showNewCategory, setShowNewCategory, addNewCategory,
  onClose, onSave
}) => {
  const [formData, setFormData] = useState({
    name: '', description: '', category: '', price: 0, cost: 0,
    stock: 0, minStock: 10, isAvailable: true, image: ''
  });
  const [uploading, setUploading] = useState(false);
  const [previewImage, setPreviewImage] = useState('');

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
      setPreviewImage(product.image ? (product.image.startsWith('http') ? product.image : `${API_CONFIG.BACKEND_URL}${product.image}`) : '');
    }
  }, [product]);

  const handleImageUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Immediate preview
    const objectUrl = URL.createObjectURL(file);
    setPreviewImage(objectUrl);

    try {
      setUploading(true);
      const uploadFormData = new FormData();
      uploadFormData.append('image', file);

      const response = await fetch(`${API_CONFIG.API_URL}/upload`, {
        method: 'POST',
        body: uploadFormData,
      });

      const result = await response.json();
      if (result.success) {
        setFormData(prev => ({ ...prev, image: result.data.path }));
      }
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      ...formData,
      price: parseFloat(formData.price),
      cost: parseFloat(formData.cost || 0),
      stock: parseInt(formData.stock),
      minStock: parseInt(formData.minStock)
    });
  };

  const handleAddNewCategory = (e) => {
    e?.preventDefault();
    if (newCategory.trim()) {
      addNewCategory();
      setFormData(prev => ({ ...prev, category: newCategory.trim() }));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <h2 className="text-lg font-bold text-gray-900">
            {product ? 'Edit Product' : 'New Product'}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full transition-colors">
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Image Upload Area */}
          <div className="flex flex-col items-center gap-4">
            <div className="relative group w-24 h-24 rounded-2xl border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50 overflow-hidden cursor-pointer hover:border-blue-500 transition-colors">
              {previewImage ? (
                <img src={previewImage} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <div className="text-center p-2">
                  <ImageIcon className="w-6 h-6 text-gray-400 mx-auto mb-1" />
                  <span className="text-[10px] text-gray-400">Upload</span>
                </div>
              )}
              <input type="file" onChange={handleImageUpload} accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" />
              {uploading && <div className="absolute inset-0 bg-black/50 flex items-center justify-center"><Loader className="w-5 h-5 text-white animate-spin" /></div>}
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1 block">Product Name</label>
              <input required type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all" placeholder="e.g., Chicken Burger" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1 block">Category</label>
                {!showNewCategory ? (
                  <select required value={formData.category} onChange={(e) => {
                    if (e.target.value === 'new') setShowNewCategory(true);
                    else setFormData({ ...formData, category: e.target.value });
                  }} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-white">
                    <option value="">Select...</option>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    <option value="new" className="text-blue-600 font-medium">+ New Category</option>
                  </select>
                ) : (
                  <div className="flex gap-2">
                    <input autoFocus type="text" value={newCategory} onChange={e => setNewCategory(e.target.value)} className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm" placeholder="New Category" />
                    <button type="button" onClick={handleAddNewCategory} className="px-2 bg-blue-600 text-white rounded-lg text-xs">Add</button>
                    <button type="button" onClick={() => setShowNewCategory(false)} className="px-2 bg-gray-200 text-gray-600 rounded-lg text-xs">X</button>
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1 block">Status</label>
                <select value={formData.isAvailable} onChange={e => setFormData({ ...formData, isAvailable: e.target.value === 'true' })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
                  <option value="true">Available</option>
                  <option value="false">Unavailable</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1 block">Price</label>
                <input required type="number" min="0" step="0.01" value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="0.00" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1 block">Cost</label>
                <input type="number" min="0" step="0.01" value={formData.cost} onChange={e => setFormData({ ...formData, cost: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="0.00" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1 block">Stock</label>
                <input required type="number" min="0" value={formData.stock} onChange={e => setFormData({ ...formData, stock: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1 block">Description</label>
              <textarea rows="2" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all" placeholder="Optional details..." />
            </div>
          </div>
        </form>

        <div className="p-4 border-t border-gray-100 bg-gray-50/50 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
          <button onClick={handleSubmit} className="px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-all transform active:scale-95">Save Product</button>
        </div>
      </div>
    </div>
  );
};

export default Inventory;
