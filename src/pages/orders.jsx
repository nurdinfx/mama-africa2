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

  useEffect(() => {
    loadOrders();
    loadRestaurantSettings();
    setupSocketConnection();

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
      setLoading(true);
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
      const itemsWithIds = order.items.map((item, index) => ({
        ...item,
        _id: item._id || `item_${Date.now()}_${index}`,
        product: item.product || { _id: `product_${index}`, name: item.name || 'Item' }
      }));
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
          const productId = item.product?._id || item.product;
          if (!productId) {
            console.warn('Item missing product ID:', item);
            return {
              product: `temp_${Date.now()}`,
              quantity: item.quantity,
              price: item.price,
              notes: item.notes,
              name: item.product?.name || item.name || 'Item'
            };
          }
          return {
            product: productId,
            quantity: item.quantity,
            price: item.price,
            notes: item.notes,
            name: item.product?.name || item.name
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
    const printWindow = window.open('', '_blank', 'width=300,height=600');

    const now = new Date();
    const formattedDate = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}  ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const originalOrderDate = order.orderDate ? new Date(order.orderDate) : now;
    const originalFormattedDate = `${String(originalOrderDate.getDate()).padStart(2, '0')}/${String(originalOrderDate.getMonth() + 1).padStart(2, '0')}/${originalOrderDate.getFullYear()}  ${String(originalOrderDate.getHours()).padStart(2, '0')}:${String(originalOrderDate.getMinutes()).padStart(2, '0')}`;

    const restaurantName = restaurantSettings?.restaurantName || 'Manma Africa Restaurant';
    const receiptNumber = order.orderNumber || Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    const serverName = order.cashier?.name || 'System';

    // Calculate totals
    const subtotal = order.subtotal || order.totalAmount || 0;
    const taxAmount = order.taxAmount || order.tax || (subtotal * 0.05);
    const finalTotal = order.finalTotal || order.totalAmount || (subtotal + taxAmount);

    const receiptContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Restaurant Receipt</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            
            body { 
              font-family: 'Courier New', monospace; 
              font-size: 12px; 
              margin: 0; 
              padding: 10px; 
              width: 280px;
              background: white;
              color: black;
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
              text-transform: uppercase;
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
            
            .updated-notice {
              text-align: center;
              font-weight: bold;
              color: #d97706;
              margin: 5px 0;
              padding: 2px;
              border: 1px dashed #d97706;
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
            
            .original-order {
              margin-top: 10px;
              padding-top: 8px;
              border-top: 2px dashed #d97706;
              font-size: 10px;
            }
            
            .original-order-title {
              text-align: center;
              font-weight: bold;
              color: #d97706;
              margin-bottom: 5px;
            }
            
            .additional-items {
              margin-top: 10px;
              padding-top: 8px;
              border-top: 2px dashed #000;
              font-size: 10px;
            }
            
            .additional-title {
              text-align: center;
              font-weight: bold;
              margin-bottom: 5px;
            }
            
            @media print {
              body {
                width: 80mm !important;
                margin: 0 !important;
                padding: 5px !important;
              }
              
              @page {
                margin: 0;
                size: 80mm auto;
              }
            }
          </style>
        </head>
        <body>
          <div class="receipt">
            <div class="header">
              <div class="restaurant-name">${restaurantName}</div>
              <div class="payment-methods">
                ZAAD: 515735 - SAHAL: 523080-<br>
                E-DAHAB: 742298 - MYCash: 931539
              </div>
            </div>
            
            ${isUpdated ? `
            <div class="updated-notice">
              *** UPDATED ORDER ***
            </div>
            ` : ''}
            
            <div class="order-info">
              <div><strong>Receipt Number:</strong> ${receiptNumber}</div>
              <div><strong>Served By :</strong> ${serverName}</div>
              <div><strong>Customer :</strong> ${order.customer?.name || order.customerName || 'Walking Customer'}</div>
              <div><strong>Date :</strong> ${isUpdated ? originalFormattedDate : formattedDate}</div>
              ${order.tableNumber ? `<div><strong>Table :</strong> ${order.tableNumber}</div>` : ''}
              ${isUpdated ? `<div><strong>Updated :</strong> ${formattedDate}</div>` : ''}
            </div>
            
            ${isUpdated ? `
            <div class="original-order">
              <div class="original-order-title">--- ORIGINAL ORDER ---</div>
              <div class="item-header">
                <div class="item-name">Item:</div>
                <div class="item-quantity">No.</div>
                <div class="item-price">Price:</div>
                <div class="item-price">Total</div>
              </div>
              ${Array.isArray(selectedOrder?.items) ? selectedOrder.items.map(item => `
                <div class="item-row">
                  <div class="item-name">${item.product?.name || item.name || 'Item'}</div>
                  <div class="item-quantity">${item.quantity}</div>
                  <div class="item-price">${(item.price || 0).toFixed(1)}</div>
                  <div class="item-price">${((item.price || 0) * (item.quantity || 1)).toFixed(1)}</div>
                </div>
              `).join('') : ''}
            </div>
            
            <div class="additional-items">
              <div class="additional-title">--- ADDITIONAL ITEMS ---</div>
              <div class="item-header">
                <div class="item-name">Item:</div>
                <div class="item-quantity">No.</div>
                <div class="item-price">Price:</div>
                <div class="item-price">Total</div>
              </div>
              ${Array.isArray(order.items) ? order.items.filter(item =>
      !selectedOrder?.items?.some(originalItem =>
        originalItem._id === item._id ||
        (originalItem.product?.name === item.product?.name && originalItem.price === item.price)
      )
    ).map(item => `
                <div class="item-row">
                  <div class="item-name">${item.product?.name || item.name || 'Item'}</div>
                  <div class="item-quantity">${item.quantity}</div>
                  <div class="item-price">${(item.price || 0).toFixed(1)}</div>
                  <div class="item-price">${((item.price || 0) * (item.quantity || 1)).toFixed(1)}</div>
                </div>
              `).join('') : ''}
            </div>
            ` : `
            <div class="items">
              <div class="item-header">
                <div class="item-name">Item:</div>
                <div class="item-quantity">No.</div>
                <div class="item-price">Price:</div>
                <div class="item-price">Total</div>
              </div>
              ${Array.isArray(order.items) ? order.items.map(item => `
                <div class="item-row">
                  <div class="item-name">${item.product?.name || item.name || 'Item'}</div>
                  <div class="item-quantity">${item.quantity}</div>
                  <div class="item-price">${(item.price || 0).toFixed(1)}</div>
                  <div class="item-price">${((item.price || 0) * (item.quantity || 1)).toFixed(1)}</div>
                </div>
              `).join('') : ''}
            </div>
            `}
            
            <div class="totals">
              <div class="total-row">
                <div>Vat @ 5 %</div>
                <div>${taxAmount.toFixed(2)}</div>
              </div>
              <div class="total-row">
                <div>Paid Amount</div>
                <div>${order.paymentStatus === 'paid' ? finalTotal.toFixed(2) : '0.00'}</div>
              </div>
              <div class="total-row grand-total">
                <div>Total :</div>
                <div>${finalTotal.toFixed(2)}</div>
              </div>
              <div class="total-row">
                <div>Total L/Currency :</div>
                <div>0</div>
              </div>
            </div>
            
            ${order.paymentMethod ? `
            <div class="order-info">
              <div><strong>Payment Method:</strong> ${order.paymentMethod.toUpperCase()}</div>
              ${order.paymentStatus === 'paid' ? `
              <div><strong>Status:</strong> PAID</div>
              ` : ''}
            </div>
            ` : ''}
            
            <div class="footer">
              <div>Thank you for visiting us</div>
              <div>powered by Hudi-somProjects</div>
              ${isUpdated ? `<div style="color: #d97706; font-weight: bold; margin-top: 3px;">*** UPDATED RECEIPT ***</div>` : ''}
            </div>
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Section */}
      <div className="bg-blue-600 text-white p-2 sm:p-4 shadow-lg">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold">Table Payment (Inv)</h1>
            <div className="text-blue-100 text-xs sm:text-sm">
              <span className="font-semibold">Pending: {pendingOrdersCount}</span>
            </div>
            <button
              onClick={handleShowKitchenOrders}
              className="bg-orange-500 hover:bg-orange-600 text-white px-2 sm:px-3 py-1 rounded-lg text-xs sm:text-sm font-medium"
            >
              Kitchen ({kitchenOrders.length})
            </button>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Link
              to="/pos"
              className="flex-1 sm:flex-initial bg-white text-blue-600 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium hover:bg-blue-50 text-center"
            >
              + New Order
            </Link>
            <button
              onClick={loadOrders}
              className="flex-1 sm:flex-initial bg-white text-blue-600 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium hover:bg-blue-50"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="p-2 sm:p-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 mb-4">
          <div className="bg-white p-4 rounded-lg shadow border-l-4 border-blue-500">
            <h3 className="text-sm font-medium text-gray-600">VAT</h3>
            <p className="text-2xl font-bold text-blue-600">
              ${summary.vat.toFixed(2)}
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow border-l-4 border-red-500">
            <h3 className="text-sm font-medium text-gray-600">Pending</h3>
            <p className="text-2xl font-bold text-red-600">
              ${summary.pending.toFixed(2)}
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow border-l-4 border-green-500">
            <h3 className="text-sm font-medium text-gray-600">Total Amount</h3>
            <p className="text-2xl font-bold text-green-600">
              ${summary.totalAmount.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Filters Section */}
        <div className="bg-white rounded-lg shadow mb-4 p-2 sm:p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
              >
                <option value="">All Status</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="preparing">Preparing</option>
                <option value="ready">Ready</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Customer</label>
              <input
                type="text"
                placeholder="Filter by customer"
                value={filters.customer}
                onChange={(e) => setFilters(prev => ({ ...prev, customer: e.target.value }))}
                className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Table</label>
              <input
                type="text"
                placeholder="Filter by table"
                value={filters.table}
                onChange={(e) => setFilters(prev => ({ ...prev, table: e.target.value }))}
                className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Served By</label>
              <input
                type="text"
                placeholder="Filter by server"
                value={filters.servedBy}
                onChange={(e) => setFilters(prev => ({ ...prev, servedBy: e.target.value }))}
                className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Rooms</label>
              <input
                type="text"
                placeholder="Filter by room"
                value={filters.room}
                onChange={(e) => setFilters(prev => ({ ...prev, room: e.target.value }))}
                className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Search</label>
              <input
                type="text"
                placeholder="Search orders..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
              />
            </div>
          </div>
        </div>

        {/* Orders Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto" style={{ maxWidth: '100%' }}>
            <table className="min-w-full" style={{ tableLayout: 'auto', width: '100%' }}>
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Order No</th>
                  <th className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Served by</th>
                  <th className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Customer</th>
                  <th className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Kitchen Status</th>
                  <th className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Payment</th>
                  <th className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap hidden lg:table-cell">Mobile Payment</th>
                  <th className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Paid Amount</th>
                  <th className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Amount</th>
                  <th className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap hidden md:table-cell">Remarks</th>
                  <th className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {Array.isArray(currentItems) && currentItems.length === 0 ? (
                  <tr>
                    <td colSpan="10" className="px-4 sm:px-6 py-8 sm:py-12 text-center text-gray-500 text-sm">
                      No orders found
                    </td>
                  </tr>
                ) : (
                  currentItems.map((order) => (
                    <tr key={order._id} className="hover:bg-gray-50">
                      <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm font-medium text-gray-900">
                        {order.orderNumber}
                      </td>
                      <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500">
                        {order.cashier?.name || 'System'}
                      </td>
                      <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm font-medium text-gray-900">
                        {order.customer?.name || order.customerName || 'Walk-in Customer'}
                        {order.tableNumber && (
                          <div className="text-xs text-gray-500">Table: {order.tableNumber}</div>
                        )}
                      </td>
                      <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-4 whitespace-nowrap">
                        <span className={`inline-flex px-1.5 sm:px-2 py-0.5 sm:py-1 text-xs font-semibold rounded border ${getKitchenStatusColor(order.kitchenStatus)}`}>
                          {order.kitchenStatus || 'pending'}
                        </span>
                      </td>
                      <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500 capitalize">
                        {order.paymentMethod || 'cash'}
                      </td>
                      <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500 hidden lg:table-cell">
                        {order.paymentMethod === 'mobile' ? `$${(order.finalTotal || order.totalAmount || 0).toFixed(2)}` : '-'}
                      </td>
                      <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm font-medium text-green-600">
                        {order.paymentStatus === 'paid' ? `$${(order.finalTotal || order.totalAmount || 0).toFixed(2)}` : '-'}
                      </td>
                      <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-4 whitespace-nowrap">
                        <div className="text-xs sm:text-sm font-medium text-gray-900">
                          ${(order.finalTotal || order.totalAmount || 0).toFixed(2)}
                        </div>
                        <div className="text-xs text-gray-500 hidden sm:block">
                          Discount: $0.00
                        </div>
                        <div className="text-xs text-gray-500 hidden sm:block">
                          VAT: ${(order.taxAmount || order.tax || 0).toFixed(2)}
                        </div>
                      </td>
                      <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-4 text-xs sm:text-sm text-gray-500 max-w-xs truncate hidden md:table-cell">
                        {order.notes || '-'}
                      </td>
                      <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm font-medium">
                        <div className="flex items-center flex-wrap gap-1">
                          <button
                            onClick={() => printReceipt(order)}
                            className="bg-blue-500 hover:bg-blue-600 text-white text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded"
                            title="Print"
                          >
                            Print
                          </button>
                          <button
                            onClick={() => {
                              setSelectedOrder(order);
                              setShowModal(true);
                            }}
                            className="bg-green-500 hover:bg-green-600 text-white text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded"
                            title="View"
                          >
                            View
                          </button>
                          {/* UPDATE ORDER BUTTON */}
                          {order.status !== 'completed' && order.status !== 'cancelled' && (
                            <button
                              onClick={() => handleUpdateOrder(order)}
                              className="bg-purple-500 hover:bg-purple-600 text-white text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded"
                              title="Update Order"
                            >
                              Update
                            </button>
                          )}
                          {/* KITCHEN STATUS BUTTONS */}
                          {order.kitchenStatus !== 'ready' && order.status !== 'completed' && (
                            <>
                              <button
                                onClick={() => updateKitchenOrderStatus(order._id, 'preparing')}
                                className="bg-orange-500 hover:bg-orange-600 text-white text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded"
                                title="Start Preparing"
                              >
                                Prep
                              </button>
                              <button
                                onClick={() => updateKitchenOrderStatus(order._id, 'ready')}
                                className="bg-green-500 hover:bg-green-600 text-white text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded"
                                title="Mark as Ready"
                              >
                                Ready
                              </button>
                            </>
                          )}
                          {/* PAY NOW BUTTON */}
                          {order.paymentStatus !== 'paid' && order.status !== 'completed' && (
                            <button
                              onClick={() => handlePayNow(order)}
                              className="bg-red-500 hover:bg-red-600 text-white text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded"
                            >
                              Pay
                            </button>
                          )}
                          <button
                            onClick={() => {
                              if (window.confirm('Are you sure you want to delete this order?')) {
                                // Delete functionality
                              }
                            }}
                            className="bg-gray-500 hover:bg-gray-600 text-white text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded"
                            title="Delete"
                          >
                            ×
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-2 sm:px-4 md:px-6 py-3 sm:py-4 border-t border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-2">
              <p className="text-xs sm:text-sm text-gray-700">
                Total Records: {filteredOrders.length}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="px-3 py-1 text-sm text-gray-700">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50"
                >
                  Next
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  className="px-3 py-1 border border-gray-300 rounded text-sm"
                >
                  Last
                </button>
              </div>
            </div>
          )}
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
