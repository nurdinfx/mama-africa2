import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  LayoutDashboard,
  ChefHat,
  Package,
  Table,
  Archive,
  BookOpen,
  Banknote,
  ShoppingCart,
  Users,
  TrendingUp,
  Settings,
  CreditCard,
  LogOut,
} from 'lucide-react';

const Sidebar = ({ isOpen, setIsOpen }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['admin', 'manager'] },
    { name: 'POS', href: '/pos', icon: CreditCard, roles: ['admin', 'manager', 'cashier', 'waiter'] },
    { name: 'Kitchen', href: '/kitchen', icon: ChefHat, roles: ['admin', 'chef'] },
    { name: 'Orders', href: '/orders', icon: Package, roles: ['admin', 'manager', 'cashier'] },
    { name: 'Tables', href: '/tables', icon: Table, roles: ['admin', 'manager', 'waiter'] }, // Previous "Products" link, moved to real Tables
    { name: 'Inventory', href: '/inventory', icon: Archive, roles: ['admin', 'manager'] },
    { name: 'Customer Ledger', href: '/customers/ledger', icon: BookOpen, roles: ['admin', 'manager', 'cashier'] },
    { name: 'Finance', href: '/finance', icon: Banknote, roles: ['admin', 'manager'] },
    { name: 'Purchase', href: '/purchase', icon: ShoppingCart, roles: ['admin', 'manager'] },
    { name: 'Users', href: '/users', icon: Users, roles: ['admin', 'manager'] },
    { name: 'Reports', href: '/reports', icon: TrendingUp, roles: ['admin', 'manager'] },
    { name: 'Settings', href: '/settings', icon: Settings, roles: ['admin', 'manager'] },
  ];

  const filteredNavigation = navigation.filter(
    (item) => item.roles.includes(user?.role)
  );

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (e) {
      // ignore
    }
  };

  const handleItemClick = () => {
    // Close drawer after navigation so content uses full width
    setIsOpen(false);
  };

  const isCurrentPath = (href) =>
    location.pathname === href || location.pathname.startsWith(`${href}/`);

  return (
    <div
      className={`bg-blue-700 text-white h-screen fixed left-0 top-0 w-64 overflow-y-auto z-50 border-r border-blue-600 shadow-xl transition-transform duration-300 transform ${isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
    >
      <div className="p-4 flex justify-between items-center border-b border-blue-600/50">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-white text-blue-700 flex items-center justify-center font-bold text-lg shadow-sm">
            HP
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-wide">
              Hudi POS
            </h1>
            <p className="text-xs text-blue-200">Restaurant Suite</p>
          </div>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="text-blue-200 hover:text-white focus:outline-none"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <nav className="mt-6">
        <ul className="space-y-1 px-3">
          {filteredNavigation.map((item) => {
            const active = isCurrentPath(item.href);
            const Icon = item.icon;
            return (
              <li key={item.name}>
                <Link
                  to={item.href}
                  onClick={handleItemClick}
                  className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all ${active
                    ? 'bg-white text-blue-700 shadow-md translate-x-1'
                    : 'text-blue-100 hover:bg-blue-600 hover:text-white hover:translate-x-1'
                    }`}
                >
                  <span
                    className={`h-8 w-8 rounded-lg flex items-center justify-center ${active
                      ? 'bg-blue-100/50 text-blue-700'
                      : 'bg-blue-800/50 text-blue-200'
                      }`}
                  >
                    <Icon size={18} />
                  </span>
                  <span className="truncate">{item.name}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Logout at bottom */}
      <div className="mt-6 px-3 pb-6 border-t border-blue-600/50 pt-4">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold text-red-100 hover:bg-red-500/20 transition-all"
        >
          <span className="h-8 w-8 rounded-lg flex items-center justify-center bg-red-500/20 text-red-200">
            <LogOut size={18} />
          </span>
          <span className="truncate">Logout</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;