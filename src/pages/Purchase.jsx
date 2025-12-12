// src/pages/Purchase.js - REAL BACKEND ONLY
import React, { useState, useEffect, useRef } from 'react';
import PurchaseProducts from '../components/purchase/PurchaseProducts';
import PurchaseOrders from '../components/purchase/PurchaseOrders';
import Suppliers from '../components/purchase/Suppliers';
import ProductReport from '../components/purchase/ProductReport';
import DailyTransactions from '../components/purchase/DailyTransactions';
import { realApi } from '../api/realApi';
import { useAuth } from '../contexts/AuthContext';
import { API_CONFIG } from '../config/api.config';
import { RefreshCw, DollarSign, Package, Building, AlertCircle } from 'lucide-react';

const Purchase = () => {
  const [activeView, setActiveView] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [purchaseStats, setPurchaseStats] = useState({
    totalPurchases: 0,
    totalAmount: 0,
    pendingOrders: 0,
    activeSuppliers: 0,
    todayPurchases: 0,
    todayAmount: 0
  });
  const [loading, setLoading] = useState(false);
  const [backendStatus, setBackendStatus] = useState('checking');
  const timeIntervalRef = useRef(null);
  const { user, backendStatus: authBackendStatus } = useAuth();

  // Update current time every second
  useEffect(() => {
    timeIntervalRef.current = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => {
      if (timeIntervalRef.current) {
        clearInterval(timeIntervalRef.current);
      }
    };
  }, []);

  // Load purchase statistics
  useEffect(() => {
    if (!activeView) {
      loadPurchaseStats();
    }
  }, [activeView]);

  const loadPurchaseStats = async () => {
    try {
      setLoading(true);
      setBackendStatus('loading');
      
      console.log('📊 Loading purchase stats from backend (purchases, suppliers, purchase-orders)...');

      // Use existing backend endpoints (no /purchases/dashboard-stats in backend)
      const [purchasesRes, suppliersRes, poRes] = await Promise.all([
        realApi.getPurchases(),
        realApi.getSuppliers ? realApi.getSuppliers() : Promise.resolve({ success: false }),
        realApi.getPurchaseOrders ? realApi.getPurchaseOrders() : Promise.resolve({ success: false })
      ]);

      console.log('📦 Purchases response:', purchasesRes);
      console.log('📦 Suppliers response:', suppliersRes);
      console.log('📦 PurchaseOrders response:', poRes);

      if (!purchasesRes.success) throw new Error(purchasesRes.message || 'Failed to load purchases');

      const purchases = realApi.extractData(purchasesRes) || [];
      const suppliers = suppliersRes.success ? (realApi.extractData(suppliersRes) || []) : [];
      const purchaseOrders = poRes.success ? (realApi.extractData(poRes) || []) : [];

      const today = new Date().toDateString();
      const todayPurchasesArr = Array.isArray(purchases)
        ? purchases.filter(p => new Date(p.createdAt || p.date || p.purchaseDate || p.updatedAt).toDateString() === today)
        : [];

      const totalAmount = Array.isArray(purchases)
        ? purchases.reduce((s, p) => s + (p.totalAmount || p.finalTotal || p.amount || 0), 0)
        : 0;
      const todayAmount = todayPurchasesArr.reduce((s, p) => s + (p.totalAmount || p.finalTotal || p.amount || 0), 0);
      const pendingOrders = Array.isArray(purchaseOrders)
        ? purchaseOrders.filter(po => (po.status || '').toLowerCase() === 'pending').length
        : 0;
      const activeSuppliers = Array.isArray(suppliers) ? suppliers.length : 0;

      setPurchaseStats({
        totalPurchases: Array.isArray(purchases) ? purchases.length : 0,
        totalAmount,
        pendingOrders,
        activeSuppliers,
        todayPurchases: todayPurchasesArr.length,
        todayAmount
      });

      setBackendStatus('connected');
      console.log('✅ Purchase stats loaded successfully');
    } catch (error) {
      console.error('❌ Error loading purchase stats:', error);
      setBackendStatus('error');
      
      // Set default stats when backend fails
      setPurchaseStats({
        totalPurchases: 0,
        totalAmount: 0,
        pendingOrders: 0,
        activeSuppliers: 0,
        todayPurchases: 0,
        todayAmount: 0
      });
    } finally {
      setLoading(false);
    }
  };

  // Format date/time
  const formatDateTime = (date) => {
    return date.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const purchaseModules = [
    {
      id: 'products',
      title: 'Purchase Products',
      icon: '🛒',
      component: PurchaseProducts,
      description: 'Create new purchases and manage inventory'
    },
    {
      id: 'orders',
      title: 'Purchase Orders',
      icon: '📋',
      component: PurchaseOrders,
      description: 'Manage purchase orders and approvals'
    },
    {
      id: 'suppliers',
      title: 'Suppliers',
      icon: '🏢',
      component: Suppliers,
      description: 'Manage supplier information and contacts'
    },
    {
      id: 'report',
      title: 'Product Report',
      icon: '📊',
      component: ProductReport,
      description: 'View purchase analytics and reports'
    },
    {
      id: 'transactions',
      title: 'Daily Purchase Transactions',
      icon: '📄',
      component: DailyTransactions,
      description: 'View daily purchase history and transactions'
    }
  ];

  const ActiveComponent = activeView ? purchaseModules.find(m => m.id === activeView)?.component : null;

  const renderActiveComponent = () => {
    if (!ActiveComponent) return null;
    
    try {
      return React.createElement(ActiveComponent, {
        key: activeView
      });
    } catch (error) {
      console.error(`Error rendering ${activeView}:`, error);
      return (
        <div className="p-8 text-center">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            <h3 className="font-bold text-lg mb-2">Component Error</h3>
            <p>Failed to load {purchaseModules.find(m => m.id === activeView)?.title}</p>
            <p className="text-sm mt-2">{error.message}</p>
            <button
              onClick={() => setActiveView(null)}
              className="mt-4 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded"
            >
              Go Back
            </button>
          </div>
        </div>
      );
    }
  };

  if (ActiveComponent) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-blue-600 text-white p-4 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setActiveView(null)}
                className="text-white hover:bg-blue-700 p-2 rounded-lg transition-colors flex items-center space-x-2"
              >
                <span>←</span>
                <span>Back to Purchase</span>
              </button>
              <div>
                <h1 className="text-2xl font-bold">
                  {purchaseModules.find(m => m.id === activeView)?.title}
                </h1>
                <div className="text-sm text-blue-200 opacity-90">
                  {formatDateTime(currentTime)}
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <div className="text-sm text-blue-200">Live Time</div>
                <div className="font-semibold">
                  {currentTime.toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: true
                  })}
                </div>
              </div>
              <div className="text-2xl">
                {purchaseModules.find(m => m.id === activeView)?.icon}
              </div>
            </div>
          </div>
        </div>
        <div className="p-4">
          {renderActiveComponent()}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-6 shadow-lg">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold">Purchase Management</h1>
        </div>
      </div>

      {/* Purchase Statistics */}
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          {backendStatus === 'error' && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-500" />
                <div>
                  <h3 className="font-medium text-red-800">Backend Connection Issue</h3>
                  <p className="text-sm text-red-600">Unable to connect to purchase server. Please check if backend is running.</p>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {/* Total Purchase Amount */}
            <div className="bg-white rounded-xl shadow-sm border border-blue-100 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-blue-600">
                    {formatCurrency(purchaseStats.totalAmount)}
                  </div>
                  <div className="text-sm text-gray-600">Total Purchase Amount</div>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg">
                  <DollarSign className="w-6 h-6 text-blue-500" />
                </div>
              </div>
              <div className="mt-4 text-sm text-gray-500">
                <span className="font-medium">Today:</span> {formatCurrency(purchaseStats.todayAmount)}
              </div>
            </div>

            {/* Total Purchases */}
            <div className="bg-white rounded-xl shadow-sm border border-green-100 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-green-600">
                    {purchaseStats.totalPurchases}
                  </div>
                  <div className="text-sm text-gray-600">Total Purchases</div>
                </div>
                <div className="p-3 bg-green-50 rounded-lg">
                  <Package className="w-6 h-6 text-green-500" />
                </div>
              </div>
              <div className="mt-4 text-sm text-gray-500">
                <span className="font-medium">Today:</span> {purchaseStats.todayPurchases} purchases
              </div>
            </div>

            {/* Active Suppliers */}
            <div className="bg-white rounded-xl shadow-sm border border-purple-100 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-purple-600">
                    {purchaseStats.activeSuppliers}
                  </div>
                  <div className="text-sm text-gray-600">Active Suppliers</div>
                </div>
                <div className="p-3 bg-purple-50 rounded-lg">
                  <Building className="w-6 h-6 text-purple-500" />
                </div>
              </div>
              <div className="mt-4 text-sm text-gray-500">
                <span className="font-medium">Pending Orders:</span> {purchaseStats.pendingOrders}
              </div>
            </div>
          </div>

          {/* Main Content - Button Grid */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Purchase Modules</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              {purchaseModules.map((module) => (
                <button
                  key={module.id}
                  onClick={() => setActiveView(module.id)}
                  className="bg-white hover:bg-blue-50 border border-blue-200 rounded-xl p-6 text-center transition-all duration-200 transform hover:scale-105 hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-blue-300 group"
                >
                  <div className="text-4xl mb-4 group-hover:scale-110 transition-transform duration-200">
                    {module.icon}
                  </div>
                  <div className="font-semibold text-lg text-gray-800 group-hover:text-blue-700 mb-2">
                    {module.title}
                  </div>
                  <div className="text-sm text-gray-500 group-hover:text-blue-600 mb-3">
                    {module.description}
                  </div>
                  <div className="text-xs text-blue-400 font-medium">
                    Click to open →
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Status Section */}
          <div className="mt-12 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 shadow-sm border border-blue-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-800">System Status</h2>
              <div className="flex items-center gap-2">
                <div className="text-sm text-gray-500">
                  Real Time: {currentTime.toLocaleTimeString()}
                </div>
                <div className={`px-2 py-1 rounded text-xs ${
                  backendStatus === 'connected' ? 'bg-green-100 text-green-800' : 
                  backendStatus === 'loading' ? 'bg-yellow-100 text-yellow-800' : 
                  'bg-red-100 text-red-800'
                }`}>
                  {backendStatus === 'connected' ? 'Connected' : 
                   backendStatus === 'loading' ? 'Loading' : 'Error'}
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-white rounded-lg shadow-sm">
                <div className="text-2xl font-bold text-blue-600">{purchaseModules.length}</div>
                <div className="text-sm text-gray-600">Available Modules</div>
              </div>
              <div className="text-center p-4 bg-white rounded-lg shadow-sm">
                <div className="text-2xl font-bold text-green-600">🛒</div>
                <div className="text-sm text-gray-600">Real Purchase Data</div>
              </div>
              <div className="text-center p-4 bg-white rounded-lg shadow-sm">
                <div className="text-2xl font-bold text-purple-600">📋</div>
                <div className="text-sm text-gray-600">Live Backend</div>
              </div>
            </div>
            
            <div className="mt-6 pt-6 border-t border-blue-200 text-sm text-gray-500">
              <div className="flex justify-between items-center">
                <div>
                  <span className="font-medium">User:</span> {user?.name || user?.username || user?.email || 'Not logged in'}
                </div>
                <div>
                  <span className="font-medium">Backend:</span> {API_CONFIG.API_URL}
                </div>
                <div>
                  <span className="font-medium">Date:</span> {currentTime.toLocaleDateString()}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Purchase;