// src/pages/POS.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { realApi } from '../api/realApi';
import { API_CONFIG } from '../config/api.config';

const POS = () => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [tables, setTables] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [settings, setSettings] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [selectedTable, setSelectedTable] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [orderType, setOrderType] = useState('dine-in');
  const [customer, setCustomer] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [searchQuery, setSearchQuery] = useState(''); // NEW: Search state

  const { user } = useAuth();

  useEffect(() => {
    loadPOSData();
    loadSettings();
  }, []);

  const loadPOSData = async () => {
    try {
      setLoading(true);
      console.log('🔄 Loading POS data from backend...');

      const [productsResponse, categoriesResponse, tablesResponse, customersResponse] = await Promise.all([
        realApi.getProducts(),
        realApi.getCategories(),
        realApi.getAvailableTables(),
        realApi.getCustomers()
      ]);

      console.log('📦 POS API responses:', {
        products: productsResponse,
        categories: categoriesResponse,
        tables: tablesResponse,
        customers: customersResponse
      });

      if (productsResponse.success) {
        const productsData = realApi.extractData(productsResponse) || [];
        console.log('✅ Products loaded:', productsData.length);
        setProducts(Array.isArray(productsData) ? productsData : []);
      } else {
        console.error('❌ Products API failed:', productsResponse.message);
      }

      if (categoriesResponse.success) {
        const categoriesData = realApi.extractData(categoriesResponse) || [];
        console.log('✅ Categories loaded:', categoriesData);
        setCategories(Array.isArray(categoriesData) ? categoriesData : []);
      } else {
        console.error('❌ Categories API failed:', categoriesResponse.message);
        // Use default categories if API fails
        setCategories(['Main Course', 'Salads', 'Sides', 'Beverages', 'Desserts']);
      }

      if (tablesResponse.success) {
        const tablesData = realApi.extractData(tablesResponse) || [];
        console.log('✅ Tables loaded:', tablesData.length);
        setTables(Array.isArray(tablesData) ? tablesData : []);
      } else {
        console.error('❌ Tables API failed:', tablesResponse.message);
      }

      if (customersResponse.success) {
        const customersData = realApi.extractData(customersResponse) || [];
        console.log('✅ Customers loaded:', customersData.length);
        setCustomers(Array.isArray(customersData) ? customersData : []);
      } else {
        console.error('❌ Customers API failed:', customersResponse.message);
      }

    } catch (error) {
      console.error('❌ Error loading POS data:', error);
      alert('Failed to load POS data. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadSettings = async () => {
    try {
      setSettingsLoading(true);
      console.log('🔄 Loading settings from backend...');

      const response = await realApi.getSettings();
      console.log('📦 Settings API response:', response);

      if (response.success) {
        const settingsData = realApi.extractData(response);
        console.log('✅ Settings loaded:', settingsData);
        if (settingsData) {
          setSettings(settingsData);
        }
      } else {
        console.error('❌ Settings API failed:', response.message);
      }
    } catch (error) {
      console.error('❌ Error loading settings:', error);
    } finally {
      setSettingsLoading(false);
    }
  };

  // FIXED: Proper image URL handling
  const getProductImageUrl = (product) => {
    if (!product.image) {
      return '/no-image.png'; // Use a local fallback
    }

    // If it's already a full URL (starts with http), use it directly
    if (product.image.startsWith('http')) {
      return product.image;
    }

    // Get backend URL from environment
    const backendUrl = API_CONFIG.BACKEND_URL;

    // If it's a relative path (starts with /uploads), construct full URL
    if (product.image.startsWith('/uploads')) {
      return `${backendUrl}${product.image}`;
    }

    // If it's just a filename, construct the full path
    return `${backendUrl}/uploads/products/${product.image}`;
  };

  const filteredProducts = products.filter(product => {
    const matchesCategory = selectedCategory === 'All' || product.category === selectedCategory;
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const addToCart = (product) => {
    // Check if product has sufficient stock
    if (product.stock !== undefined && product.stock <= 0) {
      alert('This product is out of stock');
      return;
    }

    setCart(prevCart => {
      const existingItem = prevCart.find(item => item._id === product._id);

      if (existingItem) {
        // Check if adding more than available stock
        if (product.stock !== undefined && (existingItem.quantity + 1) > product.stock) {
          alert(`Only ${product.stock} items available in stock`);
          return prevCart;
        }

        return prevCart.map(item =>
          item._id === product._id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      } else {
        return [...prevCart, {
          ...product,
          quantity: 1,
          addedAt: new Date().toISOString()
        }];
      }
    });
  };

  const updateQuantity = (productId, newQuantity) => {
    if (newQuantity < 1) {
      removeFromCart(productId);
      return;
    }

    const product = cart.find(item => item._id === productId);
    if (product && product.stock !== undefined && newQuantity > product.stock) {
      alert(`Only ${product.stock} items available in stock`);
      return;
    }

    setCart(prevCart =>
      prevCart.map(item =>
        item._id === productId
          ? { ...item, quantity: newQuantity }
          : item
      )
    );
  };

  const removeFromCart = (productId) => {
    setCart(prevCart => prevCart.filter(item => item._id !== productId));
  };

  // Calculate amounts based on settings
  const getCartTotal = () => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const getTaxAmount = () => {
    const taxRate = settings?.taxRate || 5;
    return getCartTotal() * (taxRate / 100);
  };

  const getGrandTotal = () => {
    return getCartTotal() + getTaxAmount();
  };

  const getCurrencySymbol = () => {
    const currency = settings?.currency || 'USD';
    const symbols = {
      'USD': '$',
      'EUR': '€',
      'GBP': '£',
      'CAD': 'C$',
      'AUD': 'A$'
    };
    return symbols[currency] || '$';
  };

  const handleCheckout = async () => {
    if (cart.length === 0) {
      alert('Cart is empty');
      return;
    }

    if (orderType === 'dine-in' && !selectedTable) {
      alert('Please select a table for dine-in orders');
      return;
    }

    try {
      const orderData = {
        items: cart.map(item => ({
          product: item._id,
          quantity: item.quantity,
          price: item.price,
          name: item.name
        })),
        orderType: orderType,
        paymentMethod: paymentMethod,
        tableId: selectedTable,
        customerId: selectedCustomer,
        customerName: selectedCustomer ?
          customers.find(c => c._id === selectedCustomer)?.name :
          customer || 'Walking Customer',
        totalAmount: getCartTotal(),
        taxAmount: getTaxAmount(),
        finalTotal: getGrandTotal(),
        orderDate: new Date().toISOString(),
        taxRate: settings?.taxRate || 5,
        currency: settings?.currency || 'USD'
      };

      console.log('💾 Creating order:', orderData);
      const response = await realApi.createOrder(orderData);
      console.log('📦 Create order response:', response);

      if (response.success) {
        alert('Order created successfully!');
        setCart([]);
        setSelectedTable(null);
        setSelectedCustomer(null);
        setCustomer('');
      } else {
        throw new Error(response.message || 'Failed to create order');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      alert('Error creating order: ' + (error.message || 'Unknown error'));
    }
  };

  const printReceipt = async () => {
    if (cart.length === 0) {
      alert('Cart is empty');
      return;
    }

    if (orderType === 'dine-in' && !selectedTable) {
      alert('Please select a table for dine-in orders');
      return;
    }

    try {
      const orderData = {
        items: cart.map(item => ({
          product: item._id,
          quantity: item.quantity,
          price: item.price,
          name: item.name
        })),
        orderType: orderType,
        paymentMethod: paymentMethod,
        tableId: selectedTable,
        customerId: selectedCustomer,
        customerName: selectedCustomer ?
          customers.find(c => c._id === selectedCustomer)?.name :
          customer || 'Walking Customer',
        totalAmount: getCartTotal(),
        taxAmount: getTaxAmount(),
        finalTotal: getGrandTotal(),
        orderDate: new Date().toISOString(),
        status: 'pending',
        taxRate: settings?.taxRate || 5,
        currency: settings?.currency || 'USD'
      };

      // Save order when printing receipt
      console.log('💾 Saving order for receipt:', orderData);
      const response = await realApi.createOrder(orderData);
      console.log('📦 Create order response:', response);

      if (response.success) {
        console.log('✅ Order saved for receipt printing');
      } else {
        console.error('❌ Failed to save order:', response.message);
      }

      // Generate and print receipt
      const receiptContent = generateReceiptContent(orderData);
      const printWindow = window.open('', '_blank', 'width=300,height=600');

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Restaurant Receipt</title>
            <style>
              body { 
                font-family: 'Courier New', monospace; 
                font-size: 12px; 
                margin: 0; 
                padding: 10px; 
                width: 280px;
              }
              .receipt { 
                padding: 10px; 
                background: white;
              }
              .header { 
                text-align: center; 
                margin-bottom: 10px; 
                border-bottom: 1px dashed #000; 
                padding-bottom: 8px;
              }
              .restaurant-name { 
                font-size: 14px; 
                font-weight: bold; 
                margin-bottom: 5px;
              }
              .payment-methods {
                text-align: center;
                font-size: 10px;
                margin-bottom: 8px;
                line-height: 1.2;
              }
              .order-info { 
                margin-bottom: 8px; 
                font-size: 10px;
                line-height: 1.3;
              }
              .items { 
                margin: 8px 0; 
                border-bottom: 1px dashed #000; 
                padding-bottom: 8px;
              }
              .item-header {
                display: flex;
                justify-content: space-between;
                font-weight: bold;
                margin-bottom: 5px;
                font-size: 10px;
              }
              .item-row { 
                display: flex; 
                justify-content: space-between; 
                margin-bottom: 2px;
                font-size: 10px;
              }
              .item-name { 
                flex: 3; 
              }
              .item-quantity { 
                flex: 1; 
                text-align: center;
              }
              .item-price { 
                flex: 1; 
                text-align: right;
              }
              .totals { 
                margin: 8px 0; 
                border-bottom: 1px dashed #000; 
                padding-bottom: 8px;
              }
              .total-row { 
                display: flex; 
                justify-content: space-between; 
                margin-bottom: 2px;
                font-size: 10px;
              }
              .grand-total { 
                font-weight: bold; 
                font-size: 12px;
              }
              .footer { 
                text-align: center; 
                margin-top: 10px; 
                font-size: 10px;
                line-height: 1.2;
              }
              .thank-you { 
                font-weight: bold; 
                margin-top: 8px;
              }
            </style>
          </head>
          <body>
            ${receiptContent}
          </body>
        </html>
      `);

      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
      printWindow.close();

    } catch (error) {
      console.error('Print receipt error:', error);
      alert('Error printing receipt: ' + (error.message || 'Unknown error'));
    }
  };

  const generateReceiptContent = (orderData) => {
    const now = new Date();
    const formattedDate = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}  ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const selectedTableData = tables.find(t => t._id === selectedTable);
    const selectedCustomerData = customers.find(c => c._id === selectedCustomer);

    const restaurantName = settings?.restaurantName || 'Manma Africa Restaurant';
    const receiptNumber = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    const serverName = user?.name || 'kamli';

    return `
      <div class="receipt">
        <div class="header">
          <div class="restaurant-name">${restaurantName}</div>
          <div class="payment-methods">
            ZAAD: 515735 - SAHAL: 523080-<br>
            E-DAHAB: 742298 - MYCash: 931539
          </div>
        </div>
        
        <div class="order-info">
          <div><strong>Receipt Number:</strong> ${receiptNumber}</div>
          <div><strong>Served By :</strong> ${serverName}</div>
          <div><strong>Customer :</strong> ${selectedCustomerData ? selectedCustomerData.name : (customer || 'Walking Customer')}</div>
          <div><strong>Date :</strong> ${formattedDate}</div>
        </div>
        
        <div class="items">
          <div class="item-header">
            <div class="item-name">Item:</div>
            <div class="item-quantity">No.</div>
            <div class="item-price">Price:</div>
            <div class="item-price">Total</div>
          </div>
          ${cart.map(item => `
            <div class="item-row">
              <div class="item-name">${item.name}</div>
              <div class="item-quantity">${item.quantity}</div>
              <div class="item-price">${item.price}</div>
              <div class="item-price">${(item.price * item.quantity).toFixed(1)}</div>
            </div>
          `).join('')}
        </div>
        
        <div class="totals">
          <div class="total-row">
            <div>Vat @ 5 %</div>
            <div>${getTaxAmount().toFixed(2)}</div>
          </div>
          <div class="total-row">
            <div>Paid Amount</div>
            <div></div>
          </div>
          <div class="total-row grand-total">
            <div>Total :</div>
            <div>${getGrandTotal().toFixed(2)}</div>
          </div>
          <div class="total-row">
            <div>Total L/Currency :</div>
            <div>0</div>
          </div>
        </div>
        
        <div class="footer">
          <div>Thank you for visiting us</div>
          <div>powered by Hudi-somProjects</div>
        </div>
      </div>
    `;
  };

  const clearCart = () => {
    setCart([]);
    setSelectedTable(null);
    setSelectedCustomer(null);
    setCustomer('');
  };



  const currencySymbol = getCurrencySymbol();

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-64px)] bg-gray-50 overflow-hidden">
      {/* Products Section - 70% width on desktop, full width on mobile */}
      <div className="flex-1 p-2 sm:p-4 overflow-hidden flex flex-col min-w-0">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-3 sm:mb-4">
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-gray-800">Point of Sale</h1>
            {settings && (
              <p className="text-xs sm:text-sm text-gray-600">{settings.restaurantName}</p>
            )}
          </div>
          <div className="text-xs sm:text-sm text-gray-500">
            Server: {user?.name || 'User'}
          </div>
        </div>

        {/* Quick Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 mb-3 sm:mb-4">
          {/* Order Type */}
          <div className="bg-white p-3 rounded-lg border">
            <label className="block text-xs font-medium text-gray-700 mb-1">Order Type</label>
            <select
              value={orderType}
              onChange={(e) => setOrderType(e.target.value)}
              className="w-full text-sm border border-gray-300 rounded px-2 py-1"
            >
              <option value="dine-in">Dine In</option>
              <option value="takeaway">Takeaway</option>
              <option value="delivery">Delivery</option>
            </select>
          </div>

          {/* Table Selection */}
          {orderType === 'dine-in' && (
            <div className="bg-white p-3 rounded-lg border">
              <label className="block text-xs font-medium text-gray-700 mb-1">Table</label>
              <select
                value={selectedTable || ''}
                onChange={(e) => setSelectedTable(e.target.value || null)}
                className="w-full text-sm border border-gray-300 rounded px-2 py-1"
              >
                <option value="">Select Table</option>
                {tables.map(table => (
                  <option
                    key={table._id}
                    value={table._id}
                    disabled={table.status !== 'available'}
                  >
                    {table.number || `Table ${table._id}`}
                    {table.status !== 'available' ? ' (Occupied)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Customer Selection */}
          <div className="bg-white p-3 rounded-lg border">
            <label className="block text-xs font-medium text-gray-700 mb-1">Customer</label>
            <select
              value={selectedCustomer || ''}
              onChange={(e) => setSelectedCustomer(e.target.value || null)}
              className="w-full text-sm border border-gray-300 rounded px-2 py-1 mb-1"
            >
              <option value="">Select Customer</option>
              {customers.map(customer => (
                <option key={customer._id} value={customer._id}>
                  {customer.name}
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Customer name"
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
              className="w-full text-sm border border-gray-300 rounded px-2 py-1"
            />
          </div>
        </div>

        {/* NEW: Large Professional Search Bar */}
        <div className="mb-4 relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
            </svg>
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-lg shadow-sm"
            placeholder="Search products by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Categories */}
        <div className="flex gap-1 mb-2 sm:mb-3 overflow-x-auto pb-1 scrollbar-hide" style={{ WebkitOverflowScrolling: 'touch' }}>
          <button
            onClick={() => setSelectedCategory('All')}
            className={`px-3 py-1.5 rounded text-xs font-medium whitespace-nowrap ${selectedCategory === 'All'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 border'
              }`}
          >
            All
          </button>
          {categories.map(category => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-3 py-1.5 rounded text-xs font-medium whitespace-nowrap ${selectedCategory === category
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 border'
                }`}
            >
              {category}
            </button>
          ))}
        </div>

        {/* Products Grid - Compact Design */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-1.5 sm:gap-2 overflow-y-auto flex-1 min-h-0" style={{ maxHeight: 'calc(100vh - 300px)' }}>
          {filteredProducts.map(product => (
            <div
              key={product._id}
              onClick={() => addToCart(product)}
              className="bg-white p-2 rounded-lg border cursor-pointer hover:shadow-md transition-shadow group"
            >
              <div className="h-20 bg-gray-100 rounded mb-1 flex items-center justify-center overflow-hidden">
                <img
                  src={getProductImageUrl(product)}
                  alt={product.name}
                  className="h-full w-full object-cover rounded"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.style.display = 'none';
                    e.target.parentNode.classList.add('bg-gray-200');
                    e.target.parentNode.innerHTML = '<span class="text-xs text-gray-400">No Image</span>';
                  }}
                />
              </div>
              <h3 className="font-medium text-gray-800 text-xs leading-tight mb-1 group-hover:text-blue-600">
                {product.name}
              </h3>
              <p className="text-green-600 font-bold text-sm">
                {currencySymbol}{typeof product.price === 'number' ? product.price.toFixed(2) : '0.00'}
              </p>
              {product.stock !== undefined && (
                <p className={`text-xs ${product.stock < 10 ? 'text-red-500' : 'text-gray-500'}`}>
                  Stock: {product.stock}
                </p>
              )}
            </div>
          ))}
        </div>

        {filteredProducts.length === 0 && (
          <div className="text-center py-8 text-gray-500 text-sm">
            No products found in this category
          </div>
        )}
      </div>

      {/* Cart Section - 30% width on desktop, full width on mobile */}
      <div className="w-full lg:w-80 xl:w-96 bg-white border-t lg:border-l lg:border-t-0 shadow-lg flex flex-col h-auto lg:h-full max-h-[50vh] lg:max-h-none">
        {/* Cart Header */}
        <div className="p-2 sm:p-3 border-b bg-gray-50">
          <h2 className="font-bold text-sm sm:text-base text-gray-800">Current Order</h2>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1 text-xs text-gray-600 mt-1">
            <span>Items: {cart.reduce((sum, item) => sum + item.quantity, 0)}</span>
            <span className="text-xs">{orderType} • {selectedTable ? `Table ${tables.find(t => t._id === selectedTable)?.number}` : 'No Table'}</span>
          </div>
        </div>

        {/* Order Info */}
        <div className="p-2 sm:p-3 bg-blue-50 border-b">
          <div className="text-xs text-blue-800 space-y-1">
            {selectedCustomer || customer ? (
              <div><strong>Customer:</strong> {selectedCustomer ?
                customers.find(c => c._id === selectedCustomer)?.name :
                customer}</div>
            ) : (
              <div><strong>Customer:</strong> Walking Customer</div>
            )}
            {selectedTable && orderType === 'dine-in' && (
              <div><strong>Table:</strong> {tables.find(t => t._id === selectedTable)?.number}</div>
            )}
          </div>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-2 sm:p-3 min-h-0" style={{ maxHeight: 'calc(50vh - 200px)' }}>
          {cart.length === 0 ? (
            <div className="text-center text-gray-500 text-sm py-8">
              Cart is empty<br />
              <span className="text-xs">Select products to add to order</span>
            </div>
          ) : (
            <div className="space-y-2">
              {cart.map(item => (
                <div key={item._id} className="flex justify-between items-center border-b pb-2">
                  <div className="flex-1">
                    <h4 className="font-medium text-sm text-gray-800">{item.name}</h4>
                    <p className="text-gray-600 text-xs">{currencySymbol}{item.price.toFixed(2)} each</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => updateQuantity(item._id, item.quantity - 1)}
                      className="w-5 h-5 bg-gray-200 rounded flex items-center justify-center hover:bg-gray-300 text-xs"
                    >
                      -
                    </button>
                    <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item._id, item.quantity + 1)}
                      className="w-5 h-5 bg-gray-200 rounded flex items-center justify-center hover:bg-gray-300 text-xs"
                    >
                      +
                    </button>
                    <button
                      onClick={() => removeFromCart(item._id)}
                      className="ml-1 text-red-500 hover:text-red-700 text-sm"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cart Summary & Actions */}
        {cart.length > 0 && (
          <div className="border-t bg-gray-50">
            {/* Totals */}
            <div className="p-2 sm:p-3 space-y-1.5 sm:space-y-2">
              <div className="flex justify-between text-xs sm:text-sm">
                <span>Subtotal:</span>
                <span>{currencySymbol}{getCartTotal().toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs sm:text-sm">
                <span>Tax (5%):</span>
                <span>{currencySymbol}{getTaxAmount().toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold border-t pt-1.5 sm:pt-2 text-sm sm:text-base">
                <span>Total:</span>
                <span>{currencySymbol}{getGrandTotal().toFixed(2)}</span>
              </div>
            </div>

            {/* Payment Method */}
            <div className="px-2 sm:px-3 pb-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Payment Method:
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full text-xs sm:text-sm border border-gray-300 rounded px-2 py-1"
              >
                <option value="cash">Cash</option>
                <option value="card">Credit Card</option>
                <option value="zaad">ZAAD</option>
                <option value="sahal">SAHAL</option>
                <option value="edahab">E-DAHAB</option>
                <option value="mycash">MYCash</option>
              </select>
            </div>

            {/* Action Buttons */}
            <div className="p-2 sm:p-3 border-t bg-white space-y-2">
              {orderType === 'dine-in' && !selectedTable && (
                <div className="text-xs text-yellow-600 bg-yellow-50 p-1.5 sm:p-2 rounded text-center">
                  Please select a table
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={clearCart}
                  className="flex-1 bg-gray-500 text-white py-1.5 sm:py-2 rounded text-xs sm:text-sm font-medium hover:bg-gray-600 transition-colors"
                >
                  Clear
                </button>
                <button
                  onClick={printReceipt}
                  disabled={orderType === 'dine-in' && !selectedTable}
                  className="flex-1 bg-green-600 text-white py-1.5 sm:py-2 rounded text-xs sm:text-sm font-medium hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  Print & Pay
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default POS;
