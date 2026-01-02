// src/pages/Reports.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { realApi } from '../api/realApi';
import { API_CONFIG } from '../config/api.config';
import { Link, useNavigate } from 'react-router-dom';
import { formatDate, formatTime, formatCurrency } from '../utils/date';
import { io } from 'socket.io-client';
import { setCache, getCache } from '../services/offlineCache';

const Reports = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [activeReport, setActiveReport] = useState(null);
  const [filters, setFilters] = useState({
    startDate: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    paymentMethod: '',
    customer: '',
    status: '',
    product: '',
    category: '',
    cashier: ''
  });
  const [summary, setSummary] = useState({
    totalAmount: 0,
    totalTransactions: 0,
    vat: 0,
    pending: 0,
    cashAmount: 0,
    mobileAmount: 0,
    cardAmount: 0,
    productCount: 0,
    lowStockCount: 0
  });
  const [settings, setSettings] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [cashiers, setCashiers] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [socket, setSocket] = useState(null);
  const [dataSource, setDataSource] = useState('fresh');
  const itemsPerPage = 10;

  const reportTypes = [
    { id: 'payment', title: 'Payment Report', icon: '💰', description: 'All payment transactions' },
    { id: 'product', title: 'Product Report', icon: '🛒', description: 'Product sales and stock' },
    { id: 'mobile-payment', title: 'Mobile Payment Report', icon: '📱', description: 'Mobile payment transactions' },
    { id: 'audit-trail', title: 'Audit Trail Report', icon: '📹', description: 'System activity logs' },
    { id: 'orders', title: 'Orders Report', icon: '📈', description: 'All orders summary' },
    { id: 'cashier-handover', title: 'Cashier Handover Report', icon: '👋', route: '/reports/cashier-handover' },
    { id: 'all-cashier-handovers', title: 'All Cashier Handovers', icon: '💰', route: '/reports/cashier-handover' },
    { id: 'previous-payment', title: 'Previous Payment Report', icon: '↔️', description: 'Historical payments' },
    { id: 'sms-payment', title: 'SMS Payment Report', icon: '💬', description: 'SMS payment transactions' },
    { id: 'advance', title: 'Advance Report', icon: '⚠️', description: 'Advance payments' },
    { id: 'sale', title: 'Sales Report', icon: '📊', description: 'Sales analysis' },
    { id: 'daily-summary', title: 'Daily Summary', icon: '📅', description: 'Daily sales summary' },
    { id: 'inventory', title: 'Inventory Report', icon: '📦', description: 'Stock levels and alerts' },
    { id: 'customer', title: 'Customer Report', icon: '👥', description: 'Customer transactions' }
  ];

  useEffect(() => {
    loadInitialData();
    setupSocketConnection();

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, []);

  useEffect(() => {
    if (activeReport) {
      loadReportData(activeReport);
    }
  }, [activeReport, filters, currentPage]);

  const setupSocketConnection = () => {
    const SOCKET_URL = API_CONFIG.SOCKET_URL;
    const newSocket = io(SOCKET_URL, { transports: ['websocket'] });
    setSocket(newSocket);

    newSocket.on('order-paid', (order) => {
      // Refresh report data when new payment is made
      if (activeReport && ['payment', 'orders', 'sale', 'daily-summary'].includes(activeReport)) {
        loadReportData(activeReport);
      }
    });

    newSocket.on('order-updated', (order) => {
      // Refresh relevant reports when order is updated
      if (activeReport && ['orders', 'payment', 'audit-trail'].includes(activeReport)) {
        loadReportData(activeReport);
      }
    });

    newSocket.on('product-updated', (product) => {
      // Refresh product-related reports
      if (activeReport && ['product', 'inventory'].includes(activeReport)) {
        loadReportData(activeReport);
      }
    });
  };

  const loadInitialData = async () => {
    try {
      // Try to load from cache first
      const cachedCashiers = getCache('reports_cashiers');
      const cachedProducts = getCache('reports_products');
      const cachedSettings = getCache('reports_settings');
      const cacheTime = getCache('reports_cache_time', 0);
      const now = Date.now();
      
      // Use cache if less than 10 minutes old
      if (cachedCashiers && (now - cacheTime) < 10 * 60 * 1000) {
        setCashiers(cachedCashiers);
      }
      if (cachedProducts && (now - cacheTime) < 10 * 60 * 1000) {
        setProducts(cachedProducts);
        const uniqueCategories = [...new Set(cachedProducts.map(p => p.category).filter(Boolean))];
        setCategories(uniqueCategories);
      }
      if (cachedSettings && (now - cacheTime) < 10 * 60 * 1000) {
        setSettings(cachedSettings);
      }
      
      // Load fresh data in background
      try {
        // Load cashiers
        const cashiersResponse = await realApi.getUsers({ role: 'cashier' });
        if (cashiersResponse.success) {
          const cashiersData = realApi.extractData(cashiersResponse) || [];
          setCashiers(cashiersData);
          setCache('reports_cashiers', cashiersData);
        }

        // Load products for filters
        const productsResponse = await realApi.getProducts();
        if (productsResponse.success) {
          const productsData = realApi.extractData(productsResponse) || [];
          setProducts(productsData);
          setCache('reports_products', productsData);

          // Extract unique categories
          const uniqueCategories = [...new Set(productsData.map(p => p.category).filter(Boolean))];
          setCategories(uniqueCategories);
        }

        // Load settings for currency formatting
        const settingsResponse = await realApi.getSettings();
        if (settingsResponse.success) {
          const settingsData = realApi.extractData(settingsResponse);
          setSettings(settingsData);
          setCache('reports_settings', settingsData);
        }
        
        setCache('reports_cache_time', now);
      } catch (error) {
        console.error('Failed to load fresh data, using cache:', error);
        // If fresh load fails, we already have cache data displayed
      }
    } catch (error) {
      console.error('Failed to load initial data:', error);
    }
  };

  const loadReportData = async (reportId) => {
    try {
      setLoading(true);
      let data = null;

      const startDate = new Date(filters.startDate);
      const endDate = new Date(filters.endDate);
      endDate.setHours(23, 59, 59, 999); // End of day

      // Define cache key and timestamp before using them
      const cacheKey = `report_${reportId}_${filters.startDate}_${filters.endDate}_${filters.paymentMethod}_${filters.cashier}`;
      const now = Date.now();

      switch (reportId) {
        case 'payment':
          data = await loadPaymentReport(startDate, endDate);
          break;

        case 'mobile-payment':
          data = await loadMobilePaymentReport(startDate, endDate);
          break;

        case 'sms-payment':
          data = await loadSmsPaymentReport(startDate, endDate);
          break;

        case 'orders':
        case 'sale':
          data = await loadOrdersReport(startDate, endDate, reportId === 'sale');
          break;

        case 'product':
          data = await loadProductReport();
          break;

        case 'daily-summary':
          data = await loadDailySummaryReport(startDate, endDate);
          break;

        case 'inventory':
          data = await loadInventoryReport();
          break;

        case 'customer':
          data = await loadCustomerReport(startDate, endDate);
          break;

        case 'audit-trail':
          data = await loadAuditTrailReport(startDate, endDate);
          break;

        case 'previous-payment':
          data = await loadPreviousPaymentReport(startDate, endDate);
          break;

        case 'advance':
          data = await loadAdvanceReport(startDate, endDate);
          break;

        default:
          data = { type: 'coming-soon', message: 'This report is coming soon' };
      }

      // Cache the data
      setCache(cacheKey, data);
      setCache(`${cacheKey}_time`, now);
      
      setReportData(data);
      // Detect if the report data contains local/offline items and set source accordingly
      const hasLocalFlags = (obj) => {
        if (!obj) return false;
        try {
          if (Array.isArray(obj)) return obj.some(i => hasLocalFlags(i));
          if (typeof obj === 'object') {
            if (obj.isOffline || obj.isLocal || obj.isOfflineUpdate || obj._deleted) return true;
            return Object.values(obj).some(v => (typeof v === 'object' || Array.isArray(v)) && hasLocalFlags(v));
          }
        } catch (e) { return false; }
        return false;
      };
      if (hasLocalFlags(data)) setDataSource('local'); else setDataSource('fresh');
      updateSummary(data, reportId);
    } catch (error) {
      console.error('Failed to load report:', error);
      
      // Try to use cached data as fallback
      const cacheKey = `report_${reportId}_${filters.startDate}_${filters.endDate}_${filters.paymentMethod}_${filters.cashier}`;
      const cachedData = getCache(cacheKey);
      
      if (cachedData) {
        console.log('Using cached data as fallback');
        setReportData(cachedData);
        setDataSource('cache');
        updateSummary(cachedData, reportId);
      } else {
        setReportData({ type: 'error', message: 'Failed to load report data. Please check your internet connection.' });
        setDataSource('error');
      }
    } finally {
      setLoading(false);
    }
  };

  const loadPaymentReport = async (startDate, endDate) => {
    try {
      let orders = [];
      const cacheKey = `orders_${startDate.toISOString()}_${endDate.toISOString()}`;
      const cachedOrders = getCache(cacheKey);
      
      // Try cache first
      if (cachedOrders) {
        orders = Array.isArray(cachedOrders) ? cachedOrders : [];
        orders = orders.filter(o => (o.paymentStatus || '').toLowerCase() === 'paid');
      }
      
      // Load fresh data
      const response = await realApi.getOrders({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        paymentStatus: 'paid'
      });

      if (response.success) {
        orders = realApi.extractData(response) || [];
        // Cache orders
        setCache(cacheKey, orders);
        setCache(`${cacheKey}_time`, Date.now());
      } else if (!orders.length) {
        throw new Error('Failed to load payment data');
      }

      // Apply filters
      orders = applyOrderFilters(orders);

      // Group by payment method
      const paymentGroups = {};
      const mobilePaymentMethods = ['zaad', 'sahal', 'edahab', 'mycash', 'mobile'];

      orders.forEach(order => {
        const method = (order.paymentMethod || 'cash').toLowerCase();
        if (!paymentGroups[method]) {
          paymentGroups[method] = {
            method: method,
            count: 0,
            amount: 0,
            vat: 0,
            orders: []
          };
        }
        paymentGroups[method].count++;
        paymentGroups[method].amount += order.finalTotal || order.totalAmount || 0;
        paymentGroups[method].vat += order.taxAmount || 0;
        paymentGroups[method].orders.push(order);
      });

      return {
        type: 'payment',
        orders,
        paymentGroups: Object.values(paymentGroups),
        total: orders.reduce((sum, o) => sum + (o.finalTotal || o.totalAmount || 0), 0),
        count: orders.length,
        vat: orders.reduce((sum, o) => sum + (o.taxAmount || 0), 0)
      };
    } catch (error) {
      console.error('Error loading payment report:', error);
      throw error;
    }
  };

  const loadMobilePaymentReport = async (startDate, endDate) => {
    const response = await realApi.getOrders({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      paymentStatus: 'paid'
    });

    if (!response.success) throw new Error('Failed to load mobile payment data');

    let orders = realApi.extractData(response) || [];
    const mobileMethods = ['zaad', 'sahal', 'edahab', 'mycash', 'mobile'];

    orders = orders.filter(order =>
      mobileMethods.includes((order.paymentMethod || '').toLowerCase())
    );

    // Apply additional filters
    orders = applyOrderFilters(orders);

    // Group by mobile payment method
    const mobileGroups = {};

    orders.forEach(order => {
      const method = (order.paymentMethod || 'mobile').toLowerCase();
      if (!mobileGroups[method]) {
        mobileGroups[method] = {
          method: method,
          count: 0,
          amount: 0,
          vat: 0,
          orders: []
        };
      }
      mobileGroups[method].count++;
      mobileGroups[method].amount += order.finalTotal || order.totalAmount || 0;
      mobileGroups[method].vat += order.taxAmount || 0;
      mobileGroups[method].orders.push(order);
    });

    return {
      type: 'mobile-payment',
      orders,
      mobileGroups: Object.values(mobileGroups),
      total: orders.reduce((sum, o) => sum + (o.finalTotal || o.totalAmount || 0), 0),
      count: orders.length,
      vat: orders.reduce((sum, o) => sum + (o.taxAmount || 0), 0)
    };
  };

  const loadSmsPaymentReport = async (startDate, endDate) => {
    const response = await realApi.getOrders({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      paymentStatus: 'paid',
      paymentMethod: 'sms'
    });

    if (!response.success) throw new Error('Failed to load SMS payment data');

    let orders = realApi.extractData(response) || [];
    orders = orders.filter(order => (order.paymentMethod || '').toLowerCase() === 'sms');
    orders = applyOrderFilters(orders);

    return {
      type: 'sms-payment',
      orders,
      total: orders.reduce((sum, o) => sum + (o.finalTotal || o.totalAmount || 0), 0),
      count: orders.length,
      vat: orders.reduce((sum, o) => sum + (o.taxAmount || 0), 0)
    };
  };

  const loadOrdersReport = async (startDate, endDate, salesOnly = false) => {
    try {
      const response = await realApi.getOrders({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        paymentStatus: salesOnly ? 'paid' : undefined
      });

      let orders = [];

      if (!response.success) {
        // Try cache
        const cacheKey = `orders_${startDate.toISOString()}_${endDate.toISOString()}`;
        const cachedOrders = getCache(cacheKey);
        if (cachedOrders) {
          console.log('Using cached orders');
          orders = Array.isArray(cachedOrders) ? cachedOrders : [];
        } else {
          throw new Error('Failed to load orders data');
        }
      } else {
        orders = realApi.extractData(response) || [];
        
        // Cache orders
        const cacheKey = `orders_${startDate.toISOString()}_${endDate.toISOString()}`;
        setCache(cacheKey, orders);
        setCache(`${cacheKey}_time`, Date.now());
      }
      
      orders = applyOrderFilters(orders);

      const paidOrders = orders.filter(o => (o.paymentStatus || '').toLowerCase() === 'paid');
      const pendingOrders = orders.filter(o => (o.paymentStatus || '').toLowerCase() !== 'paid');

      return {
        type: 'orders',
        orders,
        paidOrders,
        pendingOrders,
        total: paidOrders.reduce((sum, o) => sum + (o.finalTotal || o.totalAmount || 0), 0),
        pending: pendingOrders.reduce((sum, o) => sum + (o.finalTotal || o.totalAmount || 0), 0),
        count: orders.length,
        paidCount: paidOrders.length,
        pendingCount: pendingOrders.length,
        vat: orders.reduce((sum, o) => sum + (o.taxAmount || 0), 0)
      };
    } catch (error) {
      console.error('Error loading orders report:', error);
      throw error;
    }
  };

  const loadProductReport = async () => {
    try {
      // Try cache first
      const ordersCacheKey = `orders_${filters.startDate}_${filters.endDate}`;
      const productsCacheKey = 'products_all';
      const cachedOrders = getCache(ordersCacheKey);
      const cachedProducts = getCache(productsCacheKey);
      
      let orders = [];
      let productsData = [];
      
      // Load orders
      if (cachedOrders) {
        orders = cachedOrders.filter(o => (o.paymentStatus || '').toLowerCase() === 'paid');
      } else {
        const ordersResponse = await realApi.getOrders({
          startDate: filters.startDate,
          endDate: filters.endDate,
          paymentStatus: 'paid'
        });
        if (ordersResponse.success) {
          orders = realApi.extractData(ordersResponse) || [];
          setCache(ordersCacheKey, orders);
        }
      }
      
      // Load products
      if (cachedProducts) {
        productsData = cachedProducts;
      } else {
        const productsResponse = await realApi.getProducts();
        if (productsResponse.success) {
          productsData = realApi.extractData(productsResponse) || [];
          setCache(productsCacheKey, productsData);
          setCache(`${productsCacheKey}_time`, Date.now());
        }
      }

      if (!productsData.length) {
        throw new Error('Failed to load product report data');
      }

      // Calculate product sales
      const productSales = {};
      orders.forEach(order => {
        if (order.items && Array.isArray(order.items)) {
          order.items.forEach(item => {
            const productId = item.product?._id || item.product;
            if (!productSales[productId]) {
              productSales[productId] = {
                productId,
                name: item.product?.name || item.name || 'Unknown',
                category: item.product?.category || 'Uncategorized',
                quantitySold: 0,
                revenue: 0,
                cost: 0,
                profit: 0
              };
            }
            productSales[productId].quantitySold += item.quantity || 1;
            productSales[productId].revenue += (item.price || 0) * (item.quantity || 1);
          });
        }
      });

      // Merge with product data
      const productsWithSales = productsData.map(product => {
        const sales = productSales[product._id] || {
          productId: product._id,
          name: product.name,
          category: product.category,
          quantitySold: 0,
          revenue: 0,
          cost: 0,
          profit: 0
        };

        const cost = (product.costPrice || product.cost || 0) * sales.quantitySold;
        const profit = sales.revenue - cost;

        return {
          ...product,
          ...sales,
          cost,
          profit,
          profitMargin: sales.revenue > 0 ? (profit / sales.revenue * 100) : 0,
          stockStatus: getStockStatus(product.stock, product.lowStockThreshold || 10)
        };
      });

      // Apply filters
      let filteredProducts = productsWithSales;
      if (filters.category) {
        filteredProducts = filteredProducts.filter(p =>
          p.category?.toLowerCase() === filters.category.toLowerCase()
        );
      }
      if (filters.product) {
        const searchTerm = filters.product.toLowerCase();
        filteredProducts = filteredProducts.filter(p =>
          p.name.toLowerCase().includes(searchTerm)
        );
      }

      return {
        type: 'product',
        products: filteredProducts,
        totalProducts: filteredProducts.length,
        totalRevenue: filteredProducts.reduce((sum, p) => sum + p.revenue, 0),
        totalProfit: filteredProducts.reduce((sum, p) => sum + p.profit, 0),
        totalQuantitySold: filteredProducts.reduce((sum, p) => sum + p.quantitySold, 0)
      };
    } catch (error) {
      console.error('Error loading product report:', error);
      throw error;
    }
  };

  const loadDailySummaryReport = async (startDate, endDate) => {
    const response = await realApi.getOrders({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      paymentStatus: 'paid'
    });

    if (!response.success) throw new Error('Failed to load daily summary data');

    let orders = realApi.extractData(response) || [];
    orders = applyOrderFilters(orders);

    // Group by date
    const dailySummary = {};
    orders.forEach(order => {
      const date = new Date(order.createdAt || order.orderDate).toISOString().split('T')[0];
      if (!dailySummary[date]) {
        dailySummary[date] = {
          date,
          orders: [],
          totalAmount: 0,
          orderCount: 0,
          vat: 0,
          cashAmount: 0,
          mobileAmount: 0,
          cardAmount: 0
        };
      }

      dailySummary[date].orders.push(order);
      dailySummary[date].totalAmount += order.finalTotal || order.totalAmount || 0;
      dailySummary[date].orderCount++;
      dailySummary[date].vat += order.taxAmount || 0;

      const method = (order.paymentMethod || 'cash').toLowerCase();
      if (method === 'cash') {
        dailySummary[date].cashAmount += order.finalTotal || order.totalAmount || 0;
      } else if (['zaad', 'sahal', 'edahab', 'mycash', 'mobile'].includes(method)) {
        dailySummary[date].mobileAmount += order.finalTotal || order.totalAmount || 0;
      } else if (method === 'card') {
        dailySummary[date].cardAmount += order.finalTotal || order.totalAmount || 0;
      }
    });

    return {
      type: 'daily-summary',
      dailySummary: Object.values(dailySummary).sort((a, b) => new Date(b.date) - new Date(a.date)),
      orders,
      total: orders.reduce((sum, o) => sum + (o.finalTotal || o.totalAmount || 0), 0),
      count: orders.length,
      vat: orders.reduce((sum, o) => sum + (o.taxAmount || 0), 0)
    };
  };

  const loadInventoryReport = async () => {
    const productsResponse = await realApi.getProducts();
    const ordersResponse = await realApi.getOrders({
      startDate: filters.startDate,
      endDate: filters.endDate,
      paymentStatus: 'paid'
    });

    if (!productsResponse.success || !ordersResponse.success) {
      throw new Error('Failed to load inventory data');
    }

    const products = realApi.extractData(productsResponse) || [];
    const orders = realApi.extractData(ordersResponse) || [];

    // Calculate product usage
    const productUsage = {};
    orders.forEach(order => {
      if (order.items && Array.isArray(order.items)) {
        order.items.forEach(item => {
          const productId = item.product?._id || item.product;
          if (!productUsage[productId]) {
            productUsage[productId] = 0;
          }
          productUsage[productId] += item.quantity || 1;
        });
      }
    });

    // Add usage data to products
    const inventoryData = products.map(product => ({
      ...product,
      usage: productUsage[product._id] || 0,
      stockStatus: getStockStatus(product.stock, product.lowStockThreshold || 10),
      reorderNeeded: (product.stock || 0) <= (product.lowStockThreshold || 10),
      value: (product.stock || 0) * (product.costPrice || product.cost || 0)
    }));

    // Apply filters
    let filteredInventory = inventoryData;
    if (filters.category) {
      filteredInventory = filteredInventory.filter(p =>
        p.category?.toLowerCase() === filters.category.toLowerCase()
      );
    }
    if (filters.product) {
      const searchTerm = filters.product.toLowerCase();
      filteredInventory = filteredInventory.filter(p =>
        p.name.toLowerCase().includes(searchTerm)
      );
    }

    return {
      type: 'inventory',
      inventory: filteredInventory,
      lowStockItems: filteredInventory.filter(p => p.reorderNeeded),
      totalValue: filteredInventory.reduce((sum, p) => sum + p.value, 0),
      totalItems: filteredInventory.length,
      lowStockCount: filteredInventory.filter(p => p.reorderNeeded).length
    };
  };

  const loadCustomerReport = async (startDate, endDate) => {
    const response = await realApi.getOrders({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      paymentStatus: 'paid'
    });

    if (!response.success) throw new Error('Failed to load customer data');

    let orders = realApi.extractData(response) || [];
    orders = applyOrderFilters(orders);

    // Group by customer
    const customerData = {};
    orders.forEach(order => {
      const customerId = order.customer?._id || order.customerName;
      if (!customerId) return;

      if (!customerData[customerId]) {
        customerData[customerId] = {
          id: customerId,
          name: order.customer?.name || order.customerName || 'Walk-in Customer',
          orders: [],
          totalSpent: 0,
          orderCount: 0,
          averageOrderValue: 0,
          lastOrderDate: order.createdAt || order.orderDate
        };
      }

      customerData[customerId].orders.push(order);
      customerData[customerId].totalSpent += order.finalTotal || order.totalAmount || 0;
      customerData[customerId].orderCount++;
      customerData[customerId].averageOrderValue = customerData[customerId].totalSpent / customerData[customerId].orderCount;

      const orderDate = new Date(order.createdAt || order.orderDate);
      const lastDate = new Date(customerData[customerId].lastOrderDate);
      if (orderDate > lastDate) {
        customerData[customerId].lastOrderDate = order.createdAt || order.orderDate;
      }
    });

    return {
      type: 'customer',
      customers: Object.values(customerData).sort((a, b) => b.totalSpent - a.totalSpent),
      orders,
      totalCustomers: Object.keys(customerData).length,
      totalRevenue: orders.reduce((sum, o) => sum + (o.finalTotal || o.totalAmount || 0), 0)
    };
  };

  const loadAuditTrailReport = async (startDate, endDate) => {
    const response = await realApi.getAuditLogs({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      userId: filters.cashier
    });

    if (!response.success) {
      // Fallback to mock data or orders if audit API not available
      const ordersResponse = await realApi.getOrders({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      });

      if (!ordersResponse.success) throw new Error('Failed to load audit data');

      const orders = realApi.extractData(ordersResponse) || [];
      const auditLogs = orders.map(order => ({
        _id: order._id,
        action: order.status === 'paid' ? 'PAYMENT' : 'ORDER_CREATED',
        user: order.cashier?.name || 'System',
        userId: order.cashier?._id,
        details: `Order #${order.orderNumber}: ${order.status}`,
        timestamp: order.createdAt || order.orderDate,
        ipAddress: 'N/A',
        userAgent: 'N/A'
      }));

      return {
        type: 'audit-trail',
        logs: auditLogs,
        totalLogs: auditLogs.length
      };
    }

    const logs = realApi.extractData(response) || [];
    return {
      type: 'audit-trail',
      logs,
      totalLogs: logs.length
    };
  };

  const loadPreviousPaymentReport = async (startDate, endDate) => {
    // Adjust dates to previous period
    const daysDiff = Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24));
    const prevStartDate = new Date(startDate);
    const prevEndDate = new Date(endDate);
    prevStartDate.setDate(prevStartDate.getDate() - daysDiff - 1);
    prevEndDate.setDate(prevEndDate.getDate() - daysDiff - 1);

    const response = await realApi.getOrders({
      startDate: prevStartDate.toISOString(),
      endDate: prevEndDate.toISOString(),
      paymentStatus: 'paid'
    });

    if (!response.success) throw new Error('Failed to load previous payment data');

    let orders = realApi.extractData(response) || [];
    orders = applyOrderFilters(orders);

    return {
      type: 'previous-payment',
      orders,
      period: {
        start: prevStartDate,
        end: prevEndDate
      },
      total: orders.reduce((sum, o) => sum + (o.finalTotal || o.totalAmount || 0), 0),
      count: orders.length,
      vat: orders.reduce((sum, o) => sum + (o.taxAmount || 0), 0)
    };
  };

  const loadAdvanceReport = async (startDate, endDate) => {
    // For advance payments (deposits, prepayments)
    const response = await realApi.getOrders({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      paymentStatus: 'partial'
    });

    if (!response.success) throw new Error('Failed to load advance data');

    let orders = realApi.extractData(response) || [];
    orders = orders.filter(order => (order.paymentStatus || '').toLowerCase() === 'partial');
    orders = applyOrderFilters(orders);

    return {
      type: 'advance',
      orders,
      totalAdvance: orders.reduce((sum, o) => sum + (o.paidAmount || 0), 0),
      totalDue: orders.reduce((sum, o) => sum + ((o.finalTotal || o.totalAmount || 0) - (o.paidAmount || 0)), 0),
      count: orders.length
    };
  };

  const applyOrderFilters = (orders) => {
    let filtered = [...orders];

    // Date filter
    const startDate = new Date(filters.startDate);
    const endDate = new Date(filters.endDate);
    endDate.setHours(23, 59, 59, 999);

    filtered = filtered.filter(order => {
      const orderDate = new Date(order.createdAt || order.orderDate);
      return orderDate >= startDate && orderDate <= endDate;
    });

    // Payment method filter
    if (filters.paymentMethod) {
      const method = filters.paymentMethod.toLowerCase();
      filtered = filtered.filter(order =>
        (order.paymentMethod || '').toLowerCase() === method
      );
    }

    // Customer filter
    if (filters.customer) {
      const searchTerm = filters.customer.toLowerCase();
      filtered = filtered.filter(order =>
        (order.customer?.name || order.customerName || '').toLowerCase().includes(searchTerm)
      );
    }

    // Status filter
    if (filters.status) {
      const status = filters.status.toLowerCase();
      if (status === 'paid') {
        filtered = filtered.filter(order => (order.paymentStatus || '').toLowerCase() === 'paid');
      } else {
        filtered = filtered.filter(order => (order.status || '').toLowerCase() === status);
      }
    }

    // Cashier filter
    if (filters.cashier) {
      filtered = filtered.filter(order =>
        order.cashier?._id === filters.cashier ||
        order.cashier?.name?.toLowerCase() === filters.cashier.toLowerCase()
      );
    }

    return filtered;
  };

  const getStockStatus = (stock, threshold) => {
    if (stock === undefined || stock === null) return 'unknown';
    if (stock <= 0) return 'out-of-stock';
    if (stock <= threshold) return 'low-stock';
    return 'in-stock';
  };

  const updateSummary = (data, reportId) => {
    if (!data) return;

    switch (reportId) {
      case 'payment':
      case 'mobile-payment':
      case 'sms-payment':
      case 'orders':
      case 'sale':
      case 'daily-summary':
      case 'previous-payment':
        setSummary({
          totalAmount: data.total || 0,
          totalTransactions: data.count || data.orders?.length || 0,
          vat: data.vat || 0,
          pending: data.pending || 0,
          cashAmount: data.cashAmount || 0,
          mobileAmount: data.mobileAmount || 0,
          cardAmount: data.cardAmount || 0,
          productCount: 0,
          lowStockCount: 0
        });
        break;

      case 'product':
        setSummary({
          totalAmount: data.totalRevenue || 0,
          totalTransactions: data.totalQuantitySold || 0,
          vat: 0,
          pending: 0,
          cashAmount: 0,
          mobileAmount: 0,
          cardAmount: 0,
          productCount: data.totalProducts || 0,
          lowStockCount: 0,
          totalProfit: data.totalProfit || 0
        });
        break;

      case 'inventory':
        setSummary({
          totalAmount: data.totalValue || 0,
          totalTransactions: data.totalItems || 0,
          vat: 0,
          pending: 0,
          cashAmount: 0,
          mobileAmount: 0,
          cardAmount: 0,
          productCount: data.totalItems || 0,
          lowStockCount: data.lowStockCount || 0
        });
        break;

      case 'customer':
        setSummary({
          totalAmount: data.totalRevenue || 0,
          totalTransactions: data.totalCustomers || 0,
          vat: 0,
          pending: 0,
          cashAmount: 0,
          mobileAmount: 0,
          cardAmount: 0,
          productCount: 0,
          lowStockCount: 0
        });
        break;

      case 'audit-trail':
        setSummary({
          totalAmount: 0,
          totalTransactions: data.totalLogs || 0,
          vat: 0,
          pending: 0,
          cashAmount: 0,
          mobileAmount: 0,
          cardAmount: 0,
          productCount: 0,
          lowStockCount: 0
        });
        break;

      case 'advance':
        setSummary({
          totalAmount: data.totalAdvance || 0,
          totalTransactions: data.count || 0,
          vat: 0,
          pending: data.totalDue || 0,
          cashAmount: 0,
          mobileAmount: 0,
          cardAmount: 0,
          productCount: 0,
          lowStockCount: 0
        });
        break;

      default:
        setSummary({
          totalAmount: 0,
          totalTransactions: 0,
          vat: 0,
          pending: 0,
          cashAmount: 0,
          mobileAmount: 0,
          cardAmount: 0,
          productCount: 0,
          lowStockCount: 0
        });
    }
  };

  const handleReportClick = (report) => {
    if (report.route) {
      navigate(report.route);
    } else {
      setActiveReport(report.id);
      setCurrentPage(1); // Reset to first page
    }
  };

  const handleBack = () => {
    setActiveReport(null);
    setReportData(null);
    setCurrentPage(1);
  };

  const exportReport = () => {
    if (!reportData || reportData.type === 'coming-soon' || reportData.type === 'error') return;

    let csv = '';
    let filename = `${activeReport}-report-${filters.startDate}-${filters.endDate}.csv`;

    switch (reportData.type) {
      case 'payment':
        const paymentHeaders = ['Order Number', 'Date', 'Customer', 'Amount', 'Payment Method', 'Status', 'VAT'];
        const paymentRows = reportData.orders.map(order => [
          order.orderNumber || order._id,
          formatDate(order.createdAt || order.orderDate),
          order.customer?.name || 'Walk-in',
          (order.finalTotal || order.totalAmount || 0).toFixed(2),
          order.paymentMethod || 'cash',
          order.status || 'pending',
          (order.taxAmount || 0).toFixed(2)
        ]);
        csv = [paymentHeaders, ...paymentRows].map(row => row.join(',')).join('\n');
        break;

      case 'mobile-payment':
        const mobileHeaders = ['Order Number', 'Date', 'Customer', 'Amount', 'Mobile Payment Method', 'Status', 'VAT'];
        const mobileRows = reportData.orders.map(order => [
          order.orderNumber || order._id,
          formatDate(order.createdAt || order.orderDate),
          order.customer?.name || 'Walk-in',
          (order.finalTotal || order.totalAmount || 0).toFixed(2),
          order.paymentMethod || 'mobile',
          order.status || 'pending',
          (order.taxAmount || 0).toFixed(2)
        ]);
        csv = [mobileHeaders, ...mobileRows].map(row => row.join(',')).join('\n');
        break;

      case 'orders':
        const orderHeaders = ['Order Number', 'Date', 'Customer', 'Amount', 'Payment Status', 'Order Status', 'Payment Method', 'VAT'];
        const orderRows = reportData.orders.map(order => [
          order.orderNumber || order._id,
          formatDate(order.createdAt || order.orderDate),
          order.customer?.name || 'Walk-in',
          (order.finalTotal || order.totalAmount || 0).toFixed(2),
          order.paymentStatus || 'pending',
          order.status || 'pending',
          order.paymentMethod || 'cash',
          (order.taxAmount || 0).toFixed(2)
        ]);
        csv = [orderHeaders, ...orderRows].map(row => row.join(',')).join('\n');
        break;

      case 'product':
        const productHeaders = ['Product Name', 'Category', 'Price', 'Cost', 'Stock', 'Quantity Sold', 'Revenue', 'Profit', 'Profit Margin %'];
        const productRows = reportData.products.map(product => [
          product.name || '',
          product.category || '',
          (product.price || 0).toFixed(2),
          (product.costPrice || product.cost || 0).toFixed(2),
          product.stock || 0,
          product.quantitySold || 0,
          (product.revenue || 0).toFixed(2),
          (product.profit || 0).toFixed(2),
          (product.profitMargin || 0).toFixed(2)
        ]);
        csv = [productHeaders, ...productRows].map(row => row.join(',')).join('\n');
        break;

      case 'daily-summary':
        const dailyHeaders = ['Date', 'Total Orders', 'Total Amount', 'VAT', 'Cash Amount', 'Mobile Amount', 'Card Amount'];
        const dailyRows = reportData.dailySummary.map(day => [
          day.date,
          day.orderCount,
          day.totalAmount.toFixed(2),
          day.vat.toFixed(2),
          day.cashAmount.toFixed(2),
          day.mobileAmount.toFixed(2),
          day.cardAmount.toFixed(2)
        ]);
        csv = [dailyHeaders, ...dailyRows].map(row => row.join(',')).join('\n');
        break;

      case 'inventory':
        const inventoryHeaders = ['Product Name', 'Category', 'Stock', 'Low Stock Threshold', 'Status', 'Cost Price', 'Stock Value', 'Usage'];
        const inventoryRows = reportData.inventory.map(item => [
          item.name || '',
          item.category || '',
          item.stock || 0,
          item.lowStockThreshold || 10,
          item.stockStatus || '',
          (item.costPrice || item.cost || 0).toFixed(2),
          (item.value || 0).toFixed(2),
          item.usage || 0
        ]);
        csv = [inventoryHeaders, ...inventoryRows].map(row => row.join(',')).join('\n');
        break;

      case 'customer':
        const customerHeaders = ['Customer Name', 'Total Orders', 'Total Spent', 'Average Order Value', 'Last Order Date'];
        const customerRows = reportData.customers.map(customer => [
          customer.name || 'Unknown',
          customer.orderCount,
          customer.totalSpent.toFixed(2),
          customer.averageOrderValue.toFixed(2),
          formatDate(customer.lastOrderDate)
        ]);
        csv = [customerHeaders, ...customerRows].map(row => row.join(',')).join('\n');
        break;

      case 'audit-trail':
        const auditHeaders = ['Timestamp', 'User', 'Action', 'Details', 'IP Address'];
        const auditRows = reportData.logs.map(log => [
          formatDate(log.timestamp) + ' ' + formatTime(log.timestamp),
          log.user || 'System',
          log.action || 'Unknown',
          log.details || '',
          log.ipAddress || 'N/A'
        ]);
        csv = [auditHeaders, ...auditRows].map(row => row.join(',')).join('\n');
        break;

      case 'advance':
        const advanceHeaders = ['Order Number', 'Date', 'Customer', 'Total Amount', 'Advance Paid', 'Balance Due', 'Payment Method'];
        const advanceRows = reportData.orders.map(order => [
          order.orderNumber || order._id,
          formatDate(order.createdAt || order.orderDate),
          order.customer?.name || 'Walk-in',
          (order.finalTotal || order.totalAmount || 0).toFixed(2),
          (order.paidAmount || 0).toFixed(2),
          ((order.finalTotal || order.totalAmount || 0) - (order.paidAmount || 0)).toFixed(2),
          order.paymentMethod || 'cash'
        ]);
        csv = [advanceHeaders, ...advanceRows].map(row => row.join(',')).join('\n');
        break;
    }

    if (csv) {
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const renderReportContent = () => {
    if (!reportData) return null;

    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;

    switch (reportData.type) {
      case 'payment':
        const paymentItems = reportData.paymentGroups?.slice(indexOfFirstItem, indexOfLastItem) || [];
        const totalPaymentPages = Math.ceil((reportData.paymentGroups?.length || 0) / itemsPerPage);
        return (
          <div className="space-y-4">
            {/* Payment Methods Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              {reportData.paymentGroups?.map((group, index) => (
                <div key={index} className="bg-white p-4 rounded-lg shadow border">
                  <h3 className="text-sm font-medium text-gray-600 capitalize">{group.method} Payments</h3>
                  <p className="text-2xl font-bold text-blue-600">{formatCurrency(group.amount, settings?.currency || 'USD')}</p>
                  <div className="flex justify-between text-xs text-gray-500 mt-2">
                    <span>{group.count} transactions</span>
                    <span>VAT: {formatCurrency(group.vat, settings?.currency || 'USD')}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Payment Details Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payment Method</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Transactions</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">VAT</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Average</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {paymentItems.map((group, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 capitalize">
                          {group.method}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {group.count}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                          {formatCurrency(group.amount, settings?.currency || 'USD')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatCurrency(group.vat, settings?.currency || 'USD')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatCurrency((group.amount / group.count) || 0, settings?.currency || 'USD')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <button
                            onClick={() => {
                              setFilters(prev => ({ ...prev, paymentMethod: group.method }));
                              loadReportData('payment');
                            }}
                            className="text-blue-600 hover:text-blue-800 text-xs"
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {renderPagination(totalPaymentPages)}
            </div>
          </div>
        );

      case 'mobile-payment':
        const mobileItems = reportData.mobileGroups?.slice(indexOfFirstItem, indexOfLastItem) || [];
        const totalMobilePages = Math.ceil((reportData.mobileGroups?.length || 0) / itemsPerPage);
        return (
          <div className="space-y-4">
            {/* Mobile Payment Methods Summary */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
              {reportData.mobileGroups?.map((group, index) => (
                <div key={index} className="bg-white p-4 rounded-lg shadow border border-blue-200">
                  <h3 className="text-sm font-medium text-gray-600 capitalize">{group.method}</h3>
                  <p className="text-2xl font-bold text-blue-600">{formatCurrency(group.amount, settings?.currency || 'USD')}</p>
                  <div className="flex justify-between text-xs text-gray-500 mt-2">
                    <span>{group.count} transactions</span>
                    <span>VAT: {formatCurrency(group.vat, settings?.currency || 'USD')}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Mobile Payment Details */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mobile Method</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Transactions</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">VAT</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Average</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {mobileItems.map((group, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 capitalize">
                          {group.method}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {group.count}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                          {formatCurrency(group.amount, settings?.currency || 'USD')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatCurrency(group.vat, settings?.currency || 'USD')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatCurrency((group.amount / group.count) || 0, settings?.currency || 'USD')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {renderPagination(totalMobilePages)}
            </div>
          </div>
        );

      case 'product':
        const productItems = reportData.products?.slice(indexOfFirstItem, indexOfLastItem) || [];
        const totalProductPages = Math.ceil((reportData.products?.length || 0) / itemsPerPage);
        return (
          <div className="space-y-4">
            {/* Product Sales Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="bg-white p-4 rounded-lg shadow border">
                <h3 className="text-sm font-medium text-gray-600">Total Revenue</h3>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(reportData.totalRevenue || 0, settings?.currency || 'USD')}</p>
              </div>
              <div className="bg-white p-4 rounded-lg shadow border">
                <h3 className="text-sm font-medium text-gray-600">Total Profit</h3>
                <p className="text-2xl font-bold text-blue-600">{formatCurrency(reportData.totalProfit || 0, settings?.currency || 'USD')}</p>
              </div>
              <div className="bg-white p-4 rounded-lg shadow border">
                <h3 className="text-sm font-medium text-gray-600">Total Quantity Sold</h3>
                <p className="text-2xl font-bold text-purple-600">{reportData.totalQuantitySold}</p>
              </div>
            </div>

            {/* Product Details Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cost</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stock</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sold</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Revenue</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Profit</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Margin</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {productItems.map((product, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {product.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {product.category || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(product.price || 0, settings?.currency || 'USD')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency((product.costPrice || product.cost || 0), settings?.currency || 'USD')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${product.stockStatus === 'out-of-stock' ? 'bg-red-100 text-red-800' :
                              product.stockStatus === 'low-stock' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-green-100 text-green-800'
                            }`}>
                            {product.stock || 0}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {product.quantitySold || 0}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                          {formatCurrency(product.revenue || 0, settings?.currency || 'USD')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                          {formatCurrency(product.profit || 0, settings?.currency || 'USD')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${(product.profitMargin || 0) > 50 ? 'bg-green-100 text-green-800' :
                              (product.profitMargin || 0) > 30 ? 'bg-yellow-100 text-yellow-800' :
                                'bg-red-100 text-red-800'
                            }`}>
                            {(product.profitMargin || 0).toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {renderPagination(totalProductPages)}
            </div>
          </div>
        );

      case 'daily-summary':
        const dailyItems = reportData.dailySummary?.slice(indexOfFirstItem, indexOfLastItem) || [];
        const totalDailyPages = Math.ceil((reportData.dailySummary?.length || 0) / itemsPerPage);
        return (
          <div className="space-y-4">
            {/* Daily Summary Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Orders</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Amount</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">VAT</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cash</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mobile</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Card</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {dailyItems.map((day, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {formatDate(day.date)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {day.orderCount}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                          {formatCurrency(day.totalAmount || 0, settings?.currency || 'USD')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatCurrency(day.vat || 0, settings?.currency || 'USD')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600">
                          {formatCurrency(day.cashAmount || 0, settings?.currency || 'USD')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-purple-600">
                          {formatCurrency(day.mobileAmount || 0, settings?.currency || 'USD')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-orange-600">
                          {formatCurrency(day.cardAmount || 0, settings?.currency || 'USD')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {renderPagination(totalDailyPages)}
            </div>
          </div>
        );

      case 'inventory':
        const inventoryItems = reportData.inventory?.slice(indexOfFirstItem, indexOfLastItem) || [];
        const totalInventoryPages = Math.ceil((reportData.inventory?.length || 0) / itemsPerPage);
        return (
          <div className="space-y-4">
            {/* Low Stock Alert */}
            {reportData.lowStockItems && reportData.lowStockItems.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-red-800">Low Stock Alert</h3>
                    <p className="text-sm text-red-600">
                      {reportData.lowStockItems.length} items need reordering
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      // You can implement a reorder function here
                      alert(`Reorder ${reportData.lowStockItems.length} items`);
                    }}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
                  >
                    Generate Reorder List
                  </button>
                </div>
              </div>
            )}

            {/* Inventory Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stock</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cost Price</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stock Value</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Usage</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {inventoryItems.map((item, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {item.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {item.category || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {item.stock || 0}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${item.stockStatus === 'out-of-stock' ? 'bg-red-100 text-red-800' :
                              item.stockStatus === 'low-stock' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-green-100 text-green-800'
                            }`}>
                            {item.stockStatus || 'Unknown'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          ${(item.costPrice || item.cost || 0).toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                          ${(item.value || 0).toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {item.usage || 0}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {item.reorderNeeded && (
                            <button
                              onClick={() => {
                                // Implement reorder action
                                alert(`Reorder ${item.name}`);
                              }}
                              className="text-red-600 hover:text-red-800 text-xs"
                            >
                              Reorder
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {renderPagination(totalInventoryPages)}
            </div>
          </div>
        );

      case 'customer':
        const customerItems = reportData.customers?.slice(indexOfFirstItem, indexOfLastItem) || [];
        const totalCustomerPages = Math.ceil((reportData.customers?.length || 0) / itemsPerPage);
        return (
          <div className="space-y-4">
            {/* Top Customers */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              {reportData.customers?.slice(0, 3).map((customer, index) => (
                <div key={index} className="bg-white p-4 rounded-lg shadow border">
                  <h3 className="text-sm font-medium text-gray-600">Top Customer {index + 1}</h3>
                  <p className="text-lg font-bold text-gray-900 truncate">{customer.name}</p>
                  <div className="flex justify-between text-sm text-gray-500 mt-2">
                    <span>Orders: {customer.orderCount}</span>
                    <span className="font-medium text-green-600">${customer.totalSpent.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Customer Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Orders</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Spent</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avg. Order</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Order</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {customerItems.map((customer, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {customer.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {customer.orderCount}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                          ${customer.totalSpent.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          ${customer.averageOrderValue.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(customer.lastOrderDate)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <button
                            onClick={() => {
                              setFilters(prev => ({ ...prev, customer: customer.name }));
                              loadReportData('orders');
                            }}
                            className="text-blue-600 hover:text-blue-800 text-xs"
                          >
                            View Orders
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {renderPagination(totalCustomerPages)}
            </div>
          </div>
        );

      case 'audit-trail':
        const auditItems = reportData.logs?.slice(indexOfFirstItem, indexOfLastItem) || [];
        const totalAuditPages = Math.ceil((reportData.logs?.length || 0) / itemsPerPage);
        return (
          <div className="space-y-4">
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Timestamp</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Details</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">IP Address</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {auditItems.map((log, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(log.timestamp)} {formatTime(log.timestamp)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {log.user || 'System'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${log.action.includes('PAYMENT') ? 'bg-green-100 text-green-800' :
                              log.action.includes('ORDER') ? 'bg-blue-100 text-blue-800' :
                                log.action.includes('UPDATE') ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-gray-100 text-gray-800'
                            }`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {log.details}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {log.ipAddress || 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {renderPagination(totalAuditPages)}
            </div>
          </div>
        );

      case 'coming-soon':
        return (
          <div className="bg-white p-12 rounded-lg shadow text-center">
            <div className="text-6xl mb-4">🚧</div>
            <p className="text-gray-500 text-lg">This report feature is coming soon</p>
          </div>
        );

      case 'error':
        return (
          <div className="bg-white p-12 rounded-lg shadow text-center">
            <div className="text-6xl mb-4">❌</div>
            <p className="text-red-500 text-lg">{reportData.message}</p>
            <button
              onClick={() => loadReportData(activeReport)}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Retry
            </button>
          </div>
        );

      default:
        return (
          <div className="bg-white p-12 rounded-lg shadow text-center">
            <p className="text-gray-500 text-lg">Select a report to view details</p>
          </div>
        );
    }
  };

  const renderPagination = (totalPages) => {
    if (totalPages <= 1) return null;

    return (
      <div className="px-6 py-4 border-t border-gray-200 flex justify-between items-center">
        <p className="text-sm text-gray-700">
          Page {currentPage} of {totalPages}
        </p>
        <div className="flex space-x-2">
          <button
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50"
          >
            Previous
          </button>
          <button
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50"
          >
            Next
          </button>
          <button
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages}
            className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50"
          >
            Last
          </button>
        </div>
      </div>
    );
  };

  const renderSummaryCards = () => {
    if (!reportData || ['coming-soon', 'error'].includes(reportData.type)) return null;

    const reportType = reportTypes.find(r => r.id === activeReport);
    const isPaymentReport = ['payment', 'mobile-payment', 'sms-payment', 'orders', 'sale', 'daily-summary', 'previous-payment'].includes(activeReport);
    const isProductReport = ['product', 'inventory'].includes(activeReport);
    const isCustomerReport = ['customer'].includes(activeReport);
    const isAdvanceReport = ['advance'].includes(activeReport);

    if (isPaymentReport) {
      return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="bg-white p-4 rounded-lg shadow border-l-4 border-blue-500">
            <h3 className="text-sm font-medium text-gray-600">Total Amount</h3>
            <p className="text-2xl font-bold text-blue-600">
              {formatCurrency(summary.totalAmount || 0, settings?.currency || 'USD')}
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow border-l-4 border-green-500">
            <h3 className="text-sm font-medium text-gray-600">Total Transactions</h3>
            <p className="text-2xl font-bold text-green-600">{summary.totalTransactions}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow border-l-4 border-purple-500">
            <h3 className="text-sm font-medium text-gray-600">VAT</h3>
            <p className="text-2xl font-bold text-purple-600">
              {formatCurrency(summary.vat || 0, settings?.currency || 'USD')}
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow border-l-4 border-yellow-500">
            <h3 className="text-sm font-medium text-gray-600">Pending</h3>
            <p className="text-2xl font-bold text-yellow-600">
              {formatCurrency(summary.pending || 0, settings?.currency || 'USD')}
            </p>
          </div>
        </div>
      );
    } else if (isProductReport) {
      return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="bg-white p-4 rounded-lg shadow border-l-4 border-blue-500">
            <h3 className="text-sm font-medium text-gray-600">Total Products</h3>
            <p className="text-2xl font-bold text-blue-600">{summary.productCount}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow border-l-4 border-green-500">
            <h3 className="text-sm font-medium text-gray-600">Total Value</h3>
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(summary.totalAmount || 0, settings?.currency || 'USD')}
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow border-l-4 border-red-500">
            <h3 className="text-sm font-medium text-gray-600">Low Stock Items</h3>
            <p className="text-2xl font-bold text-red-600">{summary.lowStockCount}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow border-l-4 border-purple-500">
            <h3 className="text-sm font-medium text-gray-600">Total Transactions</h3>
            <p className="text-2xl font-bold text-purple-600">{summary.totalTransactions}</p>
          </div>
        </div>
      );
    } else if (isCustomerReport) {
      return (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
          <div className="bg-white p-4 rounded-lg shadow border-l-4 border-blue-500">
            <h3 className="text-sm font-medium text-gray-600">Total Customers</h3>
            <p className="text-2xl font-bold text-blue-600">{summary.totalTransactions}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow border-l-4 border-green-500">
            <h3 className="text-sm font-medium text-gray-600">Total Revenue</h3>
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(summary.totalAmount || 0, settings?.currency || 'USD')}
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow border-l-4 border-purple-500">
            <h3 className="text-sm font-medium text-gray-600">Avg. per Customer</h3>
            <p className="text-2xl font-bold text-purple-600">
              {formatCurrency((summary.totalAmount / summary.totalTransactions) || 0, settings?.currency || 'USD')}
            </p>
          </div>
        </div>
      );
    } else if (isAdvanceReport) {
      return (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
          <div className="bg-white p-4 rounded-lg shadow border-l-4 border-blue-500">
            <h3 className="text-sm font-medium text-gray-600">Total Advance</h3>
            <p className="text-2xl font-bold text-blue-600">
              {formatCurrency(summary.totalAmount || 0, settings?.currency || 'USD')}
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow border-l-4 border-yellow-500">
            <h3 className="text-sm font-medium text-gray-600">Pending Balance</h3>
            <p className="text-2xl font-bold text-yellow-600">
              {formatCurrency(summary.pending || 0, settings?.currency || 'USD')}
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow border-l-4 border-purple-500">
            <h3 className="text-sm font-medium text-gray-600">Total Transactions</h3>
            <p className="text-2xl font-bold text-purple-600">{summary.totalTransactions}</p>
          </div>
        </div>
      );
    } else if (activeReport === 'audit-trail') {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="bg-white p-4 rounded-lg shadow border-l-4 border-blue-500">
            <h3 className="text-sm font-medium text-gray-600">Total Log Entries</h3>
            <p className="text-2xl font-bold text-blue-600">{summary.totalTransactions}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow border-l-4 border-green-500">
            <h3 className="text-sm font-medium text-gray-600">Period</h3>
            <p className="text-lg font-bold text-green-600">
              {formatDate(filters.startDate)} to {formatDate(filters.endDate)}
            </p>
          </div>
        </div>
      );
    }
  };

  const renderFilters = () => {
    if (!reportData || ['coming-soon', 'error'].includes(reportData.type)) return null;

    const isProductReport = ['product', 'inventory'].includes(activeReport);
    const isAuditReport = ['audit-trail'].includes(activeReport);

    return (
      <div className="bg-white p-4 rounded-lg shadow mb-4">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
              className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
              className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
            />
          </div>

          {!isProductReport && !isAuditReport && (
            <>
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
                <label className="block text-xs font-medium text-gray-700 mb-1">Payment Method</label>
                <select
                  value={filters.paymentMethod}
                  onChange={(e) => setFilters(prev => ({ ...prev, paymentMethod: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                >
                  <option value="">All Methods</option>
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="zaad">Zaad</option>
                  <option value="sahal">Sahal</option>
                  <option value="edahab">EDahab</option>
                  <option value="mycash">MyCash</option>
                  <option value="mobile">Mobile</option>
                  <option value="sms">SMS</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                >
                  <option value="">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="completed">Completed</option>
                  <option value="paid">Paid</option>
                  <option value="partial">Partial</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Cashier</label>
                <select
                  value={filters.cashier}
                  onChange={(e) => setFilters(prev => ({ ...prev, cashier: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                >
                  <option value="">All Cashiers</option>
                  {cashiers.map(cashier => (
                    <option key={cashier._id} value={cashier._id}>
                      {cashier.name}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {isProductReport && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Product</label>
                <input
                  type="text"
                  placeholder="Search product"
                  value={filters.product}
                  onChange={(e) => setFilters(prev => ({ ...prev, product: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={filters.category}
                  onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                >
                  <option value="">All Categories</option>
                  {categories.map(category => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {isAuditReport && (
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">User</label>
              <select
                value={filters.cashier}
                onChange={(e) => setFilters(prev => ({ ...prev, cashier: e.target.value }))}
                className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
              >
                <option value="">All Users</option>
                {cashiers.map(cashier => (
                  <option key={cashier._id} value={cashier._id}>
                    {cashier.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex justify-end mt-4 space-x-2">
          <button
            onClick={() => {
              setFilters({
                startDate: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
                endDate: new Date().toISOString().split('T')[0],
                paymentMethod: '',
                customer: '',
                status: '',
                product: '',
                category: '',
                cashier: ''
              });
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm"
          >
            Clear Filters
          </button>
          <button
            onClick={() => loadReportData(activeReport)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
          >
            Apply Filters
          </button>
        </div>
      </div>
    );
  };

  // Show report detail view
  if (activeReport && reportData) {
    const selectedReport = reportTypes.find(r => r.id === activeReport);

    return (
      <div className="page-content flex flex-col gap-6 h-full overflow-auto">
        {/* Header */}
        <div className="card bg-gradient-to-r from-blue-600 to-blue-700 text-white border-0 shadow-lg">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <button
                onClick={handleBack}
                className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors"
              >
                ← Back to Reports
              </button>
              <div>
                <h1 className="heading-1 text-white">{selectedReport?.title}</h1>
                <p className="text-blue-100 text-sm mt-1">{selectedReport?.description}</p>
                {dataSource === 'cache' && (
                  <p className="text-blue-200 text-xs mt-1">📦 Showing cached data (offline mode)</p>
                )}
                {dataSource === 'local' && (
                  <p className="text-yellow-200 text-xs mt-1">📡 Showing local data (computed from device)</p>
                )}
                {dataSource === 'fresh' && (
                  <p className="text-blue-200 text-xs mt-1">✅ Live data</p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => window.print()}
                className="bg-white text-blue-600 px-4 py-2 rounded-lg font-medium hover:bg-blue-50 shadow-sm transition-colors"
              >
                Print
              </button>
              <button
                onClick={exportReport}
                className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 shadow-sm transition-colors"
              >
                Export CSV
              </button>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        {renderSummaryCards()}

        {/* Filters */}
        {renderFilters()}

        {/* Report Content */}
        {loading ? (
          <div className="card text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-4 text-gray-500">Loading report data...</p>
            <p className="mt-2 text-xs text-gray-400">Using cached data if available</p>
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-auto">
            {renderReportContent()}
          </div>
        )}
      </div>
    );
  }

  // Main grid view
  return (
    <div className="page-content flex flex-col gap-6 h-full overflow-auto">
      {/* Header */}
      <div className="card bg-gradient-to-r from-blue-600 to-blue-700 text-white border-0 shadow-lg">
        <div>
          <h1 className="heading-1 text-white mb-2">Reports Dashboard</h1>
          <p className="text-blue-100">View and export financial and operational reports</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 flex-1 overflow-y-auto">
        {reportTypes.map((report) => (
          <button
            key={report.id}
            onClick={() => handleReportClick(report)}
            className="card text-center hover:shadow-lg transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-blue-300"
          >
            <div className="text-4xl mb-3">{report.icon}</div>
            <div className="heading-3 mb-2">{report.title}</div>
            <p className="text-sm text-muted">{report.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
};

export default Reports;
