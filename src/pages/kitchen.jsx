// src/pages/Kitchen.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { realApi } from '../api/realApi';
import { getCache, setCache } from '../services/offlineCache';
import { formatTime } from '../utils/date';

const Kitchen = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedStation, setSelectedStation] = useState('all');
  const [soundEnabled, setSoundEnabled] = useState(true);

  const { user } = useAuth();
  const { socket, emit, isConnected } = useSocket();

  useEffect(() => {
    const cached = getCache('kitchen-orders', []);
    if (Array.isArray(cached) && cached.length > 0) {
      setOrders(cached);
    }
    loadKitchenOrders();
    
    // Set up auto-refresh every 15 seconds
    const interval = setInterval(loadKitchenOrders, 15000);
    
    // Listen for real-time updates
    if (socket && isConnected) {
      const branchId = user?.branch?._id;
      if (branchId) {
        socket.emit('join-branch', branchId);
      }

      socket.on('new-order', (newOrder) => {
        if (!newOrder || (branchId && String(newOrder.branch) !== String(branchId))) return;
        if (soundEnabled) playSound('new-order');
        setOrders(prev => {
          const exists = prev.some(o => o._id === newOrder._id);
          return exists ? prev.map(o => o._id === newOrder._id ? newOrder : o) : [newOrder, ...prev];
        });
      });
      
      socket.on('order-status-updated', (updatedOrder) => {
        if (!updatedOrder || (branchId && String(updatedOrder.branch) !== String(branchId))) return;
        setOrders(prev => prev.map(o => o._id === updatedOrder._id ? updatedOrder : o));
      });

      socket.on('order-completed', (completedOrder) => {
        if (!completedOrder || (branchId && String(completedOrder.branch) !== String(branchId))) return;
        setOrders(prev => prev.map(o => o._id === completedOrder._id ? completedOrder : o));
      });
    }

    return () => {
      clearInterval(interval);
      if (socket) {
        socket.off('new-order');
        socket.off('order-status-updated');
        socket.off('order-completed');
      }
    };
  }, [socket, isConnected, soundEnabled]);

  const playSound = (type) => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      if (type === 'new-order') {
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);
      } else if (type === 'order-ready') {
        oscillator.frequency.setValueAtTime(1000, audioContext.currentTime);
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.1);
        oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.2);
      }
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch (error) {
      console.log('Web Audio API not supported');
    }
  };

  const loadKitchenOrders = async () => {
    try {
      setLoading(true);
      setError('');
      console.log('🔄 Loading kitchen orders from backend...');
      
      const response = await realApi.getKitchenOrders({
        kitchenStatus: 'all',
        limit: 100
      });

      console.log('📦 Kitchen orders API response:', response);

      if (response.success) {
        const ordersData = realApi.extractData(response) || [];
        const ordersArray = Array.isArray(ordersData) ? ordersData : 
                           (ordersData.orders && Array.isArray(ordersData.orders) ? ordersData.orders : []);
        
        console.log('✅ Kitchen orders loaded:', ordersArray.length);
        setOrders(ordersArray);
        setCache('kitchen-orders', ordersArray);
      } else {
        throw new Error(response.message || 'Failed to load kitchen orders');
      }
    } catch (error) {
      console.error('❌ Failed to load kitchen orders:', error);
      setError(error.message || 'Failed to load kitchen orders');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      const payload = { status: newStatus, kitchenStatus: newStatus };
      const response = await realApi.updateOrderStatus(orderId, payload);
      
      if (response.success) {
        const updated = response.data || { _id: orderId, status: newStatus, kitchenStatus: newStatus };
        setOrders(prev =>
          prev.map(order =>
            order._id === orderId ? { ...order, status: updated.status, kitchenStatus: updated.kitchenStatus, updatedAt: updated.updatedAt || new Date().toISOString() } : order
          )
        );
        
        if (isConnected && emit) {
          emit('order-status-updated', updated);
        }
        
        if (newStatus === 'ready' && soundEnabled) {
          playSound('order-ready');
        }
      } else {
        throw new Error(response.message || 'Failed to update order status');
      }
    } catch (error) {
      console.error('Failed to update order status:', error);
      alert(error.message || 'Failed to update order status');
    }
  };

  const getTimeElapsed = (createdAt) => {
    try {
      const diff = Date.now() - new Date(createdAt).getTime();
      const minutes = Math.floor(diff / 60000);
      const hours = Math.floor(minutes / 60);
      
      if (hours > 0) {
        return `${hours}h ${minutes % 60}m`;
      }
      return `${minutes}m`;
    } catch (error) {
      return '0m';
    }
  };

  const getUrgencyColor = (createdAt) => {
    const diff = Date.now() - new Date(createdAt).getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes > 30) return 'border-red-500 bg-red-50';
    if (minutes > 15) return 'border-orange-500 bg-orange-50';
    return 'border-gray-300';
  };

  const getCookingTime = (createdAt) => {
    const diff = Date.now() - new Date(createdAt).getTime();
    const minutes = Math.floor(diff / 60000);
    return `${minutes} min`;
  };

  // Group orders by status
  const pendingOrders = Array.isArray(orders) ? orders.filter(order => order.status === 'pending' || order.status === 'confirmed') : [];
  const preparingOrders = Array.isArray(orders) ? orders.filter(order => order.status === 'preparing') : [];
  const readyOrders = Array.isArray(orders) ? orders.filter(order => order.status === 'ready') : [];

  // Filter by station
  const filteredPendingOrders = selectedStation === 'all' ? pendingOrders : 
    pendingOrders.filter(order => !order.station || order.station === selectedStation);
  const filteredPreparingOrders = selectedStation === 'all' ? preparingOrders : 
    preparingOrders.filter(order => !order.station || order.station === selectedStation);

  

  return (
    <div className="min-h-screen bg-gray-900 text-gray-900">
      {/* Header */}
      <div className="bg-white shadow-lg border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-6">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">KITCHEN DISPLAY</h1>
                <p className="text-gray-600 text-sm">Real-time Order Management System</p>
              </div>
              
              {/* Station Filter */}
              <div className="flex items-center space-x-3">
                <span className="text-sm font-medium text-gray-700">Station:</span>
                <select 
                  value={selectedStation}
                  onChange={(e) => setSelectedStation(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-1 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                >
                  <option value="all">All Stations</option>
                  <option value="grill">Grill Station</option>
                  <option value="fry">Fry Station</option>
                  <option value="salad">Salad Station</option>
                  <option value="pizza">Pizza Station</option>
                  <option value="dessert">Dessert Station</option>
                </select>
              </div>
            </div>
            
            <div className="flex items-center space-x-6">
              {/* Sound Toggle */}
              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={`flex items-center space-x-2 px-3 py-1 rounded-lg text-sm ${
                  soundEnabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                }`}
              >
                <span>{soundEnabled ? '🔊' : '🔇'}</span>
                <span>Sound {soundEnabled ? 'On' : 'Off'}</span>
              </button>
              
              <div className="text-right">
                <p className="text-lg font-semibold text-gray-900">Chef: {user?.name || 'Kitchen Staff'}</p>
                <p className="text-gray-600 text-sm">{formatTime(new Date().toISOString())}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Stats Overview */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{pendingOrders.length}</div>
            <div className="text-sm text-gray-600">New Orders</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 text-center">
            <div className="text-2xl font-bold text-orange-600">{preparingOrders.length}</div>
            <div className="text-sm text-gray-600">In Progress</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{readyOrders.length}</div>
            <div className="text-sm text-gray-600">Ready</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 text-center">
            <div className="text-2xl font-bold text-gray-600">{orders.length}</div>
            <div className="text-sm text-gray-600">Total Active</div>
          </div>
        </div>

        {/* Orders Grid */}
        <div className="grid grid-cols-2 gap-6">
          {/* New Orders Column */}
          <div className="space-y-4">
            <div className="bg-white rounded-lg shadow-sm border border-blue-200">
              <div className="bg-blue-600 text-white px-4 py-3 rounded-t-lg">
                <h2 className="text-xl font-bold flex items-center justify-between">
                  <span>NEW ORDERS</span>
                  <span className="bg-blue-800 px-3 py-1 rounded-full text-sm">
                    {filteredPendingOrders.length}
                  </span>
                </h2>
              </div>
              <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
                {filteredPendingOrders.map(order => (
                  <OrderCard
                    key={order._id}
                    order={order}
                    onStatusUpdate={updateOrderStatus}
                    getTimeElapsed={getTimeElapsed}
                    getUrgencyColor={getUrgencyColor}
                    getCookingTime={getCookingTime}
                    nextStatus="preparing"
                    buttonText="START COOKING"
                    buttonColor="bg-orange-500 hover:bg-orange-600"
                    status="new"
                  />
                ))}
                
                {filteredPendingOrders.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <div className="text-4xl mb-2">📋</div>
                    <p className="text-lg font-medium">No New Orders</p>
                    <p className="text-sm">New orders will appear here automatically</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* In Progress & Ready Columns */}
          <div className="space-y-4">
            {/* In Progress */}
            <div className="bg-white rounded-lg shadow-sm border border-orange-200">
              <div className="bg-orange-600 text-white px-4 py-3 rounded-t-lg">
                <h2 className="text-xl font-bold flex items-center justify-between">
                  <span>IN PROGRESS</span>
                  <span className="bg-orange-800 px-3 py-1 rounded-full text-sm">
                    {filteredPreparingOrders.length}
                  </span>
                </h2>
              </div>
              <div className="p-4 space-y-3 max-h-[35vh] overflow-y-auto">
                {filteredPreparingOrders.map(order => (
                  <OrderCard
                    key={order._id}
                    order={order}
                    onStatusUpdate={updateOrderStatus}
                    getTimeElapsed={getTimeElapsed}
                    getUrgencyColor={getUrgencyColor}
                    getCookingTime={getCookingTime}
                    nextStatus="ready"
                    buttonText="MARK READY"
                    buttonColor="bg-green-500 hover:bg-green-600"
                    status="preparing"
                  />
                ))}
                
                {filteredPreparingOrders.length === 0 && (
                  <div className="text-center py-4 text-gray-500">
                    <p className="text-sm">No orders in progress</p>
                  </div>
                )}
              </div>
            </div>

            {/* Ready for Pickup */}
            <div className="bg-white rounded-lg shadow-sm border border-green-200">
              <div className="bg-green-600 text-white px-4 py-3 rounded-t-lg">
                <h2 className="text-xl font-bold flex items-center justify-between">
                  <span>READY FOR PICKUP</span>
                  <span className="bg-green-800 px-3 py-1 rounded-full text-sm">
                    {readyOrders.length}
                  </span>
                </h2>
              </div>
              <div className="p-4 space-y-3 max-h-[35vh] overflow-y-auto">
                {readyOrders.map(order => (
                  <OrderCard
                    key={order._id}
                    order={order}
                    onStatusUpdate={updateOrderStatus}
                    getTimeElapsed={getTimeElapsed}
                    getUrgencyColor={getUrgencyColor}
                    getCookingTime={getCookingTime}
                    showReady={true}
                    status="ready"
                  />
                ))}
                
                {readyOrders.length === 0 && (
                  <div className="text-center py-4 text-gray-500">
                    <p className="text-sm">No orders ready</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Professional Order Card Component
const OrderCard = ({ 
  order, 
  onStatusUpdate, 
  getTimeElapsed, 
  getUrgencyColor, 
  getCookingTime,
  nextStatus,
  buttonText,
  buttonColor,
  showReady = false,
  status 
}) => {
  const [flashing, setFlashing] = useState(status === 'new');

  useEffect(() => {
    if (status === 'new') {
      const timer = setTimeout(() => setFlashing(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  return (
    <div className={`bg-white rounded-lg border-2 p-4 transition-all duration-300 ${
      flashing ? 'animate-pulse border-blue-400 bg-blue-50' : getUrgencyColor(order.createdAt)
    }`}>
      {/* Order Header */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center space-x-3">
          <div className="bg-gray-900 text-white px-3 py-1 rounded-lg">
            <span className="font-mono font-bold text-sm">#{order.orderNumber || order._id?.slice(-6).toUpperCase()}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-gray-500">Order Time</span>
            <span className="text-sm font-semibold">{getTimeElapsed(order.createdAt)}</span>
          </div>
        </div>
        
        <div className="text-right">
          <div className={`inline-block px-2 py-1 rounded text-xs font-bold ${
            order.orderType === 'dine-in' ? 'bg-purple-100 text-purple-800' :
            order.orderType === 'takeaway' ? 'bg-orange-100 text-orange-800' :
            'bg-teal-100 text-teal-800'
          }`}>
            {order.orderType?.toUpperCase() || 'DINE-IN'}
          </div>
          {order.tableNumber && (
            <div className="mt-1 bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-bold">
              TABLE {order.tableNumber}
            </div>
          )}
        </div>
      </div>
      
      {/* Customer Info */}
      <div className="mb-3 p-2 bg-gray-50 rounded">
        <p className="text-sm font-medium">
          👤 {order.customer?.name || order.customerName || 'Walk-in Customer'}
        </p>
        {order.customer?.phone && (
          <p className="text-xs text-gray-600 mt-1">📞 {order.customer.phone}</p>
        )}
      </div>
      
      {/* Order Items */}
      <div className="space-y-2 mb-4">
        {Array.isArray(order.items) && order.items.map((item, index) => (
          <div key={index} className="flex justify-between items-start py-1 border-b border-gray-100 last:border-b-0">
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <span className="font-bold text-gray-900 w-6 text-center bg-gray-200 rounded">
                  {item.quantity}
                </span>
                <span className="font-medium text-sm flex-1">
                  {item.product?.name || item.name || `Item ${index + 1}`}
                </span>
              </div>
              {item.notes && (
                <div className="ml-8 mt-1">
                  <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">Note: {item.notes}</span>
                </div>
              )}
              {item.modifiers && item.modifiers.length > 0 && (
                <div className="ml-8 mt-1">
                  {item.modifiers.map((modifier, modIndex) => (
                    <span key={modIndex} className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded mr-1">
                      {modifier}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        
        {(!order.items || !Array.isArray(order.items) || order.items.length === 0) && (
          <p className="text-gray-400 text-sm text-center py-2">No items in this order</p>
        )}
      </div>
      
      {/* Cooking Time & Actions */}
      <div className="flex justify-between items-center pt-2 border-t border-gray-200">
        {status === 'preparing' && (
          <div className="text-sm font-medium text-orange-600">
            ⏱️ Cooking: {getCookingTime(order.updatedAt || order.createdAt)}
          </div>
        )}
        
        {!showReady && (
          <button
            onClick={() => onStatusUpdate(order._id, nextStatus)}
            className={`${buttonColor} text-white py-2 px-4 rounded-lg font-bold text-sm transition-all hover:scale-105 active:scale-95`}
          >
            {buttonText}
          </button>
        )}
        
        {showReady && (
          <div className="flex-1 text-center">
            <div className="bg-green-500 text-white py-2 px-4 rounded-lg font-bold animate-pulse">
              ✅ READY FOR SERVING
            </div>
            <p className="text-xs text-gray-600 mt-1">Waiting for pickup</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Kitchen;
