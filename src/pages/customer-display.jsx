import React, { useState, useEffect } from 'react';
import { ShoppingCart, CreditCard } from 'lucide-react';

const CustomerDisplay = () => {
    const [cart, setCart] = useState([]);
    const [totals, setTotals] = useState({
        subtotal: 0,
        tax: 0,
        total: 0
    });
    const [customer, setCustomer] = useState(null);
    const [lastUpdated, setLastUpdated] = useState(new Date());

    useEffect(() => {
        const channel = new BroadcastChannel('pos_customer_display');

        channel.onmessage = (event) => {
            if (event.data.type === 'UPDATE_CART') {
                const { cart, totals, customer } = event.data.payload;
                setCart(cart || []);
                setTotals(totals || { subtotal: 0, tax: 0, total: 0 });
                setCustomer(customer);
                setLastUpdated(new Date());
            } else if (event.data.type === 'CLEAR_CART') {
                setCart([]);
                setTotals({ subtotal: 0, tax: 0, total: 0 });
                setCustomer(null);
            }
        };

        // Signal that the display is ready
        channel.postMessage({ type: 'DISPLAY_READY' });

        return () => {
            channel.close();
        };
    }, []);

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount);
    };

    if (cart.length === 0) {
        return (
            <div className="h-screen w-screen bg-slate-900 flex flex-col items-center justify-center text-white overflow-hidden relative">
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-10" style={{
                    backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
                    backgroundSize: '40px 40px'
                }}></div>

                {/* Decorative Blobs */}
                <div className="absolute top-0 left-0 w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
                <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
                <div className="absolute -bottom-32 left-20 w-96 h-96 bg-emerald-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>

                <div className="z-10 text-center space-y-8 animate-fade-in relative max-w-4xl p-8">
                    <div className="bg-white/5 backdrop-blur-xl p-16 rounded-[3rem] border border-white/10 shadow-2xl">
                        <h1 className="text-7xl font-bold mb-6 tracking-tight bg-gradient-to-r from-blue-400 to-emerald-400 text-transparent bg-clip-text">
                            Mama Africa
                        </h1>
                        <p className="text-3xl text-gray-300 font-light tracking-widest uppercase mb-8">Premium Dining Experience</p>
                        <div className="h-1 w-32 bg-gradient-to-r from-blue-500 to-emerald-500 mx-auto rounded-full"></div>
                    </div>
                </div>

                <div className="absolute bottom-12 text-gray-500 font-light tracking-widest text-sm">
                    POWERED BY HUDI POS SYSTEM
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen w-screen bg-slate-50 flex overflow-hidden font-sans">
            {/* Left: Cart Items - 65% width */}
            <div className="w-[65%] flex flex-col z-10 bg-white shadow-[10px_0_30px_-5px_rgba(0,0,0,0.1)]">
                <div className="h-28 bg-white flex items-center px-10 border-b border-gray-100 flex-shrink-0">
                    <div>
                        <h1 className="text-4xl font-extrabold text-slate-800 tracking-tight">Your Order</h1>
                        <p className="text-gray-400 mt-1">Review your items below</p>
                    </div>
                    <span className="ml-auto bg-slate-100 text-slate-600 px-5 py-2 rounded-full text-lg font-bold">
                        {cart.reduce((sum, item) => sum + item.quantity, 0)} Items
                    </span>
                </div>

                <div className="flex-1 overflow-y-auto p-8 space-y-4">
                    {cart.map((item, index) => (
                        <div key={`${item._id}-${index}`} className="flex items-center p-6 bg-white rounded-2xl border border-gray-100 shadow-sm transition-all animate-slide-in-right hover:shadow-md hover:border-blue-100">
                            {item.image ? (
                                <img
                                    src={item.image}
                                    alt={item.name}
                                    className="w-24 h-24 rounded-xl object-cover shadow-sm mr-8 bg-gray-50"
                                    onError={(e) => { e.target.style.display = 'none'; }}
                                />
                            ) : (
                                <div className="w-24 h-24 rounded-xl bg-slate-100 flex items-center justify-center mr-8 text-slate-300">
                                    <span className="text-xs">No Img</span>
                                </div>
                            )}
                            <div className="flex-1">
                                <h3 className="text-3xl font-bold text-slate-800 mb-2">{item.name}</h3>
                                {item.quantity > 1 && (
                                    <div className="inline-flex items-center bg-blue-50 text-blue-700 px-3 py-1 rounded-lg text-sm font-bold">
                                        {item.quantity} x {formatCurrency(item.price)}
                                    </div>
                                )}
                            </div>
                            <div className="text-3xl font-bold text-slate-700">
                                {formatCurrency(item.price * item.quantity)}
                            </div>
                        </div>
                    ))}
                    <div ref={(el) => el?.scrollIntoView({ behavior: 'smooth' })} />
                </div>
            </div>

            {/* Right: Totals - 35% width */}
            <div className="w-[35%] bg-slate-900 text-white flex flex-col relative overflow-hidden">
                {/* Dynamic Background */}
                <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 z-0"></div>
                <div className="absolute top-0 right-0 w-full h-full opacity-30 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>

                {/* Content */}
                <div className="relative z-10 flex flex-col h-full p-10">
                    <header className="text-center border-b border-white/10 pb-8 mb-8">
                        <div className="inline-block bg-white/10 px-6 py-2 rounded-full backdrop-blur-md mb-4">
                            <span className="text-sm font-bold tracking-widest text-blue-200">CUSTOMER</span>
                        </div>
                        <h2 className="text-3xl font-bold text-white truncate max-w-full">
                            {customer?.name || 'Guest'}
                        </h2>
                    </header>

                    <div className="flex-1 flex flex-col justify-center space-y-8">
                        <div className="flex justify-between items-center text-slate-400 text-2xl">
                            <span>Subtotal</span>
                            <span>{formatCurrency(totals.subtotal)}</span>
                        </div>
                        <div className="flex justify-between items-center text-slate-400 text-2xl">
                            <span>Tax (5%)</span>
                            <span>{formatCurrency(totals.tax)}</span>
                        </div>

                        <div className="h-px bg-gradient-to-r from-transparent via-white/20 to-transparent my-6"></div>

                        <div className="flex flex-col items-center justify-center bg-white/5 rounded-3xl p-8 border border-white/10 shadow-inner">
                            <span className="text-2xl text-blue-300 font-medium mb-2">Total Amount</span>
                            <span className="text-7xl font-extrabold text-white tracking-tighter">
                                {formatCurrency(totals.total)}
                            </span>
                        </div>
                    </div>

                    <footer className="mt-auto pt-10 text-center">
                        <p className="text-slate-500 font-medium text-lg">Thank you for dining with us!</p>
                        <div className="mt-6 flex justify-center space-x-2">
                            {/* Payment Method Icons - placeholder */}
                            <div className="w-10 h-6 bg-white/10 rounded"></div>
                            <div className="w-10 h-6 bg-white/10 rounded"></div>
                            <div className="w-10 h-6 bg-white/10 rounded"></div>
                        </div>
                    </footer>
                </div>
            </div>
        </div>
    );
};

export default CustomerDisplay;
