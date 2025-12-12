import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext'; // Fixed import path

const Sidebar = () => {
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
    <div className="w-64 bg-blue-800 text-white h-screen fixed left-0 top-0 overflow-y-auto">
      <div className="p-4">
        <h1 className="text-2xl font-bold text-white">RMS</h1>
        <p className="text-blue-200 text-sm">mama-africa Restaurant</p>
      </div>
      
      <nav className="mt-8">
        <ul className="space-y-2 px-4">
          {filteredNavigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <li key={item.name}>
                <Link
                  to={item.href}
                  className={`flex items-center px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-blue-100 hover:bg-blue-700'
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