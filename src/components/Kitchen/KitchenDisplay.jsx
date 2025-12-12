// components/Kitchen/KitchenDisplay.js
import React, { useState, useEffect } from 'react';
import { useSocket } from '../../hooks/useSocket';
import { orderAPI } from '../../api/orders';

const KitchenDisplay = () => {
  const [orders, setOrders] = useState([]);
  const { socket } = useSocket();

  useEffect(() => {
    // Load pending orders
    loadPendingOrders();
    
    // Listen for new orders
    socket.on('order-received', (newOrder) => {
      setOrders(prev => [newOrder, ...prev]);
      playNotificationSound();
    });

    return () => {
      socket.off('order-received');
    };
  }, []);

  const loadPendingOrders = async () => {
    try {
      const pendingOrders = await orderAPI.getKitchenOrders();
      setOrders(pendingOrders);
    } catch (error) {
      console.error('Failed to load orders:', error);
    }
  };

  const playNotificationSound = () => {
    const audio = new Audio('/sounds/order-notification.mp3');
    audio.play();
  };

  const updateOrderStatus = async (orderId, status) => {
    try {
      await orderAPI.updateOrderStatus(orderId, status);
      setOrders(prev => prev.filter(order => order._id !== orderId));
      socket.emit('order-status-update', { orderId, status });
    } catch (error) {
      console.error('Failed to update order:', error);
    }
  };

  const groupOrdersByStatus = (orders) => {
    return orders.reduce((groups, order) => {
      const status = order.status;
      if (!groups[status]) groups[status] = [];
      groups[status].push(order);
      return groups;
    }, {});
  };

  const orderGroups = groupOrdersByStatus(orders);

  return (
    <div className="p-6 bg-gray-900 text-white min-h-screen">
      <h1 className="text-3xl font-bold mb-6">Kitchen Display</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {['pending', 'preparing', 'ready'].map(status => (
          <div key={status} className="bg-gray-800 rounded-lg p-4">
            <h2 className="text-xl font-semibold mb-4 capitalize">
              {status} ({orderGroups[status]?.length || 0})
            </h2>
            
            <div className="space-y-4">
              {(orderGroups[status] || []).map(order => (
                <div key={order._id} className="bg-gray-700 p-4 rounded-lg">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold">Order #{order.orderNumber}</h3>
                    <span className="text-sm bg-blue-500 px-2 py-1 rounded">
                      {order.orderType}
                    </span>
                  </div>
                  
                  <div className="mb-3">
                    {order.items.map((item, index) => (
                      <div key={index} className="flex justify-between text-sm">
                        <span>{item.quantity}x {item.product.name}</span>
                        {item.notes && (
                          <span className="text-yellow-400">*{item.notes}</span>
                        )}
                      </div>
                    ))}
                  </div>
                  
                  {status === 'pending' && (
                    <button
                      onClick={() => updateOrderStatus(order._id, 'preparing')}
                      className="w-full bg-green-500 hover:bg-green-600 py-2 rounded"
                    >
                      Start Preparing
                    </button>
                  )}
                  
                  {status === 'preparing' && (
                    <button
                      onClick={() => updateOrderStatus(order._id, 'ready')}
                      className="w-full bg-blue-500 hover:bg-blue-600 py-2 rounded"
                    >
                      Mark Ready
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default KitchenDisplay;