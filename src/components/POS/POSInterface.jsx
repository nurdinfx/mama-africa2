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
    // Create a hidden iframe for printing if it doesn't exist
    let iframe = document.getElementById('receipt-frame');
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'receipt-frame';
      iframe.style.display = 'none';
      document.body.appendChild(iframe);
    }

    const doc = iframe.contentWindow.document;

    // Calculate totals if missing
    const subtotal = order.subtotal || order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const tax = order.tax || 0;
    const total = order.finalTotal || order.total || (subtotal + tax);

    doc.open();
    doc.write(`
      <html>
        <head>
          <title>Receipt</title>
          <style>
            body { font-family: 'Courier New', monospace; font-size: 12px; width: 80mm; margin: 0; padding: 10px; }
            .header { text-align: center; margin-bottom: 20px; }
            .divider { border-top: 1px dashed #000; margin: 10px 0; }
            .item-row { display: flex; justify-content: space-between; margin: 5px 0; }
            .total-row { display: flex; justify-content: space-between; font-weight: bold; margin-top: 10px; font-size: 14px; }
            .footer { text-align: center; margin-top: 20px; font-size: 10px; }
            @media print {
              @page { margin: 0; size: auto; }
              body { margin: 0.5cm; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h3>${order.branch?.name || 'MAMA AFRICA'}</h3>
            <p>${new Date().toLocaleString()}</p>
            <p>Order #${order.orderNumber}</p>
          </div>
          
          <div class="divider"></div>
          
          ${order.items.map(item => `
            <div class="item-row">
              <span>${item.product.name || item.productName || 'Item'} x${item.quantity}</span>
              <span>${(item.price * item.quantity).toFixed(2)}</span>
            </div>
          `).join('')}
          
          <div class="divider"></div>
          
          <div class="item-row">
            <span>Subtotal:</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>
          <div class="item-row">
            <span>Tax:</span>
            <span>${tax.toFixed(2)}</span>
          </div>
          
          <div class="total-row">
            <span>TOTAL:</span>
            <span>${total.toFixed(2)}</span>
          </div>
          
          <div class="footer">
            <p>Thank you for dining with us!</p>
          </div>
        </body>
      </html>
    `);
    doc.close();

    // Print after content is loaded
    setTimeout(() => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    }, 500);
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