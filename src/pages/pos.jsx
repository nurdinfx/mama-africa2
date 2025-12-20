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
        printReceipt(response.data, cart);
        clearCart();
      }
    } catch (error) {
      console.error('Order creation error:', error);
      alert('Error creating order');
    }
  };

  const printReceipt = (order, cartItems = null) => {
    const printWindow = window.open('', '_blank', 'width=58mm,height=auto');
    if (!printWindow) return;
    
    // Create a map of product names from cart items if available
    const productNameMap = {};
    if (cartItems && Array.isArray(cartItems)) {
      cartItems.forEach(item => {
        if (item._id && item.name) {
          productNameMap[item._id] = item.name;
        }
        // Also map by product ID if different from _id
        if (item.product && typeof item.product === 'string' && item.name) {
          productNameMap[item.product] = item.name;
        }
      });
    }
    
    // Also create a map from the products array if available
    if (products && Array.isArray(products)) {
      products.forEach(product => {
        if (product._id && product.name) {
          productNameMap[product._id] = product.name;
        }
      });
    }

    const formattedDate = new Date().toLocaleDateString('en-GB', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    }) + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

    // Calculate totals for receipt
    const receiptContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Receipt</title>
          <meta name="viewport" content="width=58mm, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            
            @page { 
              size: 58mm auto; 
              margin: 0mm; 
            }
            
            body { 
              font-family: 'Courier New', Courier, monospace; 
              margin: 0;
              padding: 0;
              padding-bottom: 0;
              margin-bottom: 0;
              color: #000;
              font-size: 11px;
              width: 58mm;
              max-width: 58mm;
              line-height: 1.2;
            }
            
            .header { 
              text-align: center; 
              margin-bottom: 3px; 
              padding: 0;
            }
            
            .restaurant-name { 
              font-size: 13px; 
              font-weight: bold; 
              margin: 0;
              line-height: 1.2;
              padding: 0;
            }
            
            .phones {
              font-size: 9px;
              border-bottom: 1px dashed #000;
              padding-bottom: 3px;
              margin-bottom: 3px;
              margin-top: 3px;
              line-height: 1.3;
            }
            
            .info-row {
              display: flex;
              margin-bottom: 1px;
              font-size: 10px;
              line-height: 1.3;
            }
            
            .info-label {
              min-width: 70px;
            }
            
            .dashed-line {
              border-top: 1px dashed #000;
              margin: 3px 0;
            }
            
            .items-table {
              width: 100%;
              border-collapse: collapse;
              margin: 3px 0;
              font-size: 10px;
            }
            
            .items-table th {
              text-align: left;
              padding-bottom: 2px;
              font-weight: normal;
              font-size: 10px;
            }
            
            .items-table td {
              padding: 2px 0;
              vertical-align: top;
              font-size: 10px;
            }
            
            .col-item { 
              width: 50%; 
              word-wrap: break-word;
            }
            
            .col-no { 
              width: 12%; 
              text-align: center; 
            }
            
            .col-price { 
              width: 18%; 
              text-align: right; 
            }
            
            .col-total { 
              width: 20%; 
              text-align: right; 
            }
            
            .totals {
              margin-top: 3px;
              border-top: 1px dashed #000;
              padding-top: 3px;
              font-size: 10px;
            }
            
            .total-row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 1px;
              font-size: 10px;
            }
            
            .grand-total {
              font-weight: bold;
              font-size: 11px;
              margin-top: 3px;
              border-top: 1px dashed #000;
              padding-top: 3px;
            }
            
            .qr-container {
              display: flex;
              justify-content: center;
              margin: 8px 0 0 0;
              padding: 0;
            }
            
            #qrcode {
              display: inline-block;
            }
            
            #qrcode canvas,
            #qrcode img {
              max-width: 100%;
              height: auto;
            }
            
            .footer {
              text-align: center;
              font-size: 10px;
              margin-top: 3px;
              margin-bottom: 0;
              padding-bottom: 0;
            }
            
            .powered-by {
              font-size: 9px;
              color: #000;
              margin-top: 2px;
              margin-bottom: 0;
              padding-bottom: 0;
            }
            
            body > *:last-child {
              margin-bottom: 0 !important;
              padding-bottom: 0 !important;
            }
            
            @media print {
              body {
                width: 58mm !important;
                max-width: 58mm !important;
                margin: 0 !important;
                padding: 0 !important;
                padding-bottom: 0 !important;
                margin-bottom: 0 !important;
              }
              
              @page {
                size: 58mm auto;
                margin: 0mm;
                margin-bottom: 0mm !important;
                width: 58mm;
              }
              
              * {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              
              html, body {
                width: 58mm !important;
                max-width: 58mm !important;
                padding-bottom: 0 !important;
                margin-bottom: 0 !important;
              }
              
              .footer, .powered-by, .qr-container {
                margin-bottom: 0 !important;
                padding-bottom: 0 !important;
              }
              
              body > *:last-child {
                margin-bottom: 0 !important;
                padding-bottom: 0 !important;
              }
              
              html {
                height: auto !important;
                padding-bottom: 0 !important;
                margin-bottom: 0 !important;
              }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="restaurant-name">Mamma Africa<br>Restaurant</div>
            <div class="phones">
              ZAAD: 515735 - SAHAL: 523080<br>
              E-DAHAB:742298 - MyCash:931539
            </div>
          </div>
          
          <div class="info-row">
            <span class="info-label">Receipt Number:</span>
            <span>${order.orderNumber || '11517'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Served By :</span>
            <span>${user?.name || 'bilal'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Customer :</span>
            <span>${selectedCustomer ? customers.find(c => c._id === selectedCustomer)?.name : 'Walking Customer'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Date :</span>
            <span>${formattedDate}</span>
          </div>

          <div class="dashed-line"></div>

          <table class="items-table">
            <thead>
              <tr>
                <th class="col-item">Item.</th>
                <th class="col-no">No.</th>
                <th class="col-price">Price.</th>
                <th class="col-total">Total</th>
              </tr>
            </thead>
            <tbody>
              ${order.items.map((item, idx) => {
                // Try multiple ways to get the product name
                let itemName = item.name || 
                              item.product?.name || 
                              item.product?.product?.name ||
                              (item.product && typeof item.product === 'string' ? productNameMap[item.product] : null) ||
                              (item.product?._id ? productNameMap[item.product._id] : null) ||
                              (item._id ? productNameMap[item._id] : null) ||
                              (item.productId ? productNameMap[item.productId] : null) ||
                              'Item';
                const itemPrice = item.price || item.product?.price || 0;
                const itemQuantity = item.quantity || 1;
                return `
                <tr>
                  <td class="col-item">${itemName}</td>
                  <td class="col-no">${itemQuantity}</td>
                  <td class="col-price">${itemPrice.toFixed(1)}</td>
                  <td class="col-total">${(itemPrice * itemQuantity).toFixed(1)}</td>
                </tr>
              `;
              }).join('')}
            </tbody>
          </table>

          <div class="totals">
            <div class="total-row">
              <span>Vat @ ${vatPercentage}%</span>
              <span>${order.tax.toFixed(1)}</span>
            </div>
            <div class="total-row">
              <span>Paid Amount</span>
              <span>0</span>
            </div>
            <div class="dashed-line"></div>
            <div class="total-row grand-total">
              <span>Total :</span>
              <span>${order.finalTotal.toFixed(1)}</span>
            </div>
            <div class="total-row">
              <span>Total L/Currency :</span>
              <span>0</span>
            </div>
          </div>
          
          <div class="dashed-line"></div>

          <div class="qr-container">
            <div id="qrcode"></div>
          </div>

          <div class="footer">
            <div>Thank you for visiting us</div>
            <div class="powered-by">POWERED-BY HUDI POS</div>
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
              
              setTimeout(() => {
                window.print();
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