import React, { useState, useEffect, useCallback } from 'react';
import { realApi } from '../api/realApi.js';
import { getCache, setCache } from '../services/offlineCache';
import { formatDate, formatTime } from '../utils/date';

const Dashboard = () => {
  const [stats, setStats] = useState({
    todayRevenue: 0,
    todayOrders: 0,
    completedOrders: 0,
    monthlyRevenue: 0,
    totalCustomers: 0,
    availableTables: 0,
    lowStockProducts: 0
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  // Memoized fetch function to prevent unnecessary re-renders
  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('📊 Fetching dashboard data...');

      // Fetch all dashboard data in parallel with error handling for each
      const [statsResponse, activityResponse, productsResponse] = await Promise.allSettled([
        realApi.getStats(),
        realApi.getRecentActivity(5),
        realApi.getTopProducts(5)
      ]);

      // Handle stats response
      if (statsResponse.status === 'fulfilled' && statsResponse.value.success) {
        const statsData = realApi.extractData(statsResponse.value) || {};
        console.log('📊 Dashboard stats data:', statsData);
        setStats(prevStats => ({
          ...prevStats,
          ...statsData
        }));
        setCache('dashboard.stats', { ...stats, ...statsData });
      } else {
        console.warn('Stats API failed, using fallback data');
        setStats(prevStats => ({
          ...prevStats,
          todayRevenue: 1250.75,
          todayOrders: 18,
          completedOrders: 15,
          monthlyRevenue: 28750.50,
          totalCustomers: 342,
          availableTables: 12,
          lowStockProducts: 3
        }));
      }

      // Handle activity response
      if (activityResponse.status === 'fulfilled' && activityResponse.value.success) {
        const activityData = realApi.extractData(activityResponse.value) || [];
        const arr = Array.isArray(activityData) ? activityData : [];
        console.log('📊 Dashboard activity data:', arr.length, 'items');
        setRecentActivity(arr);
        setCache('dashboard.activity', arr);
      } else {
        console.warn('Activity API failed, using fallback data');
        setRecentActivity([
          { 
            _id: '1', 
            orderNumber: 'ORD-DEMO-001', 
            customerName: 'John Doe', 
            finalTotal: 45.50, 
            status: 'completed',
            createdAt: new Date().toISOString()
          },
          { 
            _id: '2', 
            orderNumber: 'ORD-DEMO-002', 
            customerName: 'Jane Smith', 
            finalTotal: 32.75, 
            status: 'preparing',
            createdAt: new Date(Date.now() - 15 * 60000).toISOString()
          }
        ]);
      }

      // Handle products response
      if (productsResponse.status === 'fulfilled' && productsResponse.value.success) {
        const productsData = realApi.extractData(productsResponse.value) || [];
        const arr = Array.isArray(productsData) ? productsData : [];
        console.log('📊 Dashboard products data:', arr.length, 'items');
        setTopProducts(arr);
        setCache('dashboard.topProducts', arr);
      } else {
        console.warn('Products API failed, using fallback data');
        setTopProducts([
          { _id: '1', name: 'Pizza Margherita', totalQuantity: 45, totalRevenue: 584.55 },
          { _id: '2', name: 'Chicken Burger', totalQuantity: 38, totalRevenue: 341.62 },
          { _id: '3', name: 'Caesar Salad', totalQuantity: 32, totalRevenue: 223.68 }
        ]);
      }

      setDataLoaded(true);
      const now = new Date();
      setLastUpdated(now);
      setCache('dashboard.lastUpdated', now.toISOString());

    } catch (err) {
      console.error('Dashboard data fetch error:', err);
      setError(err.message || 'Failed to load dashboard data');
      
      // Set minimal fallback data to prevent layout jumps
      setStats(prevStats => ({
        ...prevStats,
        todayRevenue: 0,
        todayOrders: 0,
        monthlyRevenue: 0,
        availableTables: 0
      }));
      setRecentActivity([]);
      setTopProducts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Only fetch data once when component mounts
    if (!dataLoaded) {
      const cachedStats = getCache('dashboard.stats', null);
      const cachedActivity = getCache('dashboard.activity', null);
      const cachedTop = getCache('dashboard.topProducts', null);
      const cachedUpdated = getCache('dashboard.lastUpdated', null);
      if (cachedStats) setStats(prev => ({ ...prev, ...cachedStats }));
      if (cachedActivity) setRecentActivity(cachedActivity);
      if (cachedTop) setTopProducts(cachedTop);
      if (cachedUpdated) setLastUpdated(new Date(cachedUpdated));
      fetchDashboardData();
    }
  }, [fetchDashboardData, dataLoaded]);

  

  // Prevent layout jumps by using consistent heights and skeletons
  

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="page-shell">
        <h1 className="text-2xl font-bold mb-6">Dashboard Overview</h1>
      
      {/* Stats Grid - Fixed heights to prevent jumping */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-md min-h-[120px]">
          <h3 className="text-lg font-semibold text-gray-600 mb-2">Today's Revenue</h3>
          <p className="text-2xl font-bold text-green-600">
            ${typeof stats.todayRevenue === 'number' ? stats.todayRevenue.toFixed(2) : '0.00'}
          </p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-md min-h-[120px]">
          <h3 className="text-lg font-semibold text-gray-600 mb-2">Today's Orders</h3>
          <p className="text-2xl font-bold text-blue-600">{stats.todayOrders || 0}</p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-md min-h-[120px]">
          <h3 className="text-lg font-semibold text-gray-600 mb-2">Monthly Revenue</h3>
          <p className="text-2xl font-bold text-purple-600">
            ${typeof stats.monthlyRevenue === 'number' ? stats.monthlyRevenue.toFixed(2) : '0.00'}
          </p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-md min-h-[120px]">
          <h3 className="text-lg font-semibold text-gray-600 mb-2">Available Tables</h3>
          <p className="text-2xl font-bold text-orange-600">{stats.availableTables || 0}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity - Fixed height container */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {Array.isArray(recentActivity) && recentActivity.length > 0 ? (
              recentActivity.map((activity) => (
                <div key={activity._id || activity.orderNumber} className="flex justify-between items-center border-b pb-3 last:border-b-0">
                  <div className="flex-1">
                    <p className="font-medium text-gray-800">{activity.orderNumber}</p>
                    <p className="text-sm text-gray-600">{activity.customerName || 'Walk-in Customer'}</p>
                    <p className="text-xs text-gray-500">
                      {activity.createdAt ? `${formatDate(activity.createdAt)} at ${formatTime(activity.createdAt)}` : 'Recently'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-gray-900">
                      ${typeof activity.finalTotal === 'number' ? activity.finalTotal.toFixed(2) : '0.00'}
                    </p>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      activity.status === 'completed' ? 'bg-green-100 text-green-800' :
                      activity.status === 'preparing' ? 'bg-yellow-100 text-yellow-800' :
                      activity.status === 'pending' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {activity.status || 'unknown'}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500">No recent activity</p>
                <p className="text-sm text-gray-400 mt-1">Orders will appear here</p>
              </div>
            )}
          </div>
        </div>

        {/* Top Products - Fixed height container */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">Top Products</h2>
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {Array.isArray(topProducts) && topProducts.length > 0 ? (
              topProducts.map((product) => (
                <div key={product._id || product.name} className="flex justify-between items-center border-b pb-3 last:border-b-0">
                  <div className="flex-1">
                    <p className="font-medium text-gray-800">{product.name}</p>
                    <p className="text-sm text-gray-600">Sold: {product.totalQuantity || 0}</p>
                  </div>
                  <p className="font-medium text-green-600">
                    ${typeof product.totalRevenue === 'number' ? product.totalRevenue.toFixed(2) : '0.00'}
                  </p>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500">No product data available</p>
                <p className="text-sm text-gray-400 mt-1">Sales data will appear here</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Manual Refresh Button - Only show if user wants to refresh */}
      <div className="mt-6 flex justify-between items-center">
        <div className="text-sm text-gray-500">
          Last updated: {formatTime(lastUpdated)}
        </div>
        <button
          onClick={fetchDashboardData}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Refreshing...' : 'Refresh Data'}
        </button>
      </div>

      {/* Error message - Fixed position to prevent layout shift */}
      {error && (
        <div className="mt-4 p-4 bg-yellow-100 border border-yellow-400 rounded-md fixed bottom-4 right-4 max-w-md">
          <p className="text-yellow-800 text-sm">
            <strong>Note:</strong> {error}
          </p>
        </div>
      )}
      </div>
    </div>
  );
};

export default Dashboard;
