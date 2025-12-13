import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext'; // Fixed import path

const Sidebar = ({ isOpen, setIsOpen }) => {
  const { user } = useAuth();
  const location = useLocation();

  const navigation = [
    {
      name: 'Dashboard',
      href: '/dashboard',
      icon: '📊',
      roles: ['admin', 'manager']
    },
    {
      name: 'POS',
      href: '/pos',
      icon: '💳',
      roles: ['admin', 'manager', 'cashier', 'waiter']
    },
    {
      name: 'Kitchen',
      href: '/kitchen',
      icon: '👨‍🍳',
      roles: ['admin', 'chef']
    },
    {
      name: 'Orders',
      href: '/orders',
      icon: '📦',
      roles: ['admin', 'manager', 'cashier']
    },
    {
      name: 'Tables',
      href: '/tables',
      icon: '🪑',
      roles: ['admin', 'manager', 'waiter']
    },
    {
      name: 'Inventory',
      href: '/inventory',
      icon: '📦',
      roles: ['admin', 'manager']
    },

    {
      name: 'Customer Ledger',
      href: '/customers/ledger',
      icon: '📒',
      roles: ['admin', 'manager', 'cashier']
    },
    {
      name: 'Finance',
      href: '/finance',
      icon: '💰',
      roles: ['admin', 'manager']
    },
    // ADD PURCHASE NAVIGATION ITEM
    {
      name: 'Purchase',
      href: '/purchase',
      icon: '🛒',
      roles: ['admin', 'manager']
    },
    {
      name: 'Users',
      href: '/users',
      icon: '👤',
      roles: ['admin', 'manager']
    },
    {
      name: 'Reports',
      href: '/reports',
      icon: '📈',
      roles: ['admin', 'manager']
    },
    {
      name: 'Settings',
      href: '/settings',
      icon: '⚙️',
      roles: ['admin', 'manager']
    },
  ];

  const filteredNavigation = navigation.filter(item =>
    item.roles.includes(user?.role)
  );

  return (
    <div className={`w-64 bg-red-800 text-white h-screen fixed left-0 top-0 overflow-y-auto z-30 transition-transform duration-300 transform 
      ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
      <div className="p-4 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">RMS</h1>
          <p className="text-red-200 text-sm">mama-africa Restaurant</p>
        </div>
        {/* Close button for mobile */}
        <button
          onClick={() => setIsOpen(false)}
          className="md:hidden text-white hover:text-red-200 focus:outline-none"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <nav className="mt-8">
        <ul className="space-y-2 px-4">
          {filteredNavigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <li key={item.name}>
                <Link
                  to={item.href}
                  onClick={() => setIsOpen(false)} // Close sidebar on mobile when link clicked
                  className={`flex items-center px-4 py-3 rounded-lg transition-colors ${isActive
                    ? 'bg-red-600 text-white'
                    : 'text-red-100 hover:bg-red-700'
                    }`}
                >
                  <span className="mr-3 text-lg">{item.icon}</span>
                  <span className="font-medium">{item.name}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

    </div>
  );
};

export default Sidebar;