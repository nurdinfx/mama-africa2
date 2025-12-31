import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaTrash, FaSearch } from 'react-icons/fa';

const OrderCart = ({
    cart,
    onUpdateQuantity,
    onRemoveItem,
    totals, // { subtotal, tax, total }
    orderType, // 'dine-in', 'takeaway'
    onOrderTypeChange,
    tableNumber,
    onTableNumberChange,
    customer,
    onPlaceOrder,
    onClearCart,
    vatEnabled,
    setVatEnabled,
    users = [],
    customers = [],
    tables = [],
    onCustomerChange
}) => {
    const navigate = useNavigate();
    // Local state for form fields
    const [bookedRoom, setBookedRoom] = useState('');
    const [remarks, setRemarks] = useState('');
    const [servedBy, setServedBy] = useState('');
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);

    // Calculate specific totals
    const localCurrencyRate = 12000;
    const totalLocal = totals.total * localCurrencyRate;

    // Set default served by if users load
    useEffect(() => {
        if (users.length > 0 && !servedBy) {
            setServedBy(users[0]._id);
        }
    }, [users, servedBy]);

    return (
        <div className="flex flex-col h-full bg-[#f8f9fa] border-l border-gray-300 w-full max-w-2xl mx-auto shadow-xl font-sans">

            {/* --- Top Header with Totals --- */}
            {/* Matches the blue bar in the image */}
            {/* Matches the blue bar in the image */}
            <div className="bg-[#4a69bd] text-white p-1 px-2 flex items-center justify-between shadow-sm gap-2">
                <div className="flex items-center gap-3 text-sm flex-1 overflow-x-auto whitespace-nowrap scrollbar-hide">
                    <div className="flex items-center gap-1">
                        <span className="text-gray-200 text-xs">Vat:</span>
                        <span className="font-semibold text-sm">{(totals.tax || totals.vatAmount || 0).toFixed(1)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <span className="text-gray-200 text-xs">Local:</span>
                        <span className="font-semibold text-sm">{totalLocal.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <span className="text-gray-200 text-xs">Sub:</span>
                        <span className="font-semibold text-sm">{totals.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <span className="text-gray-200 text-xs">Total:</span>
                        <span className="font-semibold text-sm">{totals.total.toFixed(2)}</span>
                    </div>
                </div>
                <button
                    onClick={() => navigate('/orders')}
                    className="bg-[#1e3799] hover:bg-[#0c2461] text-white px-3 py-1 rounded shadow-sm text-xs font-semibold transition-colors border border-blue-800 flex-shrink-0"
                >
                    Orders
                </button>
            </div>

            {/* --- Barcode Search --- */}
            <div className="p-1 bg-[#f1f2f6] border-b border-gray-300">
                <div className="flex items-center bg-white border border-gray-300 rounded-sm px-2 py-0.5 shadow-sm h-7">
                    <FaSearch className="text-gray-400 mr-2 text-xs" />
                    <input
                        type="text"
                        placeholder="Barcode"
                        className="w-full bg-transparent outline-none text-xs p-1 text-gray-700 placeholder-gray-400"
                    />
                </div>
            </div>

            {/* --- Product Table Header --- */}
            {/* Image shows "Product Price Quantity Subtotal" headers directly above items, no tabs visible in the cramped view but let's keep it simple */}
            <div className="flex-1 overflow-y-auto bg-white flex flex-col">
                <div className="bg-[#f1f2f6] text-gray-600 font-semibold border-b border-gray-300 text-xs flex">
                    <div className="p-2 w-5/12 pl-3">Product</div>
                    <div className="p-2 w-2/12">Price</div>
                    <div className="p-2 w-2/12">Quantity</div>
                    <div className="p-2 w-2/12 text-right pr-3">Subtotal</div>
                    <div className="w-1/12"></div>
                </div>

                <div className="divide-y divide-gray-100 overflow-y-auto flex-1 h-0">
                    {cart.length === 0 ? (
                        <div className="p-12 text-center text-gray-400 italic text-sm">
                            No items in cart
                        </div>
                    ) : (
                        cart.map((item) => {
                            const productId = item._id || item.product?._id || item.product?.id || item.id;
                            const productName = item.name || item.product?.name || 'Unknown Product';
                            const productCategory = item.category || item.product?.category || 'General';

                            return (
                                <div key={productId} className="flex text-xs hover:bg-blue-50 transition-colors items-center h-10 border-b border-gray-50">
                                    <div className="p-2 w-5/12 pl-3 font-medium text-gray-700 truncate">
                                        {productName}
                                        <div className="text-[10px] text-gray-400">{productCategory}</div>
                                    </div>
                                    <div className="p-2 w-2/12 text-gray-600">${item.price}</div>
                                    <div className="p-2 w-2/12">
                                        <input
                                            type="number"
                                            min="1"
                                            className="w-10 border border-gray-300 rounded px-1 py-0.5 text-center focus:ring-1 focus:ring-blue-500 outline-none"
                                            value={item.quantity}
                                            onChange={(e) => onUpdateQuantity(productId, parseInt(e.target.value) || 0)}
                                        />
                                    </div>
                                    <div className="p-2 w-2/12 pr-3 text-right font-medium text-gray-800">
                                        ${(item.price * item.quantity).toFixed(2)}
                                    </div>
                                    <div className="p-2 w-1/12 text-center">
                                        <button
                                            onClick={() => onRemoveItem(productId)}
                                            className="text-gray-400 hover:text-red-500 p-1"
                                        >
                                            <FaTrash size={11} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* --- Order Details Form --- */}
            <div className="bg-[#f1f2f6] p-2 border-t border-gray-300 space-y-1 mt-auto">

                {/* Row 1: Booked Room & Select Table */}
                <div className="grid grid-cols-2 gap-1">
                    <div className="bg-white border border-gray-400 rounded-sm flex items-center px-1 h-7">
                        <select
                            className="w-full bg-transparent p-0 outline-none text-xs text-gray-600"
                            value={bookedRoom}
                            onChange={(e) => setBookedRoom(e.target.value)}
                        >
                            <option value="">Booked Room</option>
                            <option value="101">Room 101</option>
                            <option value="102">Room 102</option>
                        </select>
                    </div>
                    <div className="bg-white border border-gray-400 rounded-sm flex items-center px-1 pl-2 h-7">
                        <span className="text-gray-500 mr-1 whitespace-nowrap text-[10px] font-medium">Table:</span>
                        <select
                            className="w-full bg-transparent p-0 outline-none text-xs text-gray-600"
                            value={tableNumber || ""}
                            onChange={(e) => onTableNumberChange(e.target.value)}
                        >
                            <option value="">None</option>
                            {tables.map(table => (
                                <option key={table._id} value={table._id}>{table.tableNo || table.name || `Table ${table._id}`}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Row 2: Customer */}
                <div className="bg-white border border-gray-400 rounded-sm flex items-center px-1 h-7">
                    <select
                        className="w-full bg-transparent p-0 outline-none text-xs text-gray-600"
                        value={customer ? customer._id : ""}
                        onChange={(e) => {
                            const selected = customers.find(c => c._id === e.target.value);
                            if (onCustomerChange) onCustomerChange(selected);
                        }}
                    >
                        <option value="">Customer</option>
                        {customers.map(c => (
                            <option key={c._id} value={c._id}>{c.name}</option>
                        ))}
                    </select>
                </div>

                {/* Row (New): Served By (Requested by user) */}
                <div className="bg-white border border-gray-400 rounded-sm flex items-center px-1 h-7">
                    <select
                        className="w-full bg-transparent p-0 outline-none text-xs text-gray-600"
                        value={servedBy}
                        onChange={(e) => setServedBy(e.target.value)}
                    >
                        <option value="">Served By</option>
                        {users.map(user => (
                            <option key={user._id} value={user._id}>{user.name}</option>
                        ))}
                    </select>
                </div>

                {/* Row 3: Remarks */}
                <div className="bg-white border border-gray-400 rounded-sm h-7 flex items-center">
                    <input
                        type="text"
                        placeholder="Remarks"
                        className="w-full bg-transparent px-2 outline-none text-xs text-gray-600"
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                    />
                </div>
            </div>

            {/* --- Bottom Action Bar --- */}
            <div className="bg-[#f1f2f6] p-2 border-t border-gray-300 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <button
                        onClick={onClearCart}
                        className="bg-[#eb4d4b] hover:bg-[#c0392b] text-white px-5 py-1.5 rounded-sm text-xs font-semibold shadow-sm transition-colors"
                    >
                        Clear
                    </button>

                    {/* VAT Toggle */}
                    <div className="flex items-center gap-2 px-1">
                        <span className="text-xs font-medium text-gray-600">Vat 4 %</span>
                        <button
                            onClick={() => setVatEnabled(!vatEnabled)}
                            className={`w-9 h-4.5 rounded-full p-0.5 transition-colors duration-200 ease-in-out relative ${vatEnabled ? 'bg-[#4a69bd]' : 'bg-gray-400'}`}
                        >
                            <div className={`bg-white w-3.5 h-3.5 rounded-full shadow-sm absolute top-0.5 transition-all duration-200 ${vatEnabled ? 'left-[calc(100%-16px)]' : 'left-0.5'}`} />
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className="text-[10px] text-gray-400 text-right mr-1 hidden sm:block tracking-widest">
                        0/30
                    </div>
                    <button className="bg-white border border-gray-400 hover:bg-gray-50 text-gray-600 px-3 py-1.5 rounded-sm text-xs font-medium transition-colors shadow-sm">
                        Discount
                    </button>
                    <button
                        onClick={() => onPlaceOrder({ servedBy, remarks })}
                        className="bg-[#f5f6fa] hover:bg-gray-200 text-gray-700 border border-gray-400 px-4 py-1.5 rounded-sm text-xs font-bold shadow-sm transition-colors"
                    >
                        Create Order
                    </button>
                </div>
            </div>

        </div>
    );
};

export default OrderCart;
