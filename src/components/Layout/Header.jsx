import React from 'react';
import { useAuth } from '../../contexts/AuthContext'; // Fixed import path

const Header = ({ toggleSidebar }) => {
  const { user, branch, logout } = useAuth();

  return (
    <header className="bg-white shadow-sm border-b sticky top-0 z-10">
      <div className="flex items-center justify-between px-4 py-3 md:px-6 md:py-4">
        <div className="flex items-center">
          {/* Hamburger Menu Button */}
          <button
            onClick={toggleSidebar}
            className="md:hidden mr-4 text-gray-500 hover:text-gray-700 focus:outline-none"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div>
            <h1 className="text-xl md:text-2xl font-semibold text-gray-900 truncate max-w-[200px] md:max-w-none">
              {branch?.name || 'HUDI SOMPROJECT POS SYSTEM'}
            </h1>
            <p className="text-xs md:text-sm text-gray-500 hidden sm:block">
              Welcome back, {user?.name}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 md:space-x-4">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-gray-900 capitalize">{user?.role}</p>
            <p className="text-xs text-gray-500">{branch?.branchCode || 'Main Branch'}</p>
          </div>

          <button
            onClick={logout}
            className="bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;