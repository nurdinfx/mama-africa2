// src/contexts/AuthContext.jsx - OFFLINE PERSISTENCE ENABLED
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

  // Persistence logic: We rely on local storage instead of session storage
  // to allow users to come back offline or after browser restart.

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const initializeAuth = async () => {
      console.log('🔐 Initializing authentication...');

      try {
        // Test backend connection - fast fail
        let connectionWorking = false;
        try {
          const connectionTest = await realApi.testConnection();
          connectionWorking = connectionTest.success;
          setBackendStatus(connectionWorking ? 'connected' : 'disconnected');
        } catch (e) {
          setBackendStatus('disconnected');
        }

        // Check for persistent storage (localStorage)
        const token = localStorage.getItem('token');
        const savedUser = localStorage.getItem('user');

        if (token && savedUser) {
          try {
            // If online, validate. If offline, trust local storage.
            if (connectionWorking) {
              const userResponse = await realApi.getMe();
              if (userResponse.success) {
                const userData = realApi.extractData(userResponse);
                setUser(userData);
                setIsAuthenticated(true);
              } else {
                // Token invalid
                clearAuthData();
              }
            } else {
              // Offline fallback 
              console.log('📡 Offline mode: Restoring user from local storage');
              setUser(JSON.parse(savedUser));
              setIsAuthenticated(true);
            }
          } catch (error) {
            // If validation fails hard (e.g. 401), clear.
            // But if just network error, keep user logged in.
            if (error?.response?.status === 401) {
              clearAuthData();
            } else {
              // Assume offline/network error
              console.log('📡 Network error during auth check: Restoring user from local storage');
              setUser(JSON.parse(savedUser));
              setIsAuthenticated(true);
            }
          }
        } else {
          // No active session
          clearAuthData();
        }
      } catch (error) {
        console.error('Auth Init Error:', error);
        setBackendStatus('error');
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const clearAuthData = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.clear();

    setUser(null);
    setIsAuthenticated(false);
  };

  const login = async (identifier, password) => {
    try {
      const result = await realApi.login(identifier, password);

      if (result.success) {
        const { token, user: userData } = result.data;

        // Store in localStorage for persistence
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(userData));

        setUser(userData);
        setIsAuthenticated(true);
        setBackendStatus('connected');

        return { success: true, user: userData };
      } else {
        return { success: false, message: result.message };
      }
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Login failed'
      };
    }
  };

  const logout = async () => {
    try {
      if (navigator.onLine) {
        await realApi.logout();
      }
    } catch (e) {
      console.warn('Logout API failed', e);
    }
    clearAuthData();
    // Force reload to completely clear memory state if desired, or just navigate
    window.location.href = '/login';
    return { success: true };
  };

  const switchToDemo = async (role = 'manager') => {
    const demoToken = `demo-${role}-${Date.now()}`;
    const demoUser = {
      _id: `demo-${role}`,
      name: `Demo ${role}`,
      role: role,
      isDemo: true,
      email: `${role}@demo.com`
    };

    localStorage.setItem('token', demoToken);
    localStorage.setItem('user', JSON.stringify(demoUser));
    setUser(demoUser);
    setIsAuthenticated(true);
    return { success: true };
  };

  const value = {
    user,
    loading,
    isAuthenticated,
    backendStatus,
    login,
    logout,
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
