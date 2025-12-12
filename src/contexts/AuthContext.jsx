// src/contexts/AuthContext.jsx - UPDATED FOR REAL AUTHENTICATION
import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import { realApi } from '../api/realApi';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [backendStatus, setBackendStatus] = useState('checking');
  
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    
    const initializeAuth = async () => {
      console.log('🔐 Initializing authentication...');
      
      try {
        // First, test backend connection
        const connectionTest = await realApi.testConnection();
        
        if (connectionTest.success) {
          setBackendStatus('connected');
          console.log('✅ Backend is connected');
        } else {
          setBackendStatus('disconnected');
          console.warn('⚠️ Backend is not available:', connectionTest.message);
        }
        
        // Check for existing session
        const token = localStorage.getItem('token');
        const savedUser = localStorage.getItem('user');
        
        if (token && savedUser) {
          try {
            if (backendStatus === 'connected') {
              // Validate token with backend
              const userResponse = await realApi.getMe();
              if (userResponse.success) {
                const userData = realApi.extractData(userResponse);
                setUser(userData);
                setIsAuthenticated(true);
                console.log('✅ Session restored with backend validation');
              } else {
                clearAuthData();
              }
            } else {
              // Use saved user if backend is down (temporary)
              const userData = JSON.parse(savedUser);
              setUser(userData);
              setIsAuthenticated(true);
              console.log('⚠️ Using saved session (backend unavailable)');
            }
          } catch (error) {
            console.error('❌ Session validation failed:', error);
            clearAuthData();
          }
        } else {
          console.log('🔒 No existing session found');
        }
      } catch (error) {
        console.error('❌ Auth initialization error:', error);
        setBackendStatus('error');
      } finally {
        setLoading(false);
        console.log('✅ Auth initialization completed');
      }
    };

    initializeAuth();
  }, []);

  const clearAuthData = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setIsAuthenticated(false);
  };

  const login = async (identifier, password) => {
    console.log('🔐 Login attempt for:', identifier);
    
    try {
      // Try REAL backend login
      const result = await realApi.login(identifier, password);
      
      if (result.success) {
        const { token, user: userData } = result.data;
        
        // Store authentication data
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(userData));
        
        // Update state
        setUser(userData);
        setIsAuthenticated(true);
        setBackendStatus('connected');
        
        console.log('✅ Login successful for:', userData.name || userData.username || userData.email);
        
        return {
          success: true,
          message: 'Login successful',
          user: userData
        };
      } else {
        return {
          success: false,
          message: result.message || 'Login failed'
        };
      }
    } catch (error) {
      console.error('❌ Login error:', error);
      
      let errorMessage = 'Login failed';
      
      if (error.status === 401) {
        errorMessage = 'Invalid credentials. Please check your username/email and password.';
      } else if (error.code === 'NETWORK_ERROR') {
        errorMessage = 'Cannot connect to server. Please check your internet connection.';
      } else {
        errorMessage = error.message || 'Login failed';
      }
      
      return {
        success: false,
        message: errorMessage,
        error: error
      };
    }
  };

  const register = async (userData) => {
    try {
      const result = await realApi.register(userData);
      
      if (result.success) {
        return {
          success: true,
          message: result.message || 'Registration successful',
          data: result.data
        };
      }
      
      return {
        success: false,
        message: result.message || 'Registration failed'
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Registration failed'
      };
    }
  };

  const logout = async () => {
    console.log('🚪 Logout requested');
    
    try {
      await realApi.logout();
    } catch (error) {
      console.warn('Logout API error (proceeding anyway):', error);
    }
    
    clearAuthData();
    console.log('✅ Logout completed');
    
    return { success: true, message: 'Logged out successfully' };
  };

  const switchToDemo = async (role = 'manager') => {
    try {
      // Try to fetch demo accounts list (optional)
      let account = null;
      try {
        const res = await realApi.getDemoAccounts();
        const accounts = res.data?.data || [];
        account = accounts.find(a => a.role === role) || null;
      } catch {
        // Ignore fetch errors; proceed with local defaults
      }

      // Local fallback demo accounts
      const localDemo = {
        admin: { email: 'admin@demo.com', password: 'admin123', name: 'Demo Admin', role: 'admin' },
        manager: { email: 'manager@demo.com', password: 'manager123', name: 'Demo Manager', role: 'manager' },
        cashier: { email: 'cashier@demo.com', password: 'cashier123', name: 'Demo Cashier', role: 'cashier' },
        chef: { email: 'chef@demo.com', password: 'chef123', name: 'Demo Chef', role: 'chef' },
        waiter: { email: 'waiter@demo.com', password: 'waiter123', name: 'Demo Waiter', role: 'waiter' },
      };

      const acc = account || localDemo[role];
      if (!acc) {
        return { success: false, message: 'Demo account not found for role' };
      }

      // Offline demo login (no backend POST)
      const demoToken = `demo-${acc.role}-${Date.now()}`;
      const demoUser = {
        id: `demo-${acc.role}`,
        _id: `demo-${acc.role}`,
        name: acc.name,
        email: acc.email,
        role: acc.role,
        isDemo: true,
        permissions: {
          admin: ['read', 'write', 'delete', 'manage_users', 'view_reports', 'manage_settings'],
          manager: ['read', 'write', 'view_reports', 'manage_orders'],
          cashier: ['read', 'write', 'process_payments', 'manage_orders'],
          chef: ['read', 'update_orders', 'view_kitchen'],
          waiter: ['read', 'create_orders', 'update_orders']
        }[acc.role] || ['read'],
        branch: {
          _id: 'DEMO-BRANCH',
          name: 'Demo Restaurant',
          branchCode: 'DEMO',
          settings: { taxRate: 10, serviceCharge: 5, currency: 'USD', timezone: 'UTC' }
        },
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString()
      };

      localStorage.setItem('token', demoToken);
      localStorage.setItem('user', JSON.stringify(demoUser));
      setUser(demoUser);
      setIsAuthenticated(true);
      setBackendStatus('connected');

      return { success: true, message: 'Demo login successful', user: demoUser };
    } catch (error) {
      return { success: false, message: error.message || 'Demo login failed' };
    }
  };

  const refreshUser = async () => {
    if (!isAuthenticated) return null;
    
    try {
      const result = await realApi.getMe();
      if (result.success) {
        const userData = realApi.extractData(result);
        setUser(userData);
        localStorage.setItem('user', JSON.stringify(userData));
        return userData;
      }
    } catch (error) {
      console.error('Error refreshing user:', error);
    }
    
    return user;
  };

  const value = {
    user,
    loading,
    isAuthenticated,
    backendStatus,
    login,
    register,
    logout,
    refreshUser,
    clearAuthData,
    switchToDemo
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
