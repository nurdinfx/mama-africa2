import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { realApi } from '../api/realApi';
import { API_CONFIG } from '../config/api.config';
import { getCache, setCache } from '../services/offlineCache';
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
import OrderCart from '../components/POS/OrderCart';

const POS = () => {
  const navigate = useNavigate();

  // Initialize state from cache for "Zero Wait" experience
  const [products, setProducts] = useState(() => getCache('pos_products', []));
  const [categories, setCategories] = useState(() => getCache('pos_categories', ['BREAKFAST & SNACKS', 'LUNCH', 'DINNER', 'DRINKS', 'OTHERS']));
  const [tables, setTables] = useState(() => getCache('pos_tables', []));
  const [customers, setCustomers] = useState(() => getCache('pos_customers', []));
  const [users, setUsers] = useState(() => getCache('pos_users', []));
  const [settings, setSettings] = useState(() => getCache('pos_settings', null));

  const [selectedCategory, setSelectedCategory] = useState(() => getCache('pos_selectedCategory', 'All'));
  const [cart, setCart] = useState(() => getCache('pos_cart', []));
  const [loading, setLoading] = useState(false);
  const [selectedTable, setSelectedTable] = useState(() => getCache('pos_selectedTable', null));
  const [selectedCustomer, setSelectedCustomer] = useState(() => getCache('pos_selectedCustomer', null));
  const [orderType, setOrderType] = useState(() => getCache('pos_orderType', 'dine-in'));
  const [paymentMethod, setPaymentMethod] = useState(() => getCache('pos_paymentMethod', 'cash'));
  const [searchQuery, setSearchQuery] = useState(() => getCache('pos_searchQuery', ''));

  // Financial State
  const [discount, setDiscount] = useState(() => getCache('pos_discount', 0));
  const [vatPercentage, setVatPercentage] = useState(() => getCache('pos_vatPercentage', 4));
  const [vatEnabled, setVatEnabled] = useState(() => getCache('pos_vatEnabled', true));
  const [tipAmount, setTipAmount] = useState(() => getCache('pos_tipAmount', 0));

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

  // Persist state changes to localStorage
  useEffect(() => { setCache('pos_cart', cart); }, [cart]);
  useEffect(() => { setCache('pos_searchQuery', searchQuery); }, [searchQuery]);
  useEffect(() => { setCache('pos_selectedCategory', selectedCategory); }, [selectedCategory]);
  useEffect(() => { setCache('pos_selectedTable', selectedTable); }, [selectedTable]);
  useEffect(() => { setCache('pos_selectedCustomer', selectedCustomer); }, [selectedCustomer]);
  useEffect(() => { setCache('pos_orderType', orderType); }, [orderType]);
  useEffect(() => { setCache('pos_paymentMethod', paymentMethod); }, [paymentMethod]);
  useEffect(() => { setCache('pos_discount', discount); }, [discount]);
  useEffect(() => { setCache('pos_tipAmount', tipAmount); }, [tipAmount]);
  useEffect(() => { setCache('pos_vatPercentage', vatPercentage); }, [vatPercentage]);
  useEffect(() => { setCache('pos_vatEnabled', vatEnabled); }, [vatEnabled]);

  /* Optimized Data Loading for "Soft and Quick" Feel */
  const loadPOSData = async () => {
    // If we have cached data, don't show the initial loading spinner
    // only show it if the products array is completely empty
    if (products.length === 0) {
      setLoading(true);
    }

    // Load Products immediately
    realApi.getProducts()
      .then(response => {
        if (response.success) {
          const productsData = realApi.extractData(response) || [];
          setProducts(Array.isArray(productsData) ? productsData : []);
          setCache('pos_products', productsData);
        }
      })
      .catch(err => console.error('Error loading products:', err))
      .finally(() => setLoading(false)); // Turn off loading as soon as products are here

    // Load Categories
    realApi.getCategories()
      .then(response => {
        if (response.success) {
          const categoriesData = realApi.extractData(response) || [];
          const allCategories = ['BREAKFAST & SNACKS', 'LUNCH', 'DINNER', 'DRINKS', 'OTHERS', ...categoriesData];
          setCategories(allCategories);
          setCache('pos_categories', allCategories);
        }
      })
      .catch(() => setCategories(['BREAKFAST & SNACKS', 'LUNCH', 'DINNER', 'DRINKS', 'OTHERS']));

    // Load Tables (Background)
    realApi.getAvailableTables()
      .then(response => {
        if (response.success) {
          const tablesData = realApi.extractData(response) || [];
          setTables(tablesData);
          setCache('pos_tables', tablesData);
        }
      })
      .catch(err => console.error('Error loading tables:', err));

    // Load Customers (Background)
    realApi.getCustomers()
      .then(response => {
        if (response.success) {
          const customersData = realApi.extractData(response) || [];
          setCustomers(customersData);
          setCache('pos_customers', customersData);
        }
      })
      .catch(err => console.error('Error loading customers:', err));

    // Load Users
    realApi.getUsers()
      .then(response => {
        if (response.success) {
          const usersData = realApi.extractData(response) || [];
          setUsers(usersData);
          setCache('pos_users', usersData);
        }
      })
      .catch(err => console.error('Error loading users:', err));
  };

  const loadSettings = async () => {
    try {
      const response = await realApi.getSettings();
      if (response.success) {
        const settingsData = realApi.extractData(response);
        if (settingsData) {
          setSettings(settingsData);
          setVatPercentage(settingsData.taxRate || 4);
          setCache('pos_settings', settingsData);
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
    const vatAmount = vatEnabled ? subtotal * (vatPercentage / 100) : 0;
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

  const handleCreateOrder = async (orderDetails = {}) => {
    if (cart.length === 0) return alert('Cart is empty');

    const currentVatEnabled = vatEnabled; // Capture current state

    try {
      const orderData = {
        items: cart.map(item => ({
          product: item._id || item.product?._id || item.id,
          quantity: item.quantity,
          price: item.price,
          name: item.name || item.product?.name,
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
        paymentStatus: 'paid',
        servedBy: orderDetails.servedBy || user?._id, // Use selected server or logged in user
        remarks: orderDetails.remarks
      };

      const response = await realApi.createOrder(orderData);
      if (response.success) {
        // Pass local overrides to ensure receipt matches UI even if backend recalculates differently
        printReceipt(response.data, cart, {
          servedBy: orderDetails.servedBy || user?._id,
          vatEnabled: currentVatEnabled,
          // Pass the calculated VAT amount from frontend to compare/use 
          frontendTax: vatAmount
        });
        clearCart();
      }
    } catch (error) {
      console.error('Order creation error:', error);
      alert('Error creating order');
    }
  };

  const printReceipt = (order, cartItems = null, overrides = {}) => {
    const printWindow = window.open('', '_blank', 'width=450,height=600');
    if (!printWindow) return;

    // Map product names from cart items or product list to ensure we have names
    const productNameMap = {};
    if (cartItems && Array.isArray(cartItems)) {
      cartItems.forEach(item => {
        const id = item._id || item.product?._id || item.id;
        if (id && item.name) productNameMap[id] = item.name;
        // Fallback or variation handling
        if (item.product && typeof item.product === 'string' && item.name) productNameMap[item.product] = item.name;
      });
    }

    if (products && Array.isArray(products)) {
      products.forEach(product => {
        if (product._id && product.name) productNameMap[product._id] = product.name;
      });
    }

    const formattedDate = new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }) + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

    // Determine Served By Name - Prefer Override
    let serverName = 'Staff';
    // Use override if present, otherwise fall back to order data
    const servedByVal = overrides.servedBy || order.servedBy;
    const servedById = (servedByVal && typeof servedByVal === 'object') ? servedByVal._id : servedByVal;

    if (servedById) {
      const serverUser = users.find(u => u._id === servedById);
      if (serverUser) serverName = serverUser.name;
      else if (user?._id === servedById) serverName = user.name;
    } else {
      serverName = user?.name || 'Staff';
    }

    // Determine Final Calculation Values
    // If overrides.vatEnabled is actively false, force 0 tax.
    // Otherwise trust the order.tax (or backend value)
    const isVatEnabled = overrides.vatEnabled !== undefined ? overrides.vatEnabled : true;

    // Base values
    const receiptNumber = (order.orderNumber || '').split('-').pop() || Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    const displaySubtotal = order.subtotal || (order.finalTotal - order.tax);
    const displayTax = isVatEnabled ? (order.tax || 0) : 0.00;
    const displayDiscount = order.discount || 0;
    const displayTip = order.tip || 0;
    const displayTotal = displaySubtotal + displayTax - displayDiscount + displayTip;

    // Calculate totals for receipt
    const receiptContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Receipt</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
            
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            
            @page { 
              size: 80mm auto; 
              margin: 0mm; 
            }
            
            body { 
              font-family: 'Inter', sans-serif;
              margin: 0 auto;
              padding: 10px;
              color: #000;
              font-size: 13px;
              width: 80mm;
              max-width: 80mm;
              line-height: 1.4;
            }
            
            .header { 
              text-align: center; 
              margin-bottom: 5px; 
            }
            
            .restaurant-name { 
              font-size: 18px; 
              font-weight: 700; 
              margin-bottom: 2px;
            }

            .restaurant-subtitle {
              font-size: 16px;
              font-weight: 600;
              margin-bottom: 5px;
            }
            
            .phones {
              font-size: 12px;
              margin-bottom: 5px;
              text-align: center;
            }
            
            .dashed-line {
              border-top: 1px dashed #000;
              margin: 5px 0;
              width: 100%;
            }
            
            .info-section {
              margin: 5px 0;
            }

            .info-row {
              display: flex;
              margin-bottom: 2px;
              font-size: 13px;
            }
            
            .info-label {
              width: 120px;
              font-weight: 500;
            }

            .info-value {
              flex: 1;
              font-weight: 500;
              text-align: left;
            }
            
            .items-table {
              width: 100%;
              border-collapse: collapse;
              margin: 5px 0;
            }
            
            .items-table th {
              text-align: left;
              padding: 5px 0;
              font-weight: 600;
              font-size: 13px;
            }
            
            .items-table td {
              padding: 5px 0;
              vertical-align: top;
              font-size: 13px;
            }
            
            /* Column Widths matching 'Item.' and 'No.' */
            .col-item { 
              width: 85%; 
              text-align: left;
            }
            
            .col-no { 
              width: 15%; 
              text-align: center; 
            }
            
            .totals {
              margin-top: 10px;
              padding-top: 5px;
            }
            
            /* If user wants totals, remove display:none above. 
               For "Kitchen Receipt Order", totals are usually not needed, 
               and the provided image implies a simple list. 
               However, I'll keep the footer text. */
            
            .footer {
              text-align: center;
              font-size: 12px;
              margin-top: 15px;
              font-weight: 500;
            }
            
            .powered-by {
              font-size: 10px;
              color: #666;
              margin-top: 5px;
            }

            @media print {
              body {
                width: 80mm !important;
              }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="restaurant-name">Mamma Africa</div>
            <div class="restaurant-subtitle">Restaurant</div>
            <div class="phones">
              ZAAD: 515735 - SAHAL: 523080<br>
              E-DAHAB:742298 - MyCash:931539
            </div>
          </div>
          
          <div class="dashed-line"></div>
          
          <div class="info-section">
            <div class="info-row">
              <span class="info-label">Receipt Number :</span>
              <span class="info-value">${(order.orderNumber || '').split('-').pop() || '0001'}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Served By :</span>
              <span class="info-value">${serverName}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Customer :</span>
              <span class="info-value">${selectedCustomer ? customers.find(c => c._id === selectedCustomer)?.name : 'Walking Customer'}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Date :</span>
              <span class="info-value">${formattedDate}</span>
            </div>
          </div>

          <div class="dashed-line"></div>

          <table class="items-table">
            <thead>
              <tr>
                <th class="col-item">Item.</th>
                <th class="col-no">No.</th>
              </tr>
            </thead>
            <tbody>
              ${order.items.map((item) => {
      let itemName = item.name ||
        item.product?.name ||
        item.product?.product?.name ||
        (item.product && typeof item.product === 'string' ? productNameMap[item.product] : null) ||
        (item.product?._id ? productNameMap[item.product._id] : null) ||
        'Item';
      const itemQuantity = item.quantity || 1;
      return `
                  <tr>
                    <td class="col-item">${itemName}</td>
                    <td class="col-no">${itemQuantity}</td>
                  </tr>
                `;
    }).join('')}
            </tbody>
          </table>

          <div class="dashed-line"></div>

          <div class="totals">
            <div class="info-row">
              <span class="info-label">Subtotal:</span>
              <span class="info-value">$${displaySubtotal.toFixed(2)}</span>
            </div>
            <div class="info-row">
              <span class="info-label">VAT @ ${isVatEnabled ? vatPercentage : 0}%:</span>
              <span class="info-value">$${displayTax.toFixed(2)}</span>
            </div>
            ${displayDiscount > 0 ? `
            <div class="info-row">
              <span class="info-label">Discount:</span>
              <span class="info-value">-$${displayDiscount.toFixed(2)}</span>
            </div>` : ''}
            <div class="info-row" style="font-size: 16px; font-weight: 700; border-top: 1px solid #000; margin-top: 5px; padding-top: 5px;">
              <span class="info-label">TOTAL:</span>
              <span class="info-value">$${displayTotal.toFixed(2)}</span>
            </div>
          </div>
           
          <div class="footer">
            <!-- <div>Thank you for visiting us!</div> -->
            <!-- <div class="powered-by">POWERED BY HUDI POS</div> -->
          </div>

          <script>
            window.onload = function() {
              setTimeout(() => {
                window.print();
                window.onafterprint = function() {
                  window.close();
                };
              }, 500);
            };
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
        <div className="pos-cart-section" style={{ padding: 0, backgroundColor: 'transparent' }}>
          <OrderCart
            cart={cart}
            onUpdateQuantity={updateQuantity}
            onRemoveItem={removeFromCart}
            totals={calculateTotals()}
            orderType={orderType}
            onOrderTypeChange={setOrderType}
            tableNumber={selectedTable}
            onTableNumberChange={setSelectedTable}
            customer={customers.find(c => c._id === selectedCustomer)}
            onPlaceOrder={handleCreateOrder}
            onClearCart={clearCart}
            vatEnabled={vatEnabled}
            setVatEnabled={setVatEnabled}
            users={users}
            customers={customers}
            tables={tables}
            onCustomerChange={(cust) => setSelectedCustomer(cust?._id)}
          />
        </div>
      </div>
    </div>
  );
};

export default POS;