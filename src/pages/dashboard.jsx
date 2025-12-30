import React, { useState, useEffect, useCallback } from 'react';
import { realApi } from '../api/realApi.js';
// import { getCache, setCache } from '../services/offlineCache'; // Removed
import { formatDate, formatTime } from '../utils/date';
import {
  TrendingUp,
  Users,
  DollarSign,
  Package,
  ShoppingCart,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Clock,
  BarChart3,
  PieChart,
  Calendar,
  Coffee,
  UtensilsCrossed
} from 'lucide-react';

// Chart Components
import RevenueChart from '../components/charts/RevenueChart';
import SalesPieChart from '../components/charts/SalesPieChart';


import { useOptimisticData } from '../hooks/useOptimisticData';

const Dashboard = () => {
  const [timeframe, setTimeframe] = useState('today');

  // Initial structure matches the state structure used previously
  const initialData = {
    stats: {
      todayRevenue: 0,
      todayOrders: 0,
      completedOrders: 0,
      monthlyRevenue: 0,
      totalCustomers: 0,
      availableTables: 0,
      lowStockProducts: 0,
      averageOrderValue: 0,
      pendingOrders: 0,
      occupancyRate: 0
    },
    recentActivity: [],
    topProducts: [],
    dailySales: [],
    lastUpdated: new Date().toISOString()
  };

  const {
    data,
    loading: hookLoading,
    error: hookError,
    refresh
  } = useOptimisticData(`dashboard_data_${timeframe}`, async () => {
    console.log('📊 Fetching dashboard data for:', timeframe);

    const [statsResponse, activityResponse, productsResponse, salesResponse] = await Promise.allSettled([
      realApi.getStats(timeframe),
      realApi.getRecentActivity(6),
      realApi.getTopProducts(5),
      realApi.getDailySales(timeframe)
    ]);

    const result = { ...initialData, lastUpdated: new Date().toISOString() };

    // Handle stats response
    if (statsResponse.status === 'fulfilled' && statsResponse.value.success) {
      const statsData = realApi.extractData(statsResponse.value) || {};
      result.stats = { ...initialData.stats, ...statsData };
    }

    // Handle activity response
    if (activityResponse.status === 'fulfilled' && activityResponse.value.success) {
      result.recentActivity = realApi.extractData(activityResponse.value) || [];
    }

    // Handle products response
    if (productsResponse.status === 'fulfilled' && productsResponse.value.success) {
      result.topProducts = realApi.extractData(productsResponse.value) || [];
    }

    // Handle sales data
    if (salesResponse.status === 'fulfilled' && salesResponse.value.success) {
      const salesResponseData = realApi.extractData(salesResponse.value) || {};
      result.dailySales = salesResponseData.revenueData || (Array.isArray(salesResponseData) ? salesResponseData : []);
    }

    return result;
  }, initialData, [timeframe]);

  const { stats, recentActivity, topProducts, dailySales, lastUpdated } = data;
  const loading = hookLoading;
  const error = hookError ? (hookError.message || 'Failed to load dashboard data') : null;

  const fetchDashboardData = (period) => {
    if (period && period !== timeframe) {
      setTimeframe(period);
      // Hook will automatically detect dependency change and refresh
    } else {
      refresh();
    }
  };

  // Data load handled by hook
  // useEffect(() => { ... }, [timeframe]);

  // Stats cards configuration
  const statCards = [
    {
      title: "Today's Revenue",
      value: `$${stats.todayRevenue?.toFixed(2) || '0.00'}`,
      icon: <DollarSign className="w-6 h-6" />,
      change: "+12.5%",
      color: "from-emerald-500 to-emerald-600",
      iconBg: "bg-emerald-100",
      iconColor: "text-emerald-600"
    },
    {
      title: "Today's Orders",
      value: stats.todayOrders || 0,
      icon: <ShoppingCart className="w-6 h-6" />,
      change: "+8.2%",
      color: "from-blue-500 to-blue-600",
      iconBg: "bg-blue-100",
      iconColor: "text-blue-600"
    },
    {
      title: "Completed Orders",
      value: stats.completedOrders || 0,
      icon: <CheckCircle className="w-6 h-6" />,
      change: "+15%",
      color: "from-green-500 to-green-600",
      iconBg: "bg-green-100",
      iconColor: "text-green-600"
    },
    {
      title: "Monthly Revenue",
      value: `$${stats.monthlyRevenue?.toFixed(2) || '0.00'}`,
      icon: <TrendingUp className="w-6 h-6" />,
      change: "+18.3%",
      color: "from-purple-500 to-purple-600",
      iconBg: "bg-purple-100",
      iconColor: "text-purple-600"
    },
    {
      title: "Total Customers",
      value: stats.totalCustomers || 0,
      icon: <Users className="w-6 h-6" />,
      change: "+5.4%",
      color: "from-amber-500 to-amber-600",
      iconBg: "bg-amber-100",
      iconColor: "text-amber-600"
    },
    {
      title: "Low Stock Items",
      value: stats.lowStockProducts || 0,
      icon: <AlertCircle className="w-6 h-6" />,
      change: "-2",
      color: "from-rose-500 to-rose-600",
      iconBg: "bg-rose-100",
      iconColor: "text-rose-600"
    },
    {
      title: "Available Tables",
      value: `${stats.availableTables || 0}/25`,
      icon: <UtensilsCrossed className="w-6 h-6" />,
      change: "65% occupied",
      color: "from-indigo-500 to-indigo-600",
      iconBg: "bg-indigo-100",
      iconColor: "text-indigo-600"
    },
    {
      title: "Avg. Order Value",
      value: `$${stats.averageOrderValue?.toFixed(2) || '0.00'}`,
      icon: <BarChart3 className="w-6 h-6" />,
      change: "+3.2%",
      color: "from-cyan-500 to-cyan-600",
      iconBg: "bg-cyan-100",
      iconColor: "text-cyan-600"
    }
  ];

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'preparing': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'served': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'pending': return 'bg-slate-100 text-slate-800 border-slate-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getOrderTypeIcon = (type) => {
    switch (type) {
      case 'dine-in': return <UtensilsCrossed className="w-4 h-4" />;
      case 'takeaway': return <Package className="w-4 h-4" />;
      case 'delivery': return <ShoppingCart className="w-4 h-4" />;
      default: return <Coffee className="w-4 h-4" />;
    }
  };

  return (
    <div className="page-content flex flex-col gap-6 h-full overflow-auto p-4 md:p-6 bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800">Restaurant Dashboard</h1>
          <p className="text-slate-600 mt-1 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            {formatDate(new Date().toISOString())} • Real-time POS Data • Updated {formatTime(lastUpdated)}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-white rounded-lg border border-slate-200 p-1">
            {['today', 'week', 'month'].map((period) => (
              <button
                key={period}
                onClick={() => {
                  setTimeframe(period);
                  fetchDashboardData(period);
                }}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${timeframe === period
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-blue-600 hover:bg-slate-50'
                  }`}
              >
                {period.charAt(0).toUpperCase() + period.slice(1)}
              </button>
            ))}
          </div>

          <button
            onClick={() => fetchDashboardData(timeframe)}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium shadow-lg hover:shadow-xl"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, index) => (
          <div
            key={index}
            className={`bg-gradient-to-br ${card.color} rounded-xl p-5 text-white shadow-lg hover:shadow-xl transition-shadow duration-300`}
          >
            <div className="flex justify-between items-start mb-4">
              <div className={`p-3 rounded-xl ${card.iconBg} ${card.iconColor} bg-opacity-20 backdrop-blur-sm`}>
                {card.icon}
              </div>
              <span className="text-sm font-medium bg-white/20 px-2 py-1 rounded-full">
                {card.change}
              </span>
            </div>
            <p className="text-sm font-medium text-white/90 mb-1">{card.title}</p>
            <p className="text-2xl md:text-3xl font-bold mb-2">{card.value}</p>
            <div className="h-1.5 w-full bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full"
                style={{ width: `${Math.min(100, 70 + Math.random() * 30)}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        <div className="bg-white rounded-xl p-6 shadow-lg border border-slate-200">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-slate-800">Revenue Overview</h2>
              <p className="text-slate-600 text-sm">Daily revenue trends</p>
            </div>
            <BarChart3 className="w-8 h-8 text-blue-600" />
          </div>
          <div className="h-80">
            <RevenueChart data={dailySales} timeframe={timeframe} />
          </div>
        </div>

        {/* Sales Distribution */}
        <div className="bg-white rounded-xl p-6 shadow-lg border border-slate-200">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-slate-800">Sales by Category</h2>
              <p className="text-slate-600 text-sm">Product category distribution</p>
            </div>
            <PieChart className="w-8 h-8 text-purple-600" />
          </div>
          <div className="h-80">
            <SalesPieChart products={topProducts} />
          </div>
        </div>
      </div>

      {/* Bottom Grid - Recent Activity & Top Products */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <div className="lg:col-span-2 bg-white rounded-xl p-6 shadow-lg border border-slate-200">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-slate-800">Recent Orders</h2>
              <p className="text-slate-600 text-sm">Latest restaurant activities</p>
            </div>
            <Clock className="w-8 h-8 text-amber-600" />
          </div>

          <div className="space-y-4">
            {Array.isArray(recentActivity) && recentActivity.map((activity) => (
              <div
                key={activity._id || activity.orderNumber}
                className="flex items-center justify-between p-4 rounded-lg border border-slate-100 hover:border-blue-200 hover:bg-blue-50/50 transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-gradient-to-br from-blue-100 to-blue-50">
                    {getOrderTypeIcon(activity.type)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-800">{activity.orderNumber}</p>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(activity.status)}`}>
                        {activity.status}
                      </span>
                    </div>
                    <p className="text-slate-600 text-sm mt-1">{activity.customerName || 'Walk-in Customer'}</p>
                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                      <Clock className="w-3 h-3" />
                      {activity.createdAt ? `${formatDate(activity.createdAt)} at ${formatTime(activity.createdAt)}` : 'Recently'}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-lg font-bold text-emerald-600">
                    ${typeof activity.finalTotal === 'number' ? activity.finalTotal.toFixed(2) : '0.00'}
                  </p>
                  <p className="text-xs text-slate-500">{activity.type || 'Order'}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Products */}
        <div className="bg-white rounded-xl p-6 shadow-lg border border-slate-200">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-slate-800">Top Products</h2>
              <p className="text-slate-600 text-sm">Best selling items</p>
            </div>
            <TrendingUp className="w-8 h-8 text-emerald-600" />
          </div>

          <div className="space-y-4">
            {topProducts.map((product, index) => (
              <div
                key={product._id || product.name}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-gradient-to-br from-amber-100 to-amber-50 text-amber-600 font-bold">
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-medium text-slate-800">{product.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded-full">
                        {product.category || 'General'}
                      </span>
                      <span className="text-xs text-slate-500">
                        {product.totalQuantity || 0} sold
                      </span>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <p className="font-bold text-emerald-600">
                    ${typeof product.totalRevenue === 'number' ? product.totalRevenue.toFixed(2) : '0.00'}
                  </p>
                  <div className="w-32 h-2 bg-slate-100 rounded-full overflow-hidden mt-1">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full"
                      style={{ width: `${Math.min(100, (product.totalQuantity || 0) * 2)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-4 p-4 bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm text-slate-600">Last updated</p>
            <p className="font-medium text-slate-800">{formatTime(lastUpdated)}</p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-sm text-slate-600">
          <span className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
            <span>Live Data</span>
          </span>
          <span className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            <span>Cached Data</span>
          </span>
          <span className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-500"></div>
            <span>Pending</span>
          </span>
        </div>

        <div className="text-xs text-slate-500">
          Restaurant POS v2.0 • International Mode
        </div>
      </div>

      {/* Error Toast */}
      {error && (
        <div className="fixed bottom-6 right-6 max-w-md animate-slide-up">
          <div className="bg-gradient-to-r from-amber-50 to-amber-100 border border-amber-200 rounded-xl p-4 shadow-xl">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-amber-600 flex-shrink-0" />
              <div>
                <p className="font-medium text-amber-800">Data Sync Notice</p>
                <p className="text-sm text-amber-700 mt-1">{error}</p>
                <p className="text-xs text-amber-600 mt-2">Using cached data with fallback values</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;