// components/POS/POSInterface.js
import React, { useState, useEffect } from 'react';
import { useSocket } from '../../hooks/useSocket';
import { orderAPI } from '../../api/orders';
import { realApi } from '../../api/realApi';
import ProductGrid from './ProductGrid';
import OrderCart from './OrderCart';
import CustomerSearch from './CustomerSearch';

const POSInterface = () => {
  const [cart, setCart] = useState([]);
  const [customer, setCustomer] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [users, setUsers] = useState([]);
  const [orderType, setOrderType] = useState('dine-in');
  const [tableNumber, setTableNumber] = useState('');
  const [vatEnabled, setVatEnabled] = useState(false);
  const { socket } = useSocket();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [usersData, customersData] = await Promise.all([
          realApi.getUsers(),
          realApi.getCustomers()
        ]);
        setUsers(realApi.extractData(usersData) || []);
        setCustomers(realApi.extractData(customersData) || []);
      } catch (error) {
        console.error("Failed to fetch POS data:", error);
      }
    };
    fetchData();
  }, []);

  const addToCart = (product) => {
    setCart(prev => {
      const existing = prev.find(item => item.product._id === product._id);
      if (existing) {
        return prev.map(item =>
          item.product._id === product._id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1, price: product.price }];
    });
  };

  const removeFromCart = (productId) => {
    setCart(prev => prev.filter(item => item.product._id !== productId));
  };

  const updateQuantity = (productId, quantity) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart(prev =>
      prev.map(item =>
        item.product._id === productId ? { ...item, quantity } : item
      )
    );
  };

  const [vatEnabled, setVatEnabled] = useState(false);

  const calculateTotals = () => {
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const tax = vatEnabled ? subtotal * 0.05 : 0;
    const total = subtotal + tax;
    return { subtotal, tax, total };
  };

  const placeOrder = async () => {
    try {
      const orderData = {
        items: cart,
        orderType,
        tableNumber: orderType === 'dine-in' ? tableNumber : undefined,
        customer: customer?._id,
        ...calculateTotals()
      };

      const order = await orderAPI.createOrder(orderData);

      // Emit real-time update to kitchen
      socket.emit('new-order', order);

      // Clear cart and show success
      setCart([]);
      setCustomer(null);
      setTableNumber('');

      // Print receipt
      printReceipt(order);

    } catch (error) {
      console.error('Failed to place order:', error);
    }
  };

  const printReceipt = (order) => {
    // Implement receipt printing logic
    const receiptWindow = window.open('', '_blank');
    receiptWindow.document.write(`
      <html>
        <head><title>Receipt</title></head>
        <body>
          <div style="text-align: center; font-family: monospace;">
            <h2>${branch?.name}</h2>
            <p>Order #${order.orderNumber}</p>
            <hr>
            ${order.items.map(item => `
              <div>${item.product.name} x${item.quantity} - $${(item.price * item.quantity).toFixed(2)}</div>
            `).join('')}
            <hr>
            <div>Subtotal: $${order.subtotal.toFixed(2)}</div>
            <div>Tax: $${order.tax.toFixed(2)}</div>
            <div><strong>Total: $${order.total.toFixed(2)}</strong></div>
          </div>
        </body>
      </html>
    `);
    receiptWindow.print();
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Product Grid */}
      <div className="flex-1 p-4">
        <ProductGrid onAddToCart={addToCart} />
      </div>

      {/* Order Cart */}
      <div className="w-96 bg-white shadow-lg">
        <OrderCart
          cart={cart}
          onUpdateQuantity={updateQuantity}
          onRemoveItem={removeFromCart}
          totals={calculateTotals()}
          orderType={orderType}
          onOrderTypeChange={setOrderType}
          tableNumber={tableNumber}
          onTableNumberChange={setTableNumber}
          customer={customer}
          onPlaceOrder={placeOrder}
          vatEnabled={vatEnabled}
          setVatEnabled={setVatEnabled}
          onClearCart={() => setCart([])}
          users={users}
          customers={customers}
          onCustomerChange={setCustomer}
        />
        <CustomerSearch onCustomerSelect={setCustomer} />
      </div>
    </div>
  );
};

export default POSInterface;