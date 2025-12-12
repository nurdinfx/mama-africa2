import React from 'react';
import { useAuth } from '../../contexts/AuthContext'; // Fixed import path

const Header = () => {
  const { user, branch, logout } = useAuth();

  return (
    <header className="bg-white shadow-sm border-b">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            {branch?.name || 'HUDI SOMPROJECT POS SYSTEM'}
          </h1>
          <p className="text-sm text-gray-500">
            Welcome back, {user?.name}
          </p>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="text-right">
            <p className="text-sm font-medium text-gray-900 capitalize">{user?.role}</p>
            <p className="text-xs text-gray-500">{branch?.branchCode || 'Main Branch'}</p>
          </div>
          
          <button
            onClick={logout}
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;