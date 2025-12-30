// src/pages/Orders.jsx - Updated version

import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { realApi } from '../api/realApi';
import { API_CONFIG } from '../config/api.config';
import { io } from 'socket.io-client';
import { setCache, getCache } from '../services/offlineCache';
import { enqueue } from '../services/offlineQueue';
import { Link } from 'react-router-dom';

const Orders = () => {
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [paymentOrder, setPaymentOrder] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [updateOrderItems, setUpdateOrderItems] = useState([]);
  const [availableProducts, setAvailableProducts] = useState([]);
  const [restaurantSettings, setRestaurantSettings] = useState(null);
  const [filters, setFilters] = useState({
    status: '',
    customer: '',
    table: '',
    servedBy: '',
    room: '',
    search: ''
  });
  const [error, setError] = useState('');
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);
  const [summary, setSummary] = useState({
    vat: 0,
    pending: 0,
    totalAmount: 0
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [kitchenOrders, setKitchenOrders] = useState([]);
  const [showKitchenModal, setShowKitchenModal] = useState(false);
  const [kitchenStatusFilter, setKitchenStatusFilter] = useState('all');
  const itemsPerPage = 10;

  const { user } = useAuth();

  // New state for dropdown data
  const [users, setUsers] = useState([]);
  const [tables, setTables] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [rooms, setRooms] = useState(['Main Hall', 'VIP', 'Garden']); // Example rooms

  useEffect(() => {
    // Optimistic Load: Show cached data immediately
    const cached = getCache('orders');
    if (cached && Array.isArray(cached) && cached.length > 0) {
      console.log('⚡ Optimistic load: using cached orders');
      setOrders(cached);
      setLoading(false);
    }

    loadOrders();
    loadRestaurantSettings();
    setupSocketConnection();

    // Fetch dropdown data
    const loadDropdownData = async () => {
      try {
        const [usersRes, tablesRes, customersRes] = await Promise.all([
          realApi.getUsers(),
          realApi.getAvailableTables(),
          realApi.getCustomers()
        ]);
        if (usersRes.success) setUsers(realApi.extractData(usersRes) || []);
        if (tablesRes.success) setTables(realApi.extractData(tablesRes) || []);
        if (customersRes.success) setCustomers(realApi.extractData(customersRes) || []);
      } catch (err) {
        console.error("Error loading dropdown data", err);
      }
    };
    loadDropdownData();

    const interval = setInterval(loadOrders, 15000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  const setupSocketConnection = () => {
    const SOCKET_URL = API_CONFIG.SOCKET_URL;
    const socket = io(SOCKET_URL, { transports: ['websocket'] });
    const branchId = user?.branch?._id;

    if (branchId) {
      socket.emit('join-branch', branchId);
    }

    // Listen for new orders from POS
    socket.on('new-order', (order) => {
      if (!order || (branchId && String(order.branch) !== String(branchId))) return;
      console.log('New order received from POS:', order);

      setOrders(prev => {
        const exists = prev.some(o => o._id === order._id);
        const updated = exists ? prev.map(o => o._id === order._id ? order : o) : [order, ...prev];
        return updated;
      });

      // Also update kitchen orders if applicable
      if (order.status === 'pending' || order.status === 'confirmed' || order.status === 'preparing') {
        setKitchenOrders(prev => {
          const exists = prev.some(o => o._id === order._id);
          return exists ? prev.map(o => o._id === order._id ? order : o) : [order, ...prev];
        });
      }

      // Show notification for new order
      showNotification(`New order #${order.orderNumber} received from POS`);
    });

    // Listen for order status updates from kitchen
    socket.on('order-status-updated', (order) => {
      if (!order || (branchId && String(order.branch) !== String(branchId))) return;
      console.log('Order status updated from kitchen:', order);

      setOrders(prev => prev.map(o => o._id === order._id ? order : o));

      // Update kitchen orders
      setKitchenOrders(prev => prev.map(o => o._id === order._id ? order : o));

      showNotification(`Order #${order.orderNumber} status updated to ${order.status}`);
    });

    // Listen for order completion
    socket.on('order-completed', (order) => {
      if (!order || (branchId && String(order.branch) !== String(branchId))) return;
      console.log('Order completed:', order);

      setOrders(prev => prev.map(o => o._id === order._id ? order : o));
      showNotification(`Order #${order.orderNumber} completed`);
    });

    // Listen for POS order updates
    socket.on('pos-order-updated', (order) => {
      if (!order || (branchId && String(order.branch) !== String(branchId))) return;
      console.log('POS order updated:', order);

      setOrders(prev => prev.map(o => o._id === order._id ? order : o));
      showNotification(`Order #${order.orderNumber} updated from POS`);
    });

    return () => {
      socket.disconnect();
    };
  };

  const showNotification = (message) => {
    // Check if browser supports notifications
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("Restaurant POS", {
        body: message,
        icon: "/favicon.ico"
      });
    } else if ("Notification" in window && Notification.permission !== "denied") {
      Notification.requestPermission().then(permission => {
        if (permission === "granted") {
          new Notification("Restaurant POS", {
            body: message,
            icon: "/favicon.ico"
          });
        }
      });
    }

    // Also show browser alert as fallback
    console.log("Notification:", message);
  };

  useEffect(() => {
    filterOrders();
    updatePendingCount();
    calculateSummary();
    updateKitchenOrders();
  }, [orders, filters]);

  const loadRestaurantSettings = async () => {
    try {
      const response = await realApi.getSettings();
      if (response.success) {
        setRestaurantSettings(realApi.extractData(response));
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const loadOrders = async () => {
    try {
      // Don't set loading(true) here to allow background updates/optimistic UI
      setError('');
      console.log('🔄 Loading orders from backend...');

      const response = await realApi.getOrders();
      console.log('📋 Orders API response:', response);

      if (response.success) {
        const ordersData = realApi.extractData(response) || [];
        console.log('📋 Extracted orders data:', ordersData.length, 'orders');
        const ordersArray = Array.isArray(ordersData) ? ordersData : [];
        setOrders(ordersArray);
        setCache('orders', ordersArray);
      } else {
        throw new Error(response.message || 'Failed to load orders');
      }
    } catch (error) {
      console.error('❌ Failed to load orders:', error);
      setError(error.message || 'Failed to load orders');
      const cached = getCache('orders', null);
      if (cached && Array.isArray(cached)) {
        console.log('📦 Using cached orders:', cached.length);
        setOrders(cached);
      } else {
        setOrders([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableProducts = async () => {
    try {
      // Try to load products from real API
      try {
        const response = await realApi.getProducts();
        if (response.success) {
          setAvailableProducts(realApi.extractData(response) || []);
        }
      } catch (error) {
        // Fallback to demo products
        const demoProducts = [
          { _id: '1', name: 'Pizza Margherita', price: 12.99, category: 'Italian' },
          { _id: '2', name: 'Burger', price: 9.99, category: 'American' },
          { _id: '3', name: 'Pasta Carbonara', price: 14.99, category: 'Italian' },
          { _id: '4', name: 'Salad', price: 7.99, category: 'Healthy' },
          { _id: '5', name: 'Soda', price: 2.99, category: 'Drinks' },
          { _id: '6', name: 'Coffee', price: 3.49, category: 'Drinks' },
          { _id: '7', name: 'Dessert', price: 5.99, category: 'Desserts' },
          { _id: '8', name: 'Soup', price: 6.49, category: 'Appetizers' }
        ];
        setAvailableProducts(demoProducts);
      }
    } catch (error) {
      console.error('Failed to load products:', error);
    }
  };

  // Generate real order IDs from the image
  const generateRealOrderId = (index) => {
    const realIds = [
      '1.14, 2055',
      '2.11, 3399999999999',
      '2.2',
      '5.46',
      '4.83',
      '1.47'
    ];
    return realIds[index] || `ORD-${Date.now()}-${index}`;
  };

  // Generate demo orders with real IDs from image
  const generateDemoOrdersWithRealIds = () => {
    const currentDate = new Date();
    const realOrderIds = [
      '1.14, 2055',
      '2.11, 3399999999999',
      '2.2',
      '5.46',
      '4.83',
      '1.47'
    ];

    return realOrderIds.map((orderId, index) => ({
      _id: `order_${orderId.replace(/[.,]/g, '_')}`,
      orderNumber: orderId,
      customerName: index === 0 ? 'Table 3' : 'Dynamic SMS',
      tableNumber: index === 0 ? '3' : `FM 1.${21 + index}`,
      totalAmount: 25.50 + (index * 8),
      finalTotal: 28.25 + (index * 8),
      status: ['preparing', 'ready', 'completed', 'pending', 'confirmed', 'preparing'][index],
      paymentStatus: index === 1 || index === 2 ? 'paid' : 'pending',
      orderType: 'dine-in',
      orderDate: new Date(currentDate.getTime() - (index * 10 * 60000)).toISOString(),
      cashier: { name: index === 0 ? 'VBT' : 'System' },
      items: [
        { product: { name: 'Item 1' }, quantity: 2, price: 8.99, _id: `item_${index}_1` },
        { product: { name: 'Item 2' }, quantity: 1, price: 6.99, _id: `item_${index}_2` }
      ],
      taxAmount: 2.75,
      kitchenStatus: index === 0 ? 'preparing' : index === 1 ? 'ready' : 'pending',
      notes: index === 0 ? 'Extra cheese please' : '',
      station: ['grill', 'pizza', 'salad', 'grill', 'pizza', 'salad'][index]
    }));
  };

  const filterOrders = () => {
    let filtered = Array.isArray(orders) ? orders : [];

    if (filters.status) {
      filtered = filtered.filter(order => order.status === filters.status);
    }

    if (filters.customer) {
      filtered = filtered.filter(order =>
        order.customer?.name?.toLowerCase().includes(filters.customer.toLowerCase()) ||
        order.customerName?.toLowerCase().includes(filters.customer.toLowerCase())
      );
    }

    if (filters.table) {
      filtered = filtered.filter(order =>
        order.tableNumber?.toLowerCase().includes(filters.table.toLowerCase())
      );
    }

    if (filters.servedBy) {
      filtered = filtered.filter(order =>
        order.cashier?.name?.toLowerCase().includes(filters.servedBy.toLowerCase())
      );
    }

    if (filters.room) {
      filtered = filtered.filter(order =>
        order.room?.toLowerCase().includes(filters.room.toLowerCase())
      );
    }

    if (filters.search) {
      filtered = filtered.filter(order =>
        order.orderNumber?.toLowerCase().includes(filters.search.toLowerCase()) ||
        order.customerName?.toLowerCase().includes(filters.search.toLowerCase()) ||
        order.tableNumber?.toLowerCase().includes(filters.search.toLowerCase())
      );
    }

    setFilteredOrders(filtered);
  };

  const updateKitchenOrders = () => {
    const kitchenOrders = orders.filter(order =>
      ['pending', 'confirmed', 'preparing', 'ready'].includes(order.status)
    );
    setKitchenOrders(kitchenOrders);
  };

  const updatePendingCount = () => {
    const pending = orders.filter(order =>
      ['pending', 'confirmed', 'preparing'].includes(order.status)
    ).length;
    setPendingOrdersCount(pending);
  };

  const calculateSummary = () => {
    const filtered = Array.isArray(filteredOrders) ? filteredOrders : [];
    const vat = filtered.reduce((sum, o) => sum + (o.taxAmount || 0), 0);
    const pending = filtered.filter(o => o.paymentStatus !== 'paid');
    const pendingAmount = pending.reduce((sum, o) => sum + (o.finalTotal || o.totalAmount || 0), 0);
    const totalAmount = filtered.reduce((sum, o) => sum + (o.finalTotal || o.totalAmount || 0), 0);

    setSummary({ vat, pending: pendingAmount, totalAmount });
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      const response = await realApi.updateOrderStatus(orderId, { status: newStatus });

      if (response.success) {
        setOrders(prev =>
          prev.map(order =>
            order._id === orderId ? { ...order, status: newStatus } : order
          )
        );
        showNotification(`Order status updated to ${newStatus}`);
      } else {
        throw new Error(response.message || 'Failed to update order status');
      }
    } catch (error) {
      console.error('Failed to update order status:', error);
      alert(error.message || 'Failed to update order status');
    }
  };

  const updateKitchenOrderStatus = async (orderId, kitchenStatus) => {
    try {
      const response = await realApi.updateOrderStatus(orderId, { kitchenStatus });

      if (response.success) {
        const updated = response.data || { _id: orderId, kitchenStatus };
        setOrders(prev =>
          prev.map(order =>
            order._id === orderId ? { ...order, status: updated.status || order.status, kitchenStatus: updated.kitchenStatus || kitchenStatus, updatedAt: updated.updatedAt || new Date().toISOString() } : order
          )
        );
        setKitchenOrders(prev =>
          prev.map(order =>
            order._id === orderId ? { ...order, status: updated.status || order.status, kitchenStatus: updated.kitchenStatus || kitchenStatus, updatedAt: updated.updatedAt || new Date().toISOString() } : order
          )
        );
        showNotification(`Kitchen status updated to ${updated.kitchenStatus || kitchenStatus}`);
      } else {
        throw new Error(response.message || 'Failed to update kitchen status');
      }
    } catch (error) {
      console.error('Failed to update kitchen status:', error);
      alert(error.message || 'Failed to update kitchen status');
    }
  };

  const processPayment = async (orderId, paymentData) => {
    try {
      const response = await realApi.processPayment(orderId, paymentData);

      if (response.success) {
        setOrders(prev =>
          prev.map(order =>
            order._id === orderId ? {
              ...order,
              paymentStatus: 'paid',
              status: 'completed',
              paymentMethod: paymentData.paymentMethod,
              paidAt: new Date().toISOString()
            } : order
          )
        );
        setShowPaymentModal(false);
        setPaymentOrder(null);
        setPaymentAmount('');
        showNotification('Payment processed successfully!');
      } else {
        throw new Error(response.message || 'Failed to process payment');
      }
    } catch (error) {
      console.error('Failed to process payment:', error);
      alert(error.message || 'Failed to process payment');
    }
  };

  const handleUpdateOrder = async (order) => {
    try {
      setSelectedOrder(order);
      // Ensure items have proper structure
      const itemsWithIds = order.items.map((item, index) => {
        // If product is missing but we have a name, keep the name
        // but don't generate a fake ObjectId that will fail backend validation
        let productData = item.product;
        if (!productData) {
          productData = { name: item.name || 'Item' };
        }

        return {
          ...item,
          _id: item._id || `item_${Date.now()}_${index}`,
          product: productData
        };
      });
      setUpdateOrderItems(itemsWithIds);
      await loadAvailableProducts();
      setShowUpdateModal(true);
    } catch (error) {
      console.error('Failed to prepare order update:', error);
      alert('Failed to load order details');
    }
  };

  const addItemToUpdate = (product) => {
    const existingItemIndex = updateOrderItems.findIndex(
      item => item.product?._id === product._id || item.product === product._id
    );

    if (existingItemIndex > -1) {
      // Update quantity if item already exists
      const updatedItems = [...updateOrderItems];
      updatedItems[existingItemIndex].quantity += 1;
      updatedItems[existingItemIndex].total = updatedItems[existingItemIndex].price * updatedItems[existingItemIndex].quantity;
      setUpdateOrderItems(updatedItems);
    } else {
      // Add new item
      const newItem = {
        _id: `item_new_${Date.now()}_${updateOrderItems.length}`,
        product: product,
        quantity: 1,
        price: product.price,
        name: product.name,
        total: product.price
      };
      setUpdateOrderItems([...updateOrderItems, newItem]);
    }
  };

  const removeItemFromUpdate = (index) => {
    const updatedItems = [...updateOrderItems];
    updatedItems.splice(index, 1);
    setUpdateOrderItems(updatedItems);
  };

  const updateItemQuantity = (index, newQuantity) => {
    if (newQuantity < 1) {
      removeItemFromUpdate(index);
      return;
    }

    const updatedItems = [...updateOrderItems];
    updatedItems[index].quantity = newQuantity;
    updatedItems[index].total = updatedItems[index].price * newQuantity;
    setUpdateOrderItems(updatedItems);
  };

  const calculateUpdatedTotals = () => {
    const subtotal = updateOrderItems.reduce((sum, item) => sum + (item.total || item.price * item.quantity), 0);
    const taxRate = 0.05; // 5% tax to match POS
    const tax = subtotal * taxRate;
    const finalTotal = subtotal + tax;

    return { subtotal, tax, finalTotal };
  };

  const submitOrderUpdate = async () => {
    try {
      if (!selectedOrder) {
        alert('No order selected');
        return;
      }

      // Calculate new totals
      const { subtotal, tax, finalTotal } = calculateUpdatedTotals();

      // Prepare update data
      const updateData = {
        items: updateOrderItems.map(item => {
          // Extract product ID properly (handle both populated object and string ID)
          let productId = null;
          if (item.product && typeof item.product === 'object') {
            productId = item.product._id;
          } else if (typeof item.product === 'string') {
            productId = item.product;
          }

          // Only send if it looks like a valid MongoDB ObjectId (24 hex chars)
          const isValidObjectId = productId && /^[0-9a-fA-F]{24}$/.test(productId);

          if (!isValidObjectId) {
            console.warn('Item missing valid product ID, attempt to find by name:', item);
            // Try to find matching product by name from available products if ID is invalid
            const itemName = item.product?.name || item.name;
            const matchedProduct = availableProducts.find(p => p.name === itemName);
            if (matchedProduct) {
              productId = matchedProduct._id;
              console.log('✅ Matched product by name:', itemName, 'ID:', productId);
            }
          }

          return {
            product: productId,
            quantity: item.quantity,
            price: item.price,
            notes: item.notes,
            name: item.product?.name || item.name || 'Item'
          };
        }),
        subtotal,
        tax,
        finalTotal,
        updatedAt: new Date().toISOString()
      };

      let response;

      // Update order with real API
      response = await realApi.updateOrder(selectedOrder._id, updateData);

      if (response.success) {
        // Update local state
        setOrders(prev =>
          prev.map(order =>
            order._id === selectedOrder._id ? {
              ...order,
              items: updateOrderItems,
              subtotal,
              tax,
              finalTotal,
              taxAmount: tax,
              totalAmount: subtotal,
              updatedAt: new Date().toISOString()
            } : order
          )
        );

        setShowUpdateModal(false);
        setSelectedOrder(null);
        setUpdateOrderItems([]);

        // Print updated receipt with POS format
        printReceipt({
          ...selectedOrder,
          items: updateOrderItems,
          subtotal,
          tax,
          finalTotal,
          taxAmount: tax,
          totalAmount: subtotal,
          updatedAt: new Date().toISOString()
        }, true);

        showNotification('Order updated successfully! New items added and receipt printed.');
      } else {
        throw new Error(response.message || 'Failed to update order');
      }
    } catch (error) {
      console.error('Failed to update order:', error);
      alert(error.message || 'Failed to update order');
    }
  };

  const printReceipt = (order, isUpdated = false) => {
    const printWindow = window.open('', '_blank', 'width=450,height=600');
    if (!printWindow) return;

    const now = new Date();
    const formattedDate = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const originalOrderDate = order.orderDate ? new Date(order.orderDate) : now;
    const originalFormattedDate = `${String(originalOrderDate.getDate()).padStart(2, '0')}/${String(originalOrderDate.getMonth() + 1).padStart(2, '0')}/${originalOrderDate.getFullYear()} ${String(originalOrderDate.getHours()).padStart(2, '0')}:${String(originalOrderDate.getMinutes()).padStart(2, '0')}`;

    const restaurantName = restaurantSettings?.restaurantName || 'Mamma Africa Restaurant';
    const receiptNumber = order.orderNumber || Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    const serverName = order.cashier?.name || order.user?.name || 'System';

    // Calculate totals
    const subtotal = order.subtotal || order.totalAmount || 0;
    const taxAmount = order.taxAmount || order.tax || (subtotal * 0.05);
    const finalTotal = order.finalTotal || order.totalAmount || (subtotal + taxAmount);

    const receiptContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Receipt</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
            
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
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              margin: 0 auto;
              padding: 10px;
              color: #000;
              font-size: 14px;
              width: 80mm;
              max-width: 80mm;
              line-height: 1.4;
              -webkit-font-smoothing: antialiased;
            }
            
            .header { 
              text-align: center; 
              margin-bottom: 15px; 
            }
            
            .restaurant-name { 
              font-size: 20px; 
              font-weight: 700; 
              margin: 0 0 5px 0;
              line-height: 1.2;
              text-transform: uppercase;
            }
            
            .phones {
              font-size: 12px;
              border-bottom: 1.5px dashed #000;
              padding-bottom: 8px;
              margin-bottom: 10px;
              line-height: 1.5;
              font-weight: 500;
            }
            
            .info-section {
              margin-bottom: 10px;
            }

            .info-row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 3px;
              font-size: 13px;
              line-height: 1.4;
            }
            
            .info-label {
              font-weight: 600;
              color: #333;
            }

            .info-value {
              text-align: right;
              font-weight: 500;
            }
            
            .updated-notice {
              text-align: center;
              font-weight: 700;
              color: #C2410C;
              margin: 8px 0;
              padding: 5px;
              border: 1.5px dashed #C2410C;
              font-size: 12px;
              text-transform: uppercase;
            }
            
            .dashed-line {
              border-top: 1.5px dashed #000;
              margin: 10px 0;
            }
            
            .items-table {
              width: 100%;
              border-collapse: collapse;
              margin: 10px 0;
            }
            
            .items-table th {
              text-align: left;
              padding: 8px 0;
              font-weight: 700;
              font-size: 13px;
              border-bottom: 1px solid #000;
              text-transform: uppercase;
            }
            
            .items-table td {
              padding: 8px 0;
              vertical-align: top;
              font-size: 14px;
              border-bottom: 0.5px solid #eee;
            }
            
            .col-item { width: 45%; font-weight: 500; }
            .col-no { width: 10%; text-align: center; }
            .col-price { width: 20%; text-align: right; }
            .col-total { width: 25%; text-align: right; font-weight: 600; }
            
            .section-title {
              text-align: center;
              font-weight: 700;
              color: #444;
              margin: 15px 0 5px 0;
              font-size: 12px;
              text-transform: uppercase;
              letter-spacing: 1px;
            }
            
            .totals {
              margin-top: 10px;
              padding-top: 5px;
            }
            
            .total-row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 5px;
              font-size: 14px;
            }
            
            .grand-total {
              font-weight: 700;
              font-size: 22px;
              margin-top: 10px;
              border-top: 1.5px dashed #000;
              padding-top: 10px;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            
            .qr-container {
              display: flex;
              flex-direction: column;
              align-items: center;
              margin: 20px 0 10px 0;
            }
            
            #qrcode {
              padding: 5px;
              background: white;
            }
            
            .footer {
              text-align: center;
              font-size: 13px;
              margin-top: 10px;
              font-weight: 500;
            }
            
            .powered-by {
              font-size: 11px;
              color: #666;
              margin-top: 5px;
              font-weight: 600;
              letter-spacing: 0.5px;
            }
            
            @media print {
              body {
                width: 80mm !important;
                margin: 0 auto !important;
                padding: 10px !important;
              }
              @page {
                size: 80mm auto;
                margin: 0;
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
          
          ${isUpdated ? `<div class="updated-notice">*** UPDATED ORDER ***</div>` : ''}
          
          <div class="info-section">
            <div class="info-row">
              <span class="info-label">Receipt No:</span>
              <span class="info-value">#${receiptNumber}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Served By:</span>
              <span class="info-value">${serverName}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Customer:</span>
              <span class="info-value">${order.customer?.name || order.customerName || 'Walking Customer'}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Date:</span>
              <span class="info-value">${isUpdated ? originalFormattedDate : formattedDate}</span>
            </div>
            ${order.tableNumber ? `<div class="info-row"><span class="info-label">Table:</span><span class="info-value">${order.tableNumber}</span></div>` : ''}
            ${isUpdated ? `<div class="info-row"><span class="info-label">Updated:</span><span class="info-value">${formattedDate}</span></div>` : ''}
          </div>

          ${isUpdated ? `
            <div class="section-title">--- ORIGINAL ORDER ---</div>
            <table class="items-table">
              <thead>
                <tr>
                  <th class="col-item">Item</th>
                  <th class="col-no">Qty</th>
                  <th class="col-price">Price</th>
                  <th class="col-total">Total</th>
                </tr>
              </thead>
              <tbody>
                ${Array.isArray(selectedOrder?.items) ? selectedOrder.items.map(item => `
                  <tr>
                    <td class="col-item">${item.product?.name || item.name || 'Item'}</td>
                    <td class="col-no">${item.quantity}</td>
                    <td class="col-price">${(item.price || 0).toFixed(2)}</td>
                    <td class="col-total">${((item.price || 0) * (item.quantity || 1)).toFixed(2)}</td>
                  </tr>
                `).join('') : ''}
              </tbody>
            </table>
            
            <div class="section-title">--- ADDITIONAL ITEMS ---</div>
            <table class="items-table">
              <thead>
                <tr>
                  <th class="col-item">Item</th>
                  <th class="col-no">Qty</th>
                  <th class="col-price">Price</th>
                  <th class="col-total">Total</th>
                </tr>
              </thead>
              <tbody>
                ${Array.isArray(order.items) ? order.items.filter(item =>
      !selectedOrder?.items?.some(originalItem =>
        originalItem._id === item._id ||
        (originalItem.product?.name === item.product?.name && originalItem.price === item.price)
      )
    ).map(item => {
      const itemName = item.name || item.product?.name || item.product?.product?.name || 'Item';
      const itemPrice = item.price || item.product?.price || 0;
      const itemQuantity = item.quantity || 1;
      return `
                    <tr>
                      <td class="col-item">${itemName}</td>
                      <td class="col-no">${itemQuantity}</td>
                      <td class="col-price">${itemPrice.toFixed(2)}</td>
                      <td class="col-total">${(itemPrice * itemQuantity).toFixed(2)}</td>
                    </tr>
                  `;
    }).join('') : ''}
              </tbody>
            </table>
          ` : `
            <table class="items-table">
              <thead>
                <tr>
                  <th class="col-item">Item</th>
                  <th class="col-no">Qty</th>
                  <th class="col-price">Price</th>
                  <th class="col-total">Total</th>
                </tr>
              </thead>
              <tbody>
                ${Array.isArray(order.items) ? order.items.map(item => {
      const itemName = item.name || item.product?.name || item.product?.product?.name || 'Item';
      const itemPrice = item.price || item.product?.price || 0;
      const itemQuantity = item.quantity || 1;
      return `
                    <tr>
                      <td class="col-item">${itemName}</td>
                      <td class="col-no">${itemQuantity}</td>
                      <td class="col-price">${itemPrice.toFixed(2)}</td>
                      <td class="col-total">${(itemPrice * itemQuantity).toFixed(2)}</td>
                    </tr>
                  `;
    }).join('') : ''}
              </tbody>
            </table>
          `}

          <div class="totals">
            <div class="total-row">
              <span class="info-label">Subtotal</span>
              <span>$${subtotal.toFixed(2)}</span>
            </div>
            <div class="total-row">
              <span class="info-label">VAT @ 5%</span>
              <span>$${taxAmount.toFixed(2)}</span>
            </div>
            <div class="total-row">
              <span class="info-label">Paid Amount</span>
              <span>$${order.paymentStatus === 'paid' ? finalTotal.toFixed(2) : '0.00'}</span>
            </div>
            <div class="grand-total">
              <span>TOTAL</span>
              <span>$${finalTotal.toFixed(2)}</span>
            </div>
          </div>
          
          <div class="qr-container">
            <div id="qrcode"></div>
          </div>

          <div class="footer">
            <div>Thank you for visiting us!</div>
            <div class="powered-by">POWERED BY HUDI POS</div>
            ${isUpdated ? `<div style="color: #C2410C; font-weight: 700; margin-top: 5px; font-size: 11px;">*** UPDATED RECEIPT ***</div>` : ''}
          </div>

          <script>
            window.onload = function() {
              new QRCode(document.getElementById("qrcode"), {
                text: "ORDER-${receiptNumber}",
                width: 128,
                height: 128,
                colorDark : "#000000",
                colorLight : "#ffffff",
                correctLevel : QRCode.CorrectLevel.H
              });
              
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
    printWindow.focus();
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'bg-yellow-500 text-white',
      confirmed: 'bg-blue-500 text-white',
      preparing: 'bg-orange-500 text-white',
      ready: 'bg-green-500 text-white',
      completed: 'bg-gray-500 text-white',
      cancelled: 'bg-red-500 text-white'
    };
    return colors[status] || 'bg-gray-500 text-white';
  };

  const getKitchenStatusColor = (kitchenStatus) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      preparing: 'bg-orange-100 text-orange-800 border-orange-300',
      ready: 'bg-green-100 text-green-800 border-green-300',
      served: 'bg-blue-100 text-blue-800 border-blue-300'
    };
    return colors[kitchenStatus] || 'bg-gray-100 text-gray-800 border-gray-300';
  };

  const getStatusName = (status) => {
    const names = {
      pending: 'Pending',
      confirmed: 'Confirmed',
      preparing: 'Preparing',
      ready: 'Ready',
      completed: 'Completed',
      cancelled: 'Cancelled'
    };
    return names[status] || status;
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).replace(',', '');
  };

  const formatTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  const handlePayNow = (order) => {
    setPaymentOrder(order);
    setPaymentAmount(order.finalTotal || order.totalAmount || 0);
    setShowPaymentModal(true);
  };

  const handlePaymentSubmit = () => {
    if (paymentOrder && paymentAmount) {
      processPayment(paymentOrder._id, {
        paymentMethod: 'cash',
        amount: parseFloat(paymentAmount)
      });
    }
  };

  const handleShowKitchenOrders = () => {
    updateKitchenOrders();
    setShowKitchenModal(true);
  };

  const getFilteredKitchenOrders = () => {
    if (kitchenStatusFilter === 'all') return kitchenOrders;
    return kitchenOrders.filter(order => order.kitchenStatus === kitchenStatusFilter);
  };

  const getTimeElapsed = (createdAt) => {
    if (!createdAt) return '0m';
    const diff = Date.now() - new Date(createdAt).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  };

  // Pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredOrders.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);

  // Update logic to match exact columns
  const getOrderInfo = (order) => {
    const date = new Date(order.orderDate || order.createdAt);
    return (
      <div className="flex flex-col text-xs">
        <span className="font-bold text-blue-900">#{order.orderNumber}</span>
        <span className="text-gray-500">{date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        <span className={`font-semibold ${order.status === 'pending' ? 'text-red-500' : 'text-green-600'}`}>
          {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
        </span>
      </div>
    );
  };

  return (
    <div className="pos-fullscreen-container bg-[#f0f2f5] flex flex-col h-screen overflow-hidden text-sm font-sans">

      {/* 1. TOP HEADER (Blue Bar) */}
      <div className="bg-[#1e4c82] text-white flex items-center justify-between px-2 py-1 h-[50px] shrink-0 shadow-md">
        <div className="flex items-center gap-4 w-full">
          <div className="bg-[#163a63] p-1 rounded px-3 shrink-0">
            <h1 className="text-lg font-bold">Orders</h1>
          </div>

          <div className="flex items-center gap-1 flex-1 overflow-x-auto">
            <button className="bg-[#2a62a3] hover:bg-[#3474bd] px-3 py-1 rounded text-xs border border-[#4a85c5] whitespace-nowrap">Other Printer</button>
            <button className="bg-[#2a62a3] hover:bg-[#3474bd] px-3 py-1 rounded text-xs border border-[#4a85c5] whitespace-nowrap">
              Pending Orders: {pendingOrdersCount}
            </button>
            <button className="bg-[#2a62a3] hover:bg-[#3474bd] px-3 py-1 rounded text-xs border border-[#4a85c5] whitespace-nowrap">Table Payment (Inv)</button>
            <button className="bg-[#2a62a3] hover:bg-[#3474bd] px-3 py-1 rounded text-xs border border-[#4a85c5] whitespace-nowrap">Table Payment</button>
            <Link to="/pos" className="bg-[#4caf50] hover:bg-[#43a047] text-white px-3 py-1 rounded text-xs border border-green-600 font-bold flex items-center gap-1 whitespace-nowrap">
              <span className="text-lg leading-none">+</span> Add
            </Link>
            <button className="bg-[#2a62a3] hover:bg-[#3474bd] px-3 py-1 rounded text-xs border border-[#4a85c5] whitespace-nowrap">More</button>
          </div>
        </div>
      </div>

      {/* 2. FILTERS BAR */}
      <div className="bg-[#e9ecef] border-b border-gray-300 p-2 shrink-0">
        <div className="grid grid-cols-12 gap-2 items-end">

          {/* Date Range */}
          <div className="col-span-2 flex items-center gap-1 bg-white border border-gray-300 rounded p-1 shadow-sm">
            <div className="flex flex-col w-1/2">
              <label className="text-[9px] text-gray-500 font-semibold pl-1">From</label>
              <input type="date" className="w-full text-xs outline-none bg-transparent" />
            </div>
            <div className="w-px h-6 bg-gray-300"></div>
            <div className="flex flex-col w-1/2">
              <label className="text-[9px] text-gray-500 font-semibold pl-1">To</label>
              <input type="date" className="w-full text-xs outline-none bg-transparent" />
            </div>
          </div>

          {/* Dropdowns */}
          <div className="col-span-1">
            <select className="w-full h-[34px] border border-gray-300 rounded px-1 text-xs bg-white focus:border-blue-500 outline-none shadow-sm"
              value={filters.servedBy} onChange={e => setFilters({ ...filters, servedBy: e.target.value })}>
              <option value="">Served by</option>
              {users.map(u => <option key={u._id} value={u.name}>{u.name}</option>)}
            </select>
          </div>

          <div className="col-span-2">
            <select className="w-full h-[34px] border border-gray-300 rounded px-1 text-xs bg-white focus:border-blue-500 outline-none shadow-sm"
              value={filters.customer} onChange={e => setFilters({ ...filters, customer: e.target.value })}>
              <option value="">Customer</option>
              {customers.map(c => <option key={c._id} value={c.name}>{c.name}</option>)}
            </select>
          </div>

          <div className="col-span-1">
            <select className="w-full h-[34px] border border-gray-300 rounded px-1 text-xs bg-white focus:border-blue-500 outline-none shadow-sm"
              value={filters.room} onChange={e => setFilters({ ...filters, room: e.target.value })}>
              <option value="">Rooms</option>
              {rooms.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          <div className="col-span-1">
            <select className="w-full h-[34px] border border-gray-300 rounded px-1 text-xs bg-white focus:border-blue-500 outline-none shadow-sm"
              value={filters.table} onChange={e => setFilters({ ...filters, table: e.target.value })}>
              <option value="">Tables</option>
              {tables.map(t => <option key={t._id} value={t.tableNo || t.name}>Table {t.tableNo || t.name}</option>)}
            </select>
          </div>

          <div className="col-span-1">
            <select className="w-full h-[34px] border border-gray-300 rounded px-1 text-xs bg-white focus:border-blue-500 outline-none shadow-sm"
              value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })}>
              <option value="">Status</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {/* Search */}
          <div className="col-span-2 relative">
            <input
              type="text"
              placeholder="Order Number..."
              className="w-full h-[34px] border border-gray-300 rounded pl-7 pr-2 text-xs bg-white focus:border-blue-500 outline-none shadow-sm"
              value={filters.search}
              onChange={e => setFilters({ ...filters, search: e.target.value })}
            />
            <span className="absolute left-2 top-2.5 text-gray-400 text-xs">🔍</span>
          </div>

          {/* Reset/Action */}
          <div className="col-span-2 flex justify-end">
            <button onClick={() => setFilters({ status: '', customer: '', table: '', servedBy: '', room: '', search: '' })}
              className="bg-gray-100 border border-gray-300 hover:bg-gray-200 text-gray-600 px-3 py-1.5 rounded text-xs font-medium">
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* 3. ORDER TABLE */}
      <div className="flex-1 overflow-auto bg-[#f0f2f5] p-2">
        <div className="bg-white border border-gray-300 rounded shadow-sm overflow-hidden">
          <table className="w-full border-collapse">
            <thead className="bg-[#f8f9fa] border-b border-gray-300 text-xs text-gray-600">
              <tr>
                <th className="p-2 text-left w-24">Order Info</th>
                <th className="p-2 text-left">Served by</th>
                <th className="p-2 text-left">Customer</th>
                <th className="p-2 text-center w-16">Room</th>
                <th className="p-2 text-center">Payment</th>
                <th className="p-2 text-right">Paid</th>
                <th className="p-2 text-right">Amount</th>
                <th className="p-2 text-left w-32">Remarks</th>
                <th className="p-2 text-center w-64">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {currentItems.length === 0 ? (
                <tr>
                  <td colSpan="9" className="p-8 text-center text-gray-400 italic">No orders found</td>
                </tr>
              ) : (
                currentItems.map((order, idx) => (
                  <tr key={order._id || idx} className="hover:bg-blue-50 transition-colors">
                    <td className="p-2 align-top border-r border-gray-100">
                      {getOrderInfo(order)}
                    </td>
                    <td className="p-2 align-top text-xs font-medium text-gray-700">
                      {order.cashier?.name || order.user?.name || 'A'}
                    </td>
                    <td className="p-2 align-top text-xs text-gray-600">
                      {order.customer?.name || order.customerName || 'Walking Customer'}
                    </td>
                    <td className="p-2 align-top text-center text-xs text-gray-500">
                      {order.room || '-'}
                    </td>
                    <td className="p-2 align-top text-center text-xs">
                      <span className={`px-2 py-0.5 rounded-full border ${order.paymentStatus === 'paid' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-yellow-50 border-yellow-200 text-yellow-700'}`}>
                        {order.paymentMethod || 'Cash'}
                      </span>
                    </td>
                    <td className="p-2 align-top text-right text-xs font-medium text-green-600">
                      {order.paymentStatus === 'paid' ? (order.finalTotal || order.totalAmount).toFixed(2) : '0.00'}
                    </td>
                    <td className="p-2 align-top text-right border-r border-gray-100">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-gray-800">{(order.finalTotal || order.totalAmount).toFixed(2)}</span>
                        {order.taxAmount > 0 && <span className="text-[10px] text-gray-400">VAT: {order.taxAmount.toFixed(2)}</span>}
                      </div>
                    </td>
                    <td className="p-2 align-top text-xs text-gray-500 italic max-w-xs truncate">
                      {order.notes || '-'}
                    </td>
                    <td className="p-2 align-top text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => printReceipt(order)} className="bg-[#4a85c5] hover:bg-[#3474bd] text-white px-2 py-1 rounded text-[10px]">Print</button>
                        <button onClick={() => { setSelectedOrder(order); setShowModal(true); }} className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-2 py-1 rounded text-[10px]">View</button>
                        {order.paymentStatus !== 'paid' && (
                          <>
                            {['admin', 'manager'].includes(user?.role) && (
                              <button onClick={() => handleUpdateOrder(order)} className="bg-[#f39c12] hover:bg-[#e67e22] text-white px-2 py-1 rounded text-[10px]">Update</button>
                            )}
                            <button onClick={() => handlePayNow(order)} className="bg-[#27ae60] hover:bg-[#219150] text-white px-2 py-1 rounded text-[10px]">Pay Now</button>
                          </>
                        )}
                        <button className="text-red-400 hover:text-red-600 p-1"><span className="text-xs">❌</span></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. FOOTER */}
      <div className="bg-[#e9ecef] border-t border-gray-300 p-2 shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button className="bg-[#4a85c5] text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-[#3474bd]">Read SMS</button>
          <button onClick={loadOrders} className="bg-[#17a2b8] text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-[#138496]">Refresh</button>
        </div>

        <div className="flex items-center gap-2 text-xs text-gray-600 font-medium bg-white border border-gray-300 rounded px-2 py-1">
          <span className="mr-2">Total Records {filteredOrders.length}</span>
          <button disabled={currentPage <= 1} onClick={() => setCurrentPage(1)} className="px-2 py-0.5 hover:bg-gray-100 rounded disabled:opacity-50 text-blue-600">First</button>
          <button disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)} className="px-2 py-0.5 hover:bg-gray-100 rounded disabled:opacity-50 text-blue-600">Prev</button>
          <span className="mx-1 border border-gray-300 px-2 rounded bg-gray-50">{currentPage} of {totalPages || 1}</span>
          <button disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)} className="px-2 py-0.5 hover:bg-gray-100 rounded disabled:opacity-50 text-blue-600">Next</button>
          <button disabled={currentPage >= totalPages} onClick={() => setCurrentPage(totalPages)} className="px-2 py-0.5 hover:bg-gray-100 rounded disabled:opacity-50 text-blue-600">Last</button>
        </div>
      </div>

      {/* Order Details Modal */}
      {showModal && selectedOrder && (
        <OrderModal
          order={selectedOrder}
          onClose={() => {
            setShowModal(false);
            setSelectedOrder(null);
          }}
          onPrint={printReceipt}
          onPayNow={handlePayNow}
          onUpdateOrder={handleUpdateOrder}
          onUpdateKitchenStatus={updateKitchenOrderStatus}
        />
      )}

      {/* Payment Modal */}
      {showPaymentModal && paymentOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Process Payment</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Order: {paymentOrder.orderNumber}
                  </label>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Customer: {paymentOrder.customer?.name || paymentOrder.customerName || 'Walk-in Customer'}
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Total Amount
                  </label>
                  <input
                    type="number"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    step="0.01"
                    min="0"
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    onClick={() => {
                      setShowPaymentModal(false);
                      setPaymentOrder(null);
                      setPaymentAmount('');
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handlePaymentSubmit}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    Process Payment
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* UPDATE ORDER MODAL */}
      {showUpdateModal && selectedOrder && (
        <UpdateOrderModal
          order={selectedOrder}
          orderItems={updateOrderItems}
          availableProducts={availableProducts}
          onClose={() => {
            setShowUpdateModal(false);
            setSelectedOrder(null);
            setUpdateOrderItems([]);
          }}
          onAddItem={addItemToUpdate}
          onRemoveItem={removeItemFromUpdate}
          onUpdateQuantity={updateItemQuantity}
          onSubmit={submitOrderUpdate}
        />
      )}

      {/* KITCHEN ORDERS MODAL */}
      {showKitchenModal && (
        <KitchenOrdersModal
          orders={getFilteredKitchenOrders()}
          statusFilter={kitchenStatusFilter}
          onStatusFilterChange={setKitchenStatusFilter}
          onClose={() => setShowKitchenModal(false)}
          onUpdateStatus={updateKitchenOrderStatus}
          getTimeElapsed={getTimeElapsed}
        />
      )}
    </div>
  );
};

// Order Modal Component
const OrderModal = ({ order, onClose, onPrint, onPayNow, onUpdateOrder, onUpdateKitchenStatus }) => {
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'bg-yellow-500 text-white',
      confirmed: 'bg-blue-500 text-white',
      preparing: 'bg-orange-500 text-white',
      ready: 'bg-green-500 text-white',
      completed: 'bg-gray-500 text-white',
      cancelled: 'bg-red-500 text-white'
    };
    return colors[status] || 'bg-gray-500 text-white';
  };

  const getKitchenStatusColor = (kitchenStatus) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      preparing: 'bg-orange-100 text-orange-800 border-orange-300',
      ready: 'bg-green-100 text-green-800 border-green-300',
      served: 'bg-blue-100 text-blue-800 border-blue-300'
    };
    return colors[kitchenStatus] || 'bg-gray-100 text-gray-800 border-gray-300';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-900">
              Order Details - {order.orderNumber}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>

          <div className="space-y-6">
            {/* Order Information */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-medium text-gray-500">Customer</h3>
                <p className="mt-1 text-sm text-gray-900">
                  {order.customer?.name || order.customerName || 'Walk-in Customer'}
                </p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Order Type</h3>
                <p className="mt-1 text-sm text-gray-900 capitalize">
                  {order.orderType || 'dine-in'}
                </p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Status</h3>
                <span className={`inline-flex mt-1 px-2 py-1 text-xs font-semibold rounded ${getStatusColor(order.status)}`}>
                  {order.status}
                </span>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Kitchen Status</h3>
                <span className={`inline-flex mt-1 px-2 py-1 text-xs font-semibold rounded border ${getKitchenStatusColor(order.kitchenStatus)}`}>
                  {order.kitchenStatus || 'pending'}
                </span>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Date & Time</h3>
                <p className="mt-1 text-sm text-gray-900">
                  {formatDate(order.orderDate || order.createdAt)}
                </p>
              </div>
              {order.tableNumber && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Table</h3>
                  <p className="mt-1 text-sm text-gray-900">
                    {order.tableNumber}
                  </p>
                </div>
              )}
              <div>
                <h3 className="text-sm font-medium text-gray-500">Payment Status</h3>
                <p className={`mt-1 text-sm font-medium ${order.paymentStatus === 'paid' ? 'text-green-600' : 'text-red-600'}`}>
                  {order.paymentStatus || 'pending'}
                </p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Payment Method</h3>
                <p className="mt-1 text-sm text-gray-900 capitalize">
                  {order.paymentMethod || 'cash'}
                </p>
              </div>
            </div>

            {/* Kitchen Actions */}
            {order.kitchenStatus && order.kitchenStatus !== 'ready' && order.status !== 'completed' && (
              <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                <h3 className="text-sm font-medium text-yellow-800 mb-2">Kitchen Actions</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => onUpdateKitchenStatus(order._id, 'preparing')}
                    className="px-3 py-1 bg-orange-500 text-white text-sm rounded hover:bg-orange-600"
                  >
                    Start Preparing
                  </button>
                  <button
                    onClick={() => onUpdateKitchenStatus(order._id, 'ready')}
                    className="px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600"
                  >
                    Mark as Ready
                  </button>
                </div>
              </div>
            )}

            {/* Order Items */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-3">Order Items</h3>
              <div className="space-y-3">
                {Array.isArray(order.items) && order.items.map((item, index) => (
                  <div key={index} className="flex justify-between items-center border-b pb-2">
                    <div>
                      <p className="font-medium text-gray-900">
                        {item.quantity}x {item.product?.name || item.name || `Item ${index + 1}`}
                      </p>
                      <p className="text-sm text-gray-500">
                        {formatCurrency(item.price || 0)} each
                      </p>
                      {item.notes && (
                        <p className="text-xs text-yellow-600 mt-1">Note: {item.notes}</p>
                      )}
                    </div>
                    <p className="font-medium text-gray-900">
                      {formatCurrency((item.price || 0) * (item.quantity || 1))}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Order Summary */}
            <div className="border-t pt-4 space-y-2">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>{formatCurrency(order.totalAmount || order.subtotal)}</span>
              </div>
              {order.taxAmount > 0 && (
                <div className="flex justify-between">
                  <span>Tax:</span>
                  <span>{formatCurrency(order.taxAmount || order.tax)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold border-t pt-2">
                <span>Total Amount:</span>
                <span>{formatCurrency(order.finalTotal || order.totalAmount)}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-3 pt-4">
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
              <button
                onClick={() => onPrint(order)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Print Receipt
              </button>
              {/* UPDATE ORDER BUTTON */}
              {order.status !== 'completed' && order.status !== 'cancelled' && (
                <button
                  onClick={() => {
                    onUpdateOrder(order);
                    onClose();
                  }}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  Update Order
                </button>
              )}
              {order.paymentStatus !== 'paid' && order.status !== 'completed' && (
                <button
                  onClick={() => onPayNow(order)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Pay Now
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// UPDATE ORDER MODAL COMPONENT
const UpdateOrderModal = ({ order, orderItems, availableProducts, onClose, onAddItem, onRemoveItem, onUpdateQuantity, onSubmit }) => {
  const [searchQuery, setSearchQuery] = useState('');

  const calculateTotals = () => {
    const subtotal = orderItems.reduce((sum, item) => sum + (item.total || item.price * item.quantity), 0);
    const taxRate = 0.05; // 5% tax to match POS
    const tax = subtotal * taxRate;
    const finalTotal = subtotal + tax;

    return { subtotal, tax, finalTotal };
  };

  const filteredProducts = availableProducts.filter(product =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (product.category && product.category.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const totals = calculateTotals();
  const previousTotal = order.finalTotal || order.totalAmount || 0;
  const additionalAmount = totals.finalTotal - previousTotal;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Update Order - {order.orderNumber}
              </h2>
              <p className="text-sm text-gray-500">
                Customer: {order.customer?.name || order.customerName || 'Walking Customer'}
              </p>
              <p className="text-sm text-gray-500">
                Original Date: {new Date(order.orderDate || order.createdAt).toLocaleString()}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column: Current Items */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-3">Current Order Items</h3>
              <div className="space-y-3 mb-4 max-h-60 overflow-y-auto p-2 border rounded">
                {orderItems.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No items in order</p>
                ) : (
                  orderItems.map((item, index) => (
                    <div key={item._id || index} className="flex justify-between items-center border-b pb-2">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium text-gray-900">
                            {item.quantity}x {item.product?.name || item.name || 'Item'}
                          </span>
                          <span className="text-sm text-gray-500">
                            @ ${(item.price || 0).toFixed(2)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => onUpdateQuantity(index, item.quantity - 1)}
                            className="w-6 h-6 flex items-center justify-center border border-gray-300 rounded hover:bg-gray-100"
                          >
                            -
                          </button>
                          <span className="w-8 text-center">{item.quantity}</span>
                          <button
                            onClick={() => onUpdateQuantity(index, item.quantity + 1)}
                            className="w-6 h-6 flex items-center justify-center border border-gray-300 rounded hover:bg-gray-100"
                          >
                            +
                          </button>
                        </div>
                        <span className="font-medium w-20 text-right">
                          ${((item.price || 0) * item.quantity).toFixed(2)}
                        </span>
                        <button
                          onClick={() => onRemoveItem(index)}
                          className="text-red-500 hover:text-red-700"
                          title="Remove item"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Summary */}
              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between">
                  <span className="font-medium">Previous Total:</span>
                  <span className="font-medium">${previousTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Additional Items:</span>
                  <span className={`font-medium ${additionalAmount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ${additionalAmount.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t pt-2">
                  <span>New Total:</span>
                  <span className="text-blue-600">${totals.finalTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Right Column: Add Items */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-3">Add Items to Order</h3>

              {/* Search Input */}
              <div className="mb-4">
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </span>
                  <input
                    type="text"
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Search products..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoFocus
                  />
                </div>
              </div>

              {/* Product Categories */}
              <div className="mb-4">
                <div className="flex space-x-2 overflow-x-auto pb-2">
                  <button className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium">
                    All
                  </button>
                  <button className="px-3 py-1 bg-gray-100 text-gray-700 rounded-lg text-sm">
                    Drinks
                  </button>
                  <button className="px-3 py-1 bg-gray-100 text-gray-700 rounded-lg text-sm">
                    Food
                  </button>
                  <button className="px-3 py-1 bg-gray-100 text-gray-700 rounded-lg text-sm">
                    Desserts
                  </button>
                </div>
              </div>

              {/* Product Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6 max-h-60 overflow-y-auto p-2 border rounded">
                {filteredProducts.map((product) => (
                  <button
                    key={product._id}
                    onClick={() => onAddItem(product)}
                    className="border border-gray-200 rounded-lg p-3 text-left hover:bg-gray-50 transition-colors flex flex-col"
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-medium text-gray-900 text-sm truncate">
                        {product.name}
                      </span>
                      <span className="text-green-600 font-medium text-sm whitespace-nowrap">
                        ${product.price.toFixed(2)}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {product.category || 'Uncategorized'}
                    </div>
                  </button>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button
                  onClick={onClose}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={onSubmit}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path>
                  </svg>
                  Update Order & Print
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// KITCHEN ORDERS MODAL COMPONENT
const KitchenOrdersModal = ({ orders, statusFilter, onStatusFilterChange, onClose, onUpdateStatus, getTimeElapsed }) => {
  const filteredOrders = statusFilter === 'all'
    ? orders
    : orders.filter(order => order.kitchenStatus === statusFilter);

  const getKitchenStatusColor = (kitchenStatus) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      preparing: 'bg-orange-100 text-orange-800 border-orange-300',
      ready: 'bg-green-100 text-green-800 border-green-300',
      served: 'bg-blue-100 text-blue-800 border-blue-300'
    };
    return colors[kitchenStatus] || 'bg-gray-100 text-gray-800 border-gray-300';
  };

  const formatTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Kitchen Orders View</h2>
              <p className="text-sm text-gray-500">Real-time kitchen order tracking</p>
            </div>
            <div className="flex items-center space-x-3">
              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => onStatusFilterChange(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-1 text-sm"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="preparing">Preparing</option>
                <option value="ready">Ready</option>
                <option value="served">Served</option>
              </select>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>
          </div>

          {/* Statistics */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {orders.filter(o => o.kitchenStatus === 'pending').length}
              </div>
              <div className="text-sm font-medium text-yellow-700">Pending</div>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-orange-600">
                {orders.filter(o => o.kitchenStatus === 'preparing').length}
              </div>
              <div className="text-sm font-medium text-orange-700">Preparing</div>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-green-600">
                {orders.filter(o => o.kitchenStatus === 'ready').length}
              </div>
              <div className="text-sm font-medium text-green-700">Ready</div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">{orders.length}</div>
              <div className="text-sm font-medium text-blue-700">Total</div>
            </div>
          </div>

          {/* Orders Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pending Orders */}
            <div>
              <h3 className="text-lg font-bold text-yellow-700 mb-3 flex items-center">
                <span className="w-3 h-3 bg-yellow-500 rounded-full mr-2"></span>
                Pending Orders ({orders.filter(o => o.kitchenStatus === 'pending').length})
              </h3>
              <div className="space-y-3">
                {orders
                  .filter(order => order.kitchenStatus === 'pending')
                  .map(order => (
                    <div key={order._id} className="border border-yellow-200 rounded-lg p-4 bg-yellow-50">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="font-bold text-gray-900">#{order.orderNumber}</span>
                          <span className="ml-2 text-sm text-gray-600">
                            {order.tableNumber ? `Table ${order.tableNumber}` : order.orderType}
                          </span>
                        </div>
                        <span className="text-sm text-gray-500">{getTimeElapsed(order.createdAt)} ago</span>
                      </div>
                      <p className="text-sm font-medium mb-2">{order.customerName || 'Walk-in Customer'}</p>
                      <div className="space-y-1 mb-3">
                        {Array.isArray(order.items) && order.items.slice(0, 3).map((item, index) => (
                          <div key={index} className="flex justify-between text-sm">
                            <span>{item.quantity}x {item.product?.name || item.name}</span>
                            <span className="text-gray-600">${(item.price * item.quantity).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-end">
                        <button
                          onClick={() => onUpdateStatus(order._id, 'preparing')}
                          className="px-3 py-1 bg-orange-500 text-white text-sm rounded hover:bg-orange-600"
                        >
                          Start Preparing
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Preparing & Ready Orders */}
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-bold text-orange-700 mb-3 flex items-center">
                  <span className="w-3 h-3 bg-orange-500 rounded-full mr-2"></span>
                  Preparing ({orders.filter(o => o.kitchenStatus === 'preparing').length})
                </h3>
                <div className="space-y-3">
                  {orders
                    .filter(order => order.kitchenStatus === 'preparing')
                    .map(order => (
                      <div key={order._id} className="border border-orange-200 rounded-lg p-4 bg-orange-50">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <span className="font-bold text-gray-900">#{order.orderNumber}</span>
                            <span className="ml-2 text-sm text-gray-600">
                              {order.tableNumber ? `Table ${order.tableNumber}` : order.orderType}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-sm text-gray-500">{getTimeElapsed(order.createdAt)} ago</span>
                            <div className="text-xs text-orange-600">Cooking: {getTimeElapsed(order.updatedAt || order.createdAt)}</div>
                          </div>
                        </div>
                        <p className="text-sm font-medium mb-2">{order.customerName || 'Walk-in Customer'}</p>
                        <div className="flex justify-end">
                          <button
                            onClick={() => onUpdateStatus(order._id, 'ready')}
                            className="px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600"
                          >
                            Mark as Ready
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-bold text-green-700 mb-3 flex items-center">
                  <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
                  Ready for Pickup ({orders.filter(o => o.kitchenStatus === 'ready').length})
                </h3>
                <div className="space-y-3">
                  {orders
                    .filter(order => order.kitchenStatus === 'ready')
                    .map(order => (
                      <div key={order._id} className="border border-green-200 rounded-lg p-4 bg-green-50">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <span className="font-bold text-gray-900">#{order.orderNumber}</span>
                            <span className="ml-2 text-sm text-gray-600">
                              {order.tableNumber ? `Table ${order.tableNumber}` : order.orderType}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-sm text-gray-500">{getTimeElapsed(order.createdAt)} ago</span>
                            <div className="text-xs text-green-600">Ready for {getTimeElapsed(order.updatedAt || order.createdAt)}</div>
                          </div>
                        </div>
                        <p className="text-sm font-medium mb-2">{order.customerName || 'Walk-in Customer'}</p>
                        <div className="flex justify-end">
                          <span className="px-3 py-1 bg-green-600 text-white text-sm rounded animate-pulse">
                            READY FOR SERVING
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Orders;
