import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { realApi } from '../api/realApi';
import { API_CONFIG } from '../config/api.config';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  CreditCard,
  ShoppingCart,
  Printer,
  User,
  Table,
  Percent,
  Tag,
  Clock,
  Calendar,
} from 'lucide-react';

const POS = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [tables, setTables] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [settings, setSettings] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedTable, setSelectedTable] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [orderType, setOrderType] = useState('dine-in');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [searchQuery, setSearchQuery] = useState('');

  // Financial State
  const [discount, setDiscount] = useState(0);
  const [vatPercentage, setVatPercentage] = useState(5);
  const [tipAmount, setTipAmount] = useState(0);

  const { user } = useAuth();

  // Real-time date and time
  const [currentDateTime, setCurrentDateTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    loadPOSData();
    loadSettings();
  }, []);

  /* Optimized Data Loading for "Soft and Quick" Feel */
  const loadPOSData = async () => {
    setLoading(true);

    // Load Products immediately
    realApi.getProducts()
      .then(response => {
        if (response.success) {
          const productsData = realApi.extractData(response) || [];
          setProducts(Array.isArray(productsData) ? productsData : []);
        }
      })
      .catch(err => console.error('Error loading products:', err))
      .finally(() => setLoading(false)); // Turn off loading as soon as products are here

    // Load Categories
    realApi.getCategories()
      .then(response => {
        if (response.success) {
          const categoriesData = realApi.extractData(response) || [];
          setCategories(['BREAKFAST & SNACKS', 'LUNCH', 'DINNER', 'DRINKS', 'OTHERS', ...categoriesData]);
        }
      })
      .catch(() => setCategories(['BREAKFAST & SNACKS', 'LUNCH', 'DINNER', 'DRINKS', 'OTHERS']));

    // Load Tables (Background)
    realApi.getAvailableTables()
      .then(response => {
        if (response.success) setTables(realApi.extractData(response) || []);
      })
      .catch(err => console.error('Error loading tables:', err));

    // Load Customers (Background)
    realApi.getCustomers()
      .then(response => {
        if (response.success) setCustomers(realApi.extractData(response) || []);
      })
      .catch(err => console.error('Error loading customers:', err));
  };

  const loadSettings = async () => {
    try {
      const response = await realApi.getSettings();
      if (response.success) {
        const settingsData = realApi.extractData(response);
        if (settingsData) {
          setSettings(settingsData);
          setVatPercentage(settingsData.taxRate || 5);
        }
      }
    } catch (error) {
      console.error('❌ Error loading settings:', error);
    }
  };

  const filteredProducts = products.filter(product => {
    const matchesCategory = selectedCategory === 'All' || product.category === selectedCategory;
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (product.barcode && product.barcode.includes(searchQuery));
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
        return [...prevCart, { ...product, quantity: 1 }];
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
    setCart(prevCart => prevCart.map(item =>
      item._id === productId ? { ...item, quantity: newQuantity } : item
    ));
  };

  const removeFromCart = (productId) => {
    setCart(prevCart => prevCart.filter(item => item._id !== productId));
  };

  const calculateTotals = () => {
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const vatAmount = subtotal * (vatPercentage / 100);
    const discountAmount = discount;
    const tip = tipAmount;
    const total = subtotal + vatAmount - discountAmount + tip;

    return {
      subtotal,
      vatAmount,
      discountAmount,
      tip,
      total
    };
  };

  const { subtotal, vatAmount, discountAmount, tip, total } = calculateTotals();

  const handleCreateOrder = async () => {
    if (cart.length === 0) return alert('Cart is empty');

    try {
      const orderData = {
        items: cart.map(item => ({
          product: item._id,
          quantity: item.quantity,
          price: item.price,
          name: item.name,
          total: item.price * item.quantity
        })),
        orderType,
        paymentMethod,
        tableId: selectedTable,
        customerId: selectedCustomer,
        subtotal,
        tax: vatAmount,
        discount: discountAmount,
        tip: tipAmount,
        finalTotal: total,
        orderDate: new Date().toISOString(),
        status: 'completed',
        paymentStatus: 'paid'
      };

      const response = await realApi.createOrder(orderData);
      if (response.success) {
        printReceipt(response.data);
        clearCart();
      }
    } catch (error) {
      console.error('Order creation error:', error);
      alert('Error creating order');
    }
  };

  const printReceipt = (order) => {
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (!printWindow) return;

    const formattedDate = new Date().toLocaleString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).replace(',', '');

    // Calculate totals for receipt
    const currency = 'USD'; // Assuming USD as per image
    const localCurrencyRatio = 0; // From image: Total L/Currency: 0

    const receiptContent = `
      <html>
        <head>
          <title>Receipt</title>
          <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@400;500;700&display=swap');
            
            body { 
              font-family: 'Roboto Mono', monospace; 
              margin: 0;
              padding: 10px;
              color: #000;
              font-size: 12px;
              width: 300px; /* Thermal printer width approx */
            }
            .header { text-align: center; margin-bottom: 15px; }
            .restaurant-name { 
              font-size: 16px; 
              font-weight: bold; 
              margin: 0 0 5px 0;
            }
            .sub-header {
              font-size: 10px;
              margin-bottom: 5px;
            }
            .phones {
              font-size: 10px;
              border-bottom: 1px dashed #000;
              padding-bottom: 10px;
              margin-bottom: 10px;
            }
            .info-row {
              display: flex;
              margin-bottom: 2px;
            }
            .info-label {
              width: 80px;
            }
            .dashed-line {
              border-top: 1px dashed #000;
              margin: 10px 0;
            }
            .items-table {
              width: 100%;
              border-collapse: collapse;
              margin: 5px 0;
            }
            .items-table th {
              text-align: left;
              border-bottom: 1px dashed #000;
              padding-bottom: 5px;
              font-weight: normal;
              font-size: 10px;
            }
            .items-table td {
              padding: 5px 0;
              vertical-align: top;
            }
            .col-item { width: 50%; }
            .col-no { width: 10%; text-align: center; }
            .col-price { width: 20%; text-align: right; }
            .col-total { width: 20%; text-align: right; }
            
            .totals {
              margin-top: 10px;
              border-top: 1px dashed #000;
              padding-top: 5px;
            }
            .total-row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 3px;
            }
            .grand-total {
              font-weight: bold;
              font-size: 14px;
              margin-top: 5px;
              border-top: 1px dashed #000;
              padding-top: 5px;
            }
            .qr-container {
              display: flex;
              justify-content: center;
              margin: 20px 0;
            }
            .footer {
              text-align: center;
              font-size: 10px;
              margin-top: 10px;
            }
            .powered-by {
              font-size: 9px;
              color: #555;
              margin-top: 5px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 class="restaurant-name">Mamma Africa<br>Restaurant</h1>
            <div class="phones">
              ZAAD: 515735 - SAHAL: 523080<br>
              E-DAHAB: 742298 - MyCash: 931539
            </div>
          </div>
          
          <div class="info-row">
            <span class="info-label">Receipt Number:</span>
            <span>${order.orderNumber || '11291'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Served By:</span>
            <span>${user?.name || 'A'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Customer:</span>
            <span>${selectedCustomer ? customers.find(c => c._id === selectedCustomer)?.name : 'Walking Customer'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Date:</span>
            <span>${formattedDate}</span>
          </div>

          <div class="dashed-line"></div>

          <table class="items-table">
            <thead>
              <tr>
                <th class="col-item">Item</th>
                <th class="col-no">No.</th>
                <th class="col-price">Price</th>
                <th class="col-total">Total</th>
              </tr>
            </thead>
            <tbody>
              ${order.items.map((item, idx) => `
                <tr>
                  <td class="col-item">${idx + 1}. ${item.name}</td>
                  <td class="col-no">${item.quantity}</td>
                  <td class="col-price">${item.price.toFixed(2)}</td>
                  <td class="col-total">${(item.price * item.quantity).toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="totals">
            <div class="total-row">
              <span>Vat @ ${vatPercentage}%</span>
              <span>${order.tax.toFixed(2)}</span>
            </div>
            <div class="total-row">
              <span>Paid Amount</span>
              <span>${order.subtotal.toFixed(2)}</span>
            </div>
            <div class="dashed-line"></div>
            <div class="total-row grand-total">
              <span>Total :</span>
              <span>${order.finalTotal.toFixed(2)}</span>
            </div>
            <div class="total-row">
              <span>Total L/Currency :</span>
              <span>${(order.finalTotal * 1).toFixed(0)}</span>
            </div>
          </div>
          
          <div class="dashed-line"></div>

          <div class="qr-container">
            <div id="qrcode"></div>
          </div>

          <div class="footer">
            <div>Thank you for visiting us</div>
            <div class="powered-by">Powered by Hyper-Soft</div>
          </div>

          <script>
            setTimeout(() => {
              new QRCode(document.getElementById("qrcode"), {
                text: "ORDER-${order.orderNumber || Date.now()}",
                width: 100,
                height: 100,
                colorDark : "#000000",
                colorLight : "#ffffff",
                correctLevel : QRCode.CorrectLevel.H
              });
              
              // Auto print after QR generation
              setTimeout(() => {
                window.print();
                // window.close(); // Optional: close after print
              }, 500);
            }, 100);
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(receiptContent);
    printWindow.document.close();
  };

  const clearCart = () => {
    setCart([]);
    setSelectedTable(null);
    setSelectedCustomer(null);
    setDiscount(0);
    setTipAmount(0);
  };

  // Format date and time
  const formatTime = (date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="pos-fullscreen-container">
      {/* HEADER SECTION - UPDATED TO MATCH REFERENCE */}
      <div className="pos-header-bar">
        <div className="pos-branding">
          <div className="pos-logo-text">POS</div>
        </div>

        <div className="pos-header-actions">
          <div className="pos-header-tab" onClick={() => navigate('/orders')}>
            <span>Orders</span>
          </div>

          <div className="pos-search-wrapper">
            <Search size={18} className="text-gray-400" />
            <input
              type="text"
              placeholder="Search by Name or Barcode"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="pos-header-info">
          <div className="pos-user-display">
            <User size={18} />
            <span>{user?.name || 'Cashier'}</span>
          </div>
          <div className="pos-time-display">
            <span>{formatDate(currentDateTime)} {formatTime(currentDateTime)}</span>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="pos-main-content">
        {/* LEFT SIDE - PRODUCTS */}
        <div className="pos-products-section">
          {/* CATEGORY TABS */}
          <div className="pos-categories">
            {categories.map((category, index) => (
              <button
                key={index}
                className={`pos-category-tab ${selectedCategory === category ? 'active' : ''}`}
                onClick={() => setSelectedCategory(category)}
              >
                {category}
              </button>
            ))}
          </div>

          {/* PRODUCTS GRID */}
          <div className="pos-products-grid">
            {filteredProducts.map((product) => {
              const backendUrl = API_CONFIG.BACKEND_URL;
              let imageUrl = product.image || '';

              if (imageUrl && !imageUrl.startsWith('http')) {
                imageUrl = `${backendUrl}${imageUrl}`;
              } else if (imageUrl && imageUrl.includes('mama-africa1.onrender.com') && window.location.hostname === 'localhost') {
                imageUrl = imageUrl.replace('https://mama-africa1.onrender.com', 'http://localhost:5000');
              } else if (!imageUrl) {
                // Use a placeholder or nothing if no image
                imageUrl = '';
              }

              return (
                <div
                  key={product._id}
                  className="pos-product-card"
                  onClick={() => addToCart(product)}
                >
                  {imageUrl && (
                    <div style={{ width: '100%', height: '140px', marginBottom: '8px', overflow: 'hidden', borderRadius: '4px', flexShrink: 0 }}>
                      <img
                        src={imageUrl}
                        alt={product.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => e.target.style.display = 'none'}
                      />
                    </div>
                  )}
                  <div className="pos-product-name">{product.name}</div>
                  <div className="pos-product-price">${product.price.toFixed(2)}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT SIDE - CART & CONTROLS */}
        <div className="pos-cart-section">
          {/* ... (Cart Header and Items remain same, implicitly included via surrounding context if not changing) ... */}
          <div className="pos-cart-header">
            <h3>Order Details</h3>
            <div className="pos-cart-summary">
              <span>Items: {cart.reduce((sum, item) => sum + item.quantity, 0)}</span>
            </div>
          </div>

          <div className="pos-cart-items">
            {cart.length === 0 ? (
              <div className="pos-empty-cart">
                <ShoppingCart size={48} />
                <p>No items in cart</p>
              </div>
            ) : (
              cart.map((item) => (
                <div key={item._id} className="pos-cart-item">
                  <div className="pos-cart-item-info">
                    <div className="pos-cart-item-name">{item.name}</div>
                    <div className="pos-cart-item-price">${item.price.toFixed(2)}</div>
                  </div>
                  <div className="pos-cart-item-controls">
                    <button onClick={() => updateQuantity(item._id, item.quantity - 1)}>
                      <Minus size={16} />
                    </button>
                    <span className="pos-cart-item-quantity">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item._id, item.quantity + 1)}>
                      <Plus size={16} />
                    </button>
                    <button
                      onClick={() => removeFromCart(item._id)}
                      className="pos-cart-item-remove"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="pos-cart-item-subtotal">
                    ${(item.price * item.quantity).toFixed(2)}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* TOTALS SECTION */}
          <div className="pos-totals-section">
            <div className="pos-total-row">
              <span>Subtotal:</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="pos-total-row">
              <span>VAT ({vatPercentage}%):</span>
              <span>${vatAmount.toFixed(2)}</span>
            </div>
            <div className="pos-total-row">
              <span>Discount:</span>
              <span>-${discountAmount.toFixed(2)}</span>
            </div>
            <div className="pos-total-row">
              <span>Tip:</span>
              <span>${tip.toFixed(2)}</span>
            </div>
            <div className="pos-total-row grand-total">
              <span>Total:</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>

          {/* CONTROLS SECTION */}
          <div className="pos-controls-section">
            {/* TABLE & CUSTOMER SELECTION */}
            <div className="pos-selection-controls">
              <div className="pos-select-group">
                <label><Table size={16} /> Table</label>
                <select
                  value={selectedTable || ''}
                  onChange={(e) => setSelectedTable(e.target.value)}
                >
                  <option value="">Select Table</option>
                  {tables.map(table => (
                    <option key={table._id} value={table._id}>
                      {table.number} - {table.status}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pos-select-group">
                <label><User size={16} /> Customer</label>
                <select
                  value={selectedCustomer || ''}
                  onChange={(e) => setSelectedCustomer(e.target.value)}
                >
                  <option value="">Walk-in Customer</option>
                  {customers.map(customer => (
                    <option key={customer._id} value={customer._id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* DISCOUNT & VAT CONTROLS */}
            <div className="pos-discount-controls">
              <div className="pos-input-group">
                <label><Percent size={16} /> Discount</label>
                <input
                  type="number"
                  value={discount}
                  onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                  min="0"
                />
              </div>

              <div className="pos-input-group">
                <label><Tag size={16} /> Vat %</label>
                <input
                  type="number"
                  value={vatPercentage}
                  onChange={(e) => setVatPercentage(parseFloat(e.target.value) || 0)}
                  min="0"
                  max="100"
                />
              </div>
            </div>

            {/* ACTION BUTTONS */}
            <div className="pos-action-buttons">
              <button
                className="pos-btn-clear"
                onClick={clearCart}
                style={{
                  backgroundColor: '#ef4444',
                  color: 'white',
                  fontWeight: 'bold',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}
              >
                <Trash2 size={20} />
                Clear
              </button>

              <button className="pos-btn-vat">
                Vat {vatPercentage}%
              </button>

              <button
                className="pos-btn-create-order"
                onClick={handleCreateOrder}
                style={{
                  backgroundColor: '#2563eb',
                  color: 'white',
                  fontWeight: 'bold',
                  boxShadow: '0 4px 6px rgba(37, 99, 235, 0.2)',
                  transform: 'scale(1.02)'
                }}
              >
                <CreditCard size={20} />
                Create Order
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default POS;