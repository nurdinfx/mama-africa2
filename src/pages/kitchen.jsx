// src/pages/Kitchen.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { realApi } from '../api/realApi';
import { getCache, setCache } from '../services/offlineCache';
import { formatTime } from '../utils/date';

const Kitchen = ({ isPosMode = false }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedStation, setSelectedStation] = useState('all');
  const [soundEnabled, setSoundEnabled] = useState(true);

  const { user } = useAuth();
  const { socket, emit, isConnected } = useSocket();

  useEffect(() => {
    // ... (existing useEffect logic)
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

  // ... (keep helper functions like playSound, etc. - I'm using the existing ones implicitly by not replacing them if I use replacement correctly, but since I am replacing the top part, I need to look out)
  // Wait, I am replacing lines 9 to 250! I must include all the helper functions I am replacing!
  // This approach is risky if I don't paste the helpers.
  // I will check lines 66-198. They are helpers.
  // I should only replace the 'return' block OR just the component definition line and the return block.
  // Splitting into two edits is better.
  // Edit 1: Component definition.
  // Edit 2: Return block.


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
  const pendingOrders = Array.isArray(orders) ? orders.filter(order => ['pending', 'confirmed', 'delayed'].includes(order.kitchenStatus || order.status)) : [];
  const preparingOrders = Array.isArray(orders) ? orders.filter(order => (order.kitchenStatus || order.status) === 'preparing') : [];
  const readyOrders = Array.isArray(orders) ? orders.filter(order => (order.kitchenStatus || order.status) === 'ready') : [];

  // Filter by station
  const filteredPendingOrders = selectedStation === 'all' ? pendingOrders :
    pendingOrders.filter(order => !order.station || order.station === selectedStation);
  const filteredPreparingOrders = selectedStation === 'all' ? preparingOrders :
    preparingOrders.filter(order => !order.station || order.station === selectedStation);


  return (
    <div className="page-content flex flex-col gap-6">
      {/* Header Toolbar */}
      {!isPosMode && (
        <div className="card flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <h1 className="heading-2 text-slate-900">Kitchen Display</h1>
            <select
              value={selectedStation}
              onChange={(e) => setSelectedStation(e.target.value)}
              className="px-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            >
              <option value="all">All Stations</option>
              <option value="grill">Grill Station</option>
              <option value="fry">Fry Station</option>
              <option value="salad">Salad Station</option>
              <option value="pizza">Pizza Station</option>
              <option value="dessert">Dessert Station</option>
            </select>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${soundEnabled ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-slate-100 text-slate-600 border border-slate-200'
                }`}
            >
              <span>{soundEnabled ? '🔊' : '🔇'}</span>
              <span>Sound {soundEnabled ? 'On' : 'Off'}</span>
            </button>
            <span className="text-sm text-slate-600 font-medium">
              Chef: {user?.name || 'Kitchen Staff'}
            </span>
          </div>
        </div>
      )}

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card border-l-4 border-l-blue-500">
          <div className="text-3xl font-bold text-blue-600 mb-1">{pendingOrders.length}</div>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Pending</div>
        </div>
        <div className="card border-l-4 border-l-orange-500">
          <div className="text-3xl font-bold text-orange-600 mb-1">{preparingOrders.length}</div>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Cooking</div>
        </div>
        <div className="card border-l-4 border-l-emerald-500">
          <div className="text-3xl font-bold text-emerald-600 mb-1">{readyOrders.length}</div>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Ready</div>
        </div>
        <div className="card border-l-4 border-l-slate-500">
          <div className="text-3xl font-bold text-slate-600 mb-1">{orders.length}</div>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Total</div>
        </div>
      </div>

      {/* Orders Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* New Orders Column */}
        <div className="flex flex-col">
          <div className="card border-t-4 border-t-blue-500 overflow-hidden p-0 flex flex-col h-full">
            <div className="bg-blue-50 px-5 py-3 border-b border-blue-100">
              <h2 className="heading-3 text-blue-800 flex items-center justify-between">
                <span>NEW ORDERS</span>
                <span className="bg-blue-200 text-blue-800 px-2 py-1 rounded-full text-xs font-bold">
                  {filteredPendingOrders.length}
                </span>
              </h2>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
              {filteredPendingOrders.map(order => (
                <OrderCard
                  key={order._id}
                  order={order}
                  onStatusUpdate={updateOrderStatus}
                  getTimeElapsed={getTimeElapsed}
                  getUrgencyColor={getUrgencyColor}
                  getCookingTime={getCookingTime}
                  nextStatus="preparing"
                  buttonText="START"
                  buttonColor="bg-blue-600 hover:bg-blue-700"
                  status={order.kitchenStatus || order.status}
                />
              ))}
              {filteredPendingOrders.length === 0 && (
                <div className="text-center py-10 text-slate-400">
                  <p>No new orders</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* In Progress Column */}
        <div className="flex flex-col">
          <div className="card border-t-4 border-t-orange-500 overflow-hidden p-0 flex flex-col h-full">
            <div className="bg-orange-50 px-5 py-3 border-b border-orange-100">
              <h2 className="heading-3 text-orange-800 flex items-center justify-between">
                <span>COOKING</span>
                <span className="bg-orange-200 text-orange-800 px-2 py-1 rounded-full text-xs font-bold">
                  {filteredPreparingOrders.length}
                </span>
              </h2>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
              {filteredPreparingOrders.map(order => (
                <OrderCard
                  key={order._id}
                  order={order}
                  onStatusUpdate={updateOrderStatus}
                  getTimeElapsed={getTimeElapsed}
                  getUrgencyColor={getUrgencyColor}
                  getCookingTime={getCookingTime}
                  nextStatus="ready"
                  buttonText="READY"
                  buttonColor="bg-emerald-600 hover:bg-emerald-700"
                  status="preparing"
                />
              ))}
              {filteredPreparingOrders.length === 0 && (
                <div className="text-center py-10 text-slate-400">
                  <p>Nothing cooking</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Ready Column */}
        <div className="flex flex-col">
          <div className="card border-t-4 border-t-emerald-500 overflow-hidden p-0 flex flex-col h-full">
            <div className="bg-emerald-50 px-5 py-3 border-b border-emerald-100">
              <h2 className="heading-3 text-emerald-800 flex items-center justify-between">
                <span>READY</span>
                <span className="bg-emerald-200 text-emerald-800 px-2 py-1 rounded-full text-xs font-bold">
                  {readyOrders.length}
                </span>
              </h2>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
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
                <div className="text-center py-10 text-slate-400">
                  <p>No orders ready</p>
                </div>
              )}
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
  const [flashing, setFlashing] = useState(status === 'pending' || status === 'new');

  // Calculate Prep Time
  const prepTimeMin = 5 + (order.items?.length || 0) * 2;
  const prepTimeMax = prepTimeMin + 5;

  useEffect(() => {
    if (status === 'pending') {
      const timer = setTimeout(() => setFlashing(false), 10000); // Flash for 10s
      return () => clearTimeout(timer);
    }
  }, [status]);

  return (
    <div className={`bg-white rounded-lg border shadow-sm transition-all duration-300 flex flex-col ${status === 'delayed' ? 'border-amber-400 bg-amber-50 ring-2 ring-amber-200' :
      flashing ? 'animate-pulse ring-2 ring-blue-400' : 'border-slate-200 hover:shadow-md'
      }`}>

      {/* 1. Header: Table, Timer */}
      <div className="p-3 border-b border-slate-100 flex justify-between items-start bg-slate-50/50 rounded-t-lg">
        <div>
          <div className="flex items-center space-x-2 mb-1">
            <span className="text-xs font-bold text-slate-500">#{order.orderNumber?.slice(-4) || '----'}</span>
            {order.tableNumber && <span className="px-2 py-0.5 bg-slate-800 text-white text-xs font-bold rounded">TBL {order.tableNumber}</span>}
            {!order.tableNumber && <span className="px-2 py-0.5 bg-slate-200 text-slate-700 text-xs font-bold rounded">WALK-IN</span>}
          </div>
          <div className="text-[10px] text-slate-400 font-medium">
            {formatTime(order.createdAt)} ({getTimeElapsed(order.createdAt)})
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs font-bold text-slate-500 mb-1">⏱️ Prep: {prepTimeMin}-{prepTimeMax}m</div>
          {status === 'delayed' && <span className="px-2 py-0.5 bg-amber-500 text-white text-[10px] font-bold rounded animate-pulse">DELAYED</span>}
        </div>
      </div>

      {/* 2. Items List */}
      <div className="p-3 space-y-2 flex-1">
        {Array.isArray(order.items) && order.items.map((item, index) => (
          <div key={index} className="flex items-start text-sm">
            <span className="font-bold text-slate-700 w-6 text-right mr-2">{item.quantity}x</span>
            <div className="flex-1">
              <div className="font-bold text-slate-800 leading-tight">{item.product?.name || item.name}</div>
              {/* Modifiers */}
              {(item.modifiers || []).length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {item.modifiers.map((mod, i) => (
                    <span key={i} className="text-[10px] bg-red-100 text-red-700 px-1 rounded font-bold uppercase tracking-wider">{mod}</span>
                  ))}
                </div>
              )}
              {/* Notes */}
              {item.notes && (
                <div className="mt-1 text-xs text-orange-600 italic bg-orange-50 p-1 rounded border border-orange-100">
                  "{item.notes}"
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 3. Actions */}
      <div className="p-2 border-t border-slate-100 bg-slate-50 rounded-b-lg grid grid-cols-2 gap-2">
        {!showReady && (
          <>
            {status === 'delayed' ? (
              <button
                onClick={() => onStatusUpdate(order._id, 'preparing')}
                className="col-span-2 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded font-bold text-xs"
              >
                RESUME
              </button>
            ) : (
              <>
                <button
                  onClick={() => onStatusUpdate(order._id, 'delayed')}
                  className="bg-amber-100 hover:bg-amber-200 text-amber-700 py-2 rounded font-bold text-xs border border-amber-200"
                >
                  DELAY
                </button>
                <button
                  onClick={() => onStatusUpdate(order._id, nextStatus)}
                  className={`${buttonColor} text-white py-2 rounded font-bold text-xs shadow-sm`}
                >
                  {buttonText}
                </button>
              </>
            )}
          </>
        )}

        {showReady && (
          <button
            onClick={() => onStatusUpdate(order._id, 'served')} // or completed
            className="col-span-2 bg-slate-200 hover:bg-slate-300 text-slate-700 py-2 rounded font-bold text-xs"
          >
            MARK SERVED
          </button>
        )}
      </div>
    </div>
  );
};

export default Kitchen;
