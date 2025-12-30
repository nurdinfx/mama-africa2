import React from 'react';

const CustomerSearch = ({ onCustomerSelect }) => {
    return (
        <div className="p-4 bg-white border-t border-gray-200">
            <input
                type="text"
                placeholder="Search Customer..."
                className="w-full border border-gray-300 rounded p-2 text-sm"
                onChange={(e) => console.log('Search customer:', e.target.value)}
            />
        </div>
    );
};

export default CustomerSearch;
