import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { realApi } from '../api/realApi';
import { API_CONFIG } from '../config/api.config';
import { useNavigate } from 'react-router-dom';
import Tables from './tables';
import Kitchen from './kitchen';
import {
  LogOut,
  LayoutGrid,
  ChefHat,
  Receipt,
  Clock,
  User,
  Monitor,
  Search,
  Plus,
  Minus,
  Trash2,
  CheckCircle,
  Menu,
  X,
  CreditCard,
  DollarSign,
  Coffee,
  Utensils
} from 'lucide-react';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [editingItem, setEditingItem] = useState(null);

  // Financial State
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState('percent');
  const [tipPercentage, setTipPercentage] = useState(0);

  // Layout State
  const [activeTab, setActiveTab] = useState('ORDER');
  const [currentTime, setCurrentTime] = useState(new Date());

  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    loadPOSData();
    loadSettings();
  }, []);

  // Set default tab based on role
  useEffect(() => {
    if (user?.role === 'waiter') {
      setActiveTab('TABLES');
    } else {
      setActiveTab('ORDER');
    }
  }, [user]);

  const loadPOSData = async () => {
    try {
      setLoading(true);
      const [productsResponse, categoriesResponse, tablesResponse, customersResponse] = await Promise.all([
        realApi.getProducts(),
        realApi.getCategories(),
        realApi.getAvailableTables(),
        realApi.getCustomers()
      ]);

      if (productsResponse.success) {
        const productsData = realApi.extractData(productsResponse) || [];
        setProducts(Array.isArray(productsData) ? productsData : []);
      }
      if (categoriesResponse.success) {
        const categoriesData = realApi.extractData(categoriesResponse) || [];
        setCategories(Array.isArray(categoriesData) ? categoriesData : []);
      } else {
        setCategories(['Main Course', 'Salads', 'Sides', 'Beverages', 'Desserts']);
      }
      if (tablesResponse.success) setTables(realApi.extractData(tablesResponse) || []);
      if (customersResponse.success) setCustomers(realApi.extractData(customersResponse) || []);

    } catch (error) {
      console.error('❌ Error loading POS data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSettings = async () => {
    try {
      setSettingsLoading(true);
      const response = await realApi.getSettings();
      if (response.success) {
        const settingsData = realApi.extractData(response);
        if (settingsData) setSettings(settingsData);
      }
    } catch (error) {
      console.error('❌ Error loading settings:', error);
    } finally {
      setSettingsLoading(false);
    }
  };

  const getProductImageUrl = (product) => {
    if (!product.image) return '/no-image.png';
    if (product.image.startsWith('http')) {
      if (window.location.hostname === 'localhost' && product.image.includes('mama-africa1.onrender.com')) {
        return product.image.replace('https://mama-africa1.onrender.com', 'http://localhost:5000');
      }
      return product.image;
    }
    const backendUrl = API_CONFIG.BACKEND_URL;
    if (product.image.startsWith('/uploads')) return `${backendUrl}${product.image}`;
    return `${backendUrl}/uploads/products/${product.image}`;
  };

  const filteredProducts = products.filter(product => {
    const matchesCategory = selectedCategory === 'All' || product.category === selectedCategory;
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const addToCart = (product) => {
    if (product.stock !== undefined && product.stock <= 0) {
      alert('This product is out of stock');
      return;
    }
    setCart(prevCart => {
      const existingItem = prevCart.find(item => item._id === product._id);
      if (existingItem) {
        if (product.stock !== undefined && (existingItem.quantity + 1) > product.stock) {
          alert(`Only ${product.stock} items available in stock`);
          return prevCart;
        }
        return prevCart.map(item =>
          item._id === product._id ? { ...item, quantity: item.quantity + 1 } : item
        );
      } else {
        return [...prevCart, { ...product, quantity: 1, addedAt: new Date().toISOString() }];
      }
    });
  };

  const updateQuantity = (productId, newQuantity) => {
    if (newQuantity < 1) {
      removeFromCart(productId);
      return;
    }
    const productInCart = cart.find(item => item._id === productId);
    if (productInCart && productInCart.stock !== undefined && newQuantity > productInCart.stock) {
      alert(`Only ${productInCart.stock} items available in stock`);
      return;
    }
    setCart(prevCart => prevCart.map(item => item._id === productId ? { ...item, quantity: newQuantity } : item));
  };

  const removeFromCart = (productId) => {
    setCart(prevCart => prevCart.filter(item => item._id !== productId));
  };

  const getFinancials = () => {
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    let discountAmount = discountType === 'percent' ? subtotal * (discount / 100) : (parseFloat(discount) || 0);
    const taxableAmount = Math.max(0, subtotal - discountAmount);
    const tax = taxableAmount * ((settings?.taxRate || 5) / 100);
    const tipAmount = tipPercentage > 0 ? (taxableAmount * (tipPercentage / 100)) : 0;
    const total = taxableAmount + tax + tipAmount;
    return { subtotal, discountAmount, tax, tipAmount, total };
  };

  const { subtotal, discountAmount, tax, tipAmount, total } = getFinancials();

  const printReceipt = (order) => {
    const printWindow = window.open('', '_blank', 'width=300,height=600');
    if (!printWindow) {
      alert('Please allow popups to print receipts');
      return;
    }

    const now = new Date();
    const formattedDate = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}  ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const restaurantName = settings?.restaurantName || 'Mama Africa Restaurant';
    const receiptNumber = order.orderNumber || Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    const serverName = user?.name || 'System';

    // Calculate totals if not in order object
    const pSubtotal = order.subtotal || subtotal || 0;
    const pTax = order.tax || tax || 0;
    const pDiscount = order.discount || discountAmount || 0;
    const pTotal = order.finalTotal || total || 0;

    const receiptContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Restaurant Receipt</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: 'Courier New', monospace; 
              font-size: 12px; 
              margin: 0; 
              padding: 10px; 
              width: 280px;
              color: black;
            }
            .header { text-align: center; margin-bottom: 10px; border-bottom: 1px dashed #000; padding-bottom: 8px; }
            .restaurant-name { font-size: 14px; font-weight: bold; margin-bottom: 5px; text-transform: uppercase; }
            .payment-methods { text-align: center; font-size: 10px; margin-bottom: 8px; line-height: 1.2; }
            .order-info { margin-bottom: 8px; font-size: 10px; line-height: 1.3; }
            .items { margin: 8px 0; border-bottom: 1px dashed #000; padding-bottom: 8px; }
            .item-row { display: flex; justify-content: space-between; margin-bottom: 2px; font-size: 10px; }
            .item-name { flex: 2; }
            .item-qty { flex: 1; text-align: center; }
            .item-price { flex: 1; text-align: right; }
            .totals { margin: 8px 0; border-bottom: 1px dashed #000; padding-bottom: 8px; }
            .total-row { display: flex; justify-content: space-between; margin-bottom: 2px; font-size: 10px; }
            .grand-total { font-weight: bold; font-size: 12px; }
            .footer { text-align: center; margin-top: 10px; font-size: 10px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="restaurant-name">${restaurantName}</div>
            <div class="payment-methods">
              ZAAD: 515735 - SAHAL: 523080-<br>
              E-DAHAB: 742298 - MYCash: 931539
            </div>
          </div>
          
          <div class="order-info">
            <div><strong>Receipt No:</strong> ${receiptNumber}</div>
            <div><strong>Server:</strong> ${serverName}</div>
            <div><strong>Date:</strong> ${formattedDate}</div>
            ${order.tableId ? `<div><strong>Table:</strong> ${tables.find(t => t._id === order.tableId)?.number || 'N/A'}</div>` : ''}
            <div><strong>Customer:</strong> ${order.customerName || 'Walk-in'}</div>
          </div>

          <div class="items">
            <div class="item-row" style="font-weight:bold; border-bottom:1px solid #eee; margin-bottom:4px">
              <span class="item-name">Item</span>
              <span class="item-qty">Qty</span>
              <span class="item-price">Total</span>
            </div>
            ${order.items.map(item => `
              <div class="item-row">
                <span class="item-name">${item.name || item.product?.name}</span>
                <span class="item-qty">${item.quantity}</span>
                <span class="item-price">${(item.price * item.quantity).toFixed(2)}</span>
              </div>
            `).join('')}
          </div>

          <div class="totals">
            <div class="total-row"><span>Subtotal</span><span>$${pSubtotal.toFixed(2)}</span></div>
            ${pDiscount > 0 ? `<div class="total-row"><span>Discount</span><span>-$${pDiscount.toFixed(2)}</span></div>` : ''}
            <div class="total-row"><span>Tax</span><span>$${pTax.toFixed(2)}</span></div>
            <div class="total-row grand-total"><span>TOTAL</span><span>$${pTotal.toFixed(2)}</span></div>
          </div>

          <div class="footer">
            <div style="font-weight:bold">Thank You!</div>
            <div style="margin: 10px 0;">
              <img src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${receiptNumber}" alt="QR Code" width="80" height="80" />
            </div>
            <div style="font-size: 9px; color: #555;">Powered by Hudi-SomProjects</div>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(receiptContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return alert('Cart is empty');
    if (orderType === 'dine-in' && !selectedTable) return alert('Please select a table for dine-in orders');

    try {
      const orderData = {
        items: cart.map(item => ({
          product: item._id, quantity: item.quantity, price: item.price, name: item.name,
          modifiers: item.modifiers, notes: item.notes, total: item.price * item.quantity
        })),
        orderType, paymentMethod, tableId: selectedTable, customerId: selectedCustomer,
        customerName: selectedCustomer ? customers.find(c => c._id === selectedCustomer)?.name : customer || 'Walking Customer',
        subtotal, tax, discount: discountAmount, tip: tipAmount, finalTotal: total,
        orderDate: new Date().toISOString(), taxRate: settings?.taxRate || 5, currency: settings?.currency || 'USD',
        status: 'completed', paymentStatus: 'paid'
      };

      const response = await realApi.createOrder(orderData);
      if (response.success) {
        // Automatically print receipt
        // Use response data if available, or fallback to local data
        const createdOrder = response.data || { ...orderData, orderNumber: 'POS-' + Date.now().toString().slice(-4) };
        printReceipt(createdOrder);

        // alert('Order created and sent to print!');
        clearCart();
      } else {
        throw new Error(response.message || 'Failed to create order');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      alert('Error creating order: ' + error.message);
    }
  };

  const handleSendToKitchen = async () => {
    if (cart.length === 0) return alert('Cart is empty');
    if (orderType === 'dine-in' && !selectedTable) return alert('Please select a table for dine-in orders');

    try {
      const orderData = {
        items: cart.map(item => ({
          product: item._id, quantity: item.quantity, price: item.price, name: item.name,
          modifiers: item.modifiers, notes: item.notes, total: item.price * item.quantity
        })),
        orderType, paymentMethod: 'pending', tableId: selectedTable, customerId: selectedCustomer,
        customerName: selectedCustomer ? customers.find(c => c._id === selectedCustomer)?.name : customer || 'Walking Customer',
        subtotal, tax, discount: discountAmount, tip: tipAmount, finalTotal: total,
        orderDate: new Date().toISOString(), taxRate: settings?.taxRate || 5, currency: settings?.currency || 'USD',
        status: 'pending', paymentStatus: 'unpaid'
      };

      const response = await realApi.createOrder(orderData);
      if (response.success) {
        alert('Order sent to Kitchen!');
        clearCart();
      } else {
        throw new Error(response.message || 'Failed to send order');
      }
    } catch (error) {
      console.error('Kitchen error:', error);
      alert('Error sending to kitchen: ' + error.message);
    }
  };

  const clearCart = () => {
    setCart([]);
    setSelectedTable(null);
    setSelectedCustomer(null);
    setCustomer('');
    setDiscount(0);
    setTipPercentage(0);
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  const formatTime = (date) => date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  // Render Component (Refined for Reference Match)
  return (
    <div className="flex h-screen bg-slate-900 font-sans text-slate-100 overflow-hidden">

      {/* 1. SIDEBAR (Dark, Left) */}
      <div className="w-20 bg-[#1e222e] flex flex-col items-center py-4 gap-4 z-20 shadow-2xl border-r border-slate-800">
        {/* Branding Placeholder */}
        <div className="mb-2">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="font-bold text-lg text-white">M</span>
          </div>
        </div>

        <NavIcon icon={LayoutGrid} label="POS" active={activeTab === 'ORDER'} onClick={() => setActiveTab('ORDER')} />
        <NavIcon icon={Utensils} label="Tables" active={activeTab === 'TABLES'} onClick={() => setActiveTab('TABLES')} />
        <NavIcon icon={ChefHat} label="Kitchen" active={activeTab === 'KITCHEN'} onClick={() => setActiveTab('KITCHEN')} />

        {/* Spacer */}
        <div className="flex-1" />

        <NavIcon icon={User} label="Profile" onClick={() => { }} />
        <NavIcon icon={LogOut} label="Exit" color="text-red-500" onClick={handleLogout} />
      </div>

      {/* 2. MAIN CONTENT AREA */}
      <div className="flex-1 flex overflow-hidden relative bg-slate-100">

        {activeTab === 'TABLES' && <Tables isPosMode={true} />}
        {activeTab === 'KITCHEN' && <Kitchen isPosMode={true} />}

        {activeTab === 'ORDER' && (
          <>
            {/* MIDDLE: MENU SECTION */}
            <div className="flex-1 flex flex-col bg-slate-200 overflow-hidden relative">

              {/* Blue Top Category Bar */}
              <div className="h-14 bg-[#1e222e] flex items-center shadow-md z-10 w-full overflow-hidden">
                <div className="flex-1 flex overflow-x-auto no-scrollbar">
                  <CategoryTab
                    label="All"
                    active={selectedCategory === 'All'}
                    onClick={() => setSelectedCategory('All')}
                  />
                  {categories.map((cat, idx) => (
                    <CategoryTab
                      key={idx}
                      label={cat}
                      active={selectedCategory === cat}
                      onClick={() => setSelectedCategory(cat)}
                    />
                  ))}
                </div>
                {/* Search in Top Right of Middle Pane */}
                {/* Search in Top Right of Middle Pane - Expanded */}
                <div className="w-96 px-6 border-l border-slate-700 bg-[#1e222e] flex items-center">
                  <div className="relative w-full">
                    <Search size={24} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg text-lg text-white pl-12 py-3 focus:border-blue-500 outline-none placeholder:text-slate-600"
                      placeholder="Search Products..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Products Area */}
              <div className="flex-1 overflow-y-auto p-4">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 pb-20">
                  {filteredProducts.map(product => (
                    <ProductCard
                      key={product._id}
                      product={product}
                      onClick={() => addToCart(product)}
                      getImageUrl={getProductImageUrl}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* RIGHT: CART SECTION */}
            <div className="w-[380px] bg-white flex flex-col shadow-2xl z-30 relative">

              {/* Cart Header */}
              <div className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4">
                <h2 className="text-slate-800 font-bold text-lg">Shopping Cart</h2>
                <button onClick={clearCart} className="text-red-500 hover:bg-red-50 p-1 rounded">
                  <Trash2 size={18} />
                </button>
              </div>

              {/* Order List */}
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {/* Table/Customer Header */}
                <div className="grid grid-cols-2 gap-2 mb-2 p-2">
                  <select
                    className="bg-slate-50 border border-slate-200 text-xs rounded p-1.5 outline-none text-slate-700"
                    value={selectedTable || ''}
                    onChange={(e) => setSelectedTable(e.target.value)}
                  >
                    <option value="">Table</option>
                    {tables.map(t => <option key={t._id} value={t._id}>{t.number}</option>)}
                  </select>
                  <select
                    className="bg-slate-50 border border-slate-200 text-xs rounded p-1.5 outline-none text-slate-700"
                    value={selectedCustomer || ''}
                    onChange={(e) => setSelectedCustomer(e.target.value)}
                  >
                    <option value="">Walk-in</option>
                    {customers.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                  </select>
                </div>

                {cart.length === 0 ? (
                  <div className="h-40 flex flex-col items-center justify-center text-slate-300">
                    <LayoutGrid size={40} className="mb-2 opacity-20" />
                    <span className="text-sm">Empty Cart</span>
                  </div>
                ) : (
                  cart.map((item, index) => (
                    <div key={`${item._id}-${index}`} className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded border-b border-slate-100 last:border-0">
                      <div className="flex-1">
                        <div className="flex justify-between">
                          <span className="text-sm font-semibold text-slate-800">{item.name}</span>
                          <span className="text-sm font-bold text-slate-800">${(item.price * item.quantity).toFixed(2)}</span>
                        </div>
                        <div className="flex items-center gap-4 mt-1">
                          <span className="text-xs text-slate-500">${item.price}</span>
                          <div className="flex items-center gap-2">
                            <button onClick={() => updateQuantity(item._id, item.quantity - 1)} className="w-5 h-5 flex items-center justify-center bg-slate-100 rounded text-slate-600 hover:text-red-600 border border-slate-200"><Minus size={10} /></button>
                            <span className="text-xs font-bold w-4 text-center text-slate-700">{item.quantity}</span>
                            <button onClick={() => updateQuantity(item._id, item.quantity + 1)} className="w-5 h-5 flex items-center justify-center bg-slate-100 rounded text-slate-600 hover:text-blue-600 border border-slate-200"><Plus size={10} /></button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Footer Totals & Buttons */}
              <div className="bg-slate-50 p-4 border-t border-slate-200">
                <div className="space-y-1 mb-3 text-sm">
                  <div className="flex justify-between text-slate-500"><span>Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
                  <div className="flex justify-between text-slate-500"><span>Tax</span><span>${tax.toFixed(2)}</span></div>
                  {discountAmount > 0 && <div className="flex justify-between text-green-600"><span>Discount</span><span>-${discountAmount.toFixed(2)}</span></div>}
                  <div className="flex justify-between text-slate-800 font-bold text-lg pt-2 border-t border-slate-200 mt-1"><span>Total</span><span>${total.toFixed(2)}</span></div>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-3 h-12">
                  <button
                    onClick={clearCart}
                    className="bg-cyan-100 hover:bg-cyan-200 text-cyan-700 font-bold rounded-lg text-sm transition-colors"
                  >
                    Clear
                  </button>
                  <button
                    onClick={handleCheckout}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-sm shadow-lg shadow-blue-200 transition-all transform active:scale-95"
                  >
                    Place Order
                  </button>
                </div>
              </div>

            </div>
          </>
        )}
      </div>
    </div>
  );
};

// Sub-components for cleaner code
const NavIcon = ({ icon: Icon, label, active, onClick, color }) => (
  <button
    onClick={onClick}
    className={`flex flex-col items-center justify-center gap-1 w-16 h-16 rounded-xl transition-all ${active
      ? 'bg-blue-600 text-white shadow-lg'
      : 'hover:bg-slate-800 text-slate-400'
      }`}
  >
    <div className={`p-2 rounded-full ${color || 'bg-transparent'}`}>
      <Icon size={20} strokeWidth={2} className={active ? 'text-white' : 'text-slate-400'} />
    </div>
    <span className="text-[10px] font-medium leading-none">{label}</span>
  </button>
);

const CategoryTab = ({ label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`px-6 py-3 text-sm font-bold transition-colors relative flex items-center justify-center ${active
      ? 'bg-blue-600 text-white'
      : 'hover:bg-slate-800/50 text-slate-300 hover:text-white'
      }`}
  >
    {label}
    {active && (
      <div className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
    )}
  </button>
);

const ProductCard = ({ product, onClick, getImageUrl }) => (
  <div
    onClick={onClick}
    className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-xl transition-all cursor-pointer group relative flex flex-col h-48"
  >
    <div className="flex-1 relative overflow-hidden">
      <img
        src={getImageUrl(product)}
        alt={product.name}
        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
      />
      <div className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-bl-lg shadow-sm">
        {product.stock || 0}
      </div>
    </div>
    <div className="bg-blue-50 p-2 flex flex-col justify-between h-[35%]">
      <h3 className="font-bold text-slate-800 text-xs leading-tight line-clamp-2 text-center">{product.name}</h3>
      <div className="bg-blue-600 text-white text-center text-xs font-bold py-1 rounded w-full mt-1">
        ${product.price ? product.price.toFixed(2) : '0.00'}
      </div>
    </div>
  </div>
);

export default POS;


