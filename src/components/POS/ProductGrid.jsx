import React from 'react';

const ProductGrid = ({ onAddToCart }) => {
    const dummyProducts = [
        { _id: '1', name: 'Burger', price: 10, category: 'Food' },
        { _id: '2', name: 'Fries', price: 5, category: 'Sides' },
        { _id: '3', name: 'Soda', price: 3, category: 'Drinks' },
        { _id: '4', name: 'Pizza', price: 15, category: 'Food' },
    ];

    return (
        <div className="grid grid-cols-4 gap-4">
            {dummyProducts.map(product => (
                <div
                    key={product._id}
                    className="bg-white p-4 rounded shadow cursor-pointer hover:shadow-lg transition-transform hover:-translate-y-1"
                    onClick={() => onAddToCart(product)}
                >
                    <div className="h-24 bg-gray-200 rounded mb-2 flex items-center justify-center text-gray-400">
                        Image
                    </div>
                    <h3 className="font-bold">{product.name}</h3>
                    <p className="text-gray-600">${product.price}</p>
                </div>
            ))}
        </div>
    );
};

export default ProductGrid;
