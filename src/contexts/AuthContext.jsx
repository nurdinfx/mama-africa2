// src/contexts/AuthContext.jsx - OFFLINE PERSISTENCE ENABLED
import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();

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
    localStorage.removeItem('auth_ts');
    sessionStorage.clear();

    setUser(null);
    setIsAuthenticated(false);
  };

  const login = async (identifier, password) => {
    try {
      const result = await realApi.login(identifier, password);

      if (result.success) {
        const { token, user: userData } = result.data;

        // Store in localStorage for persistence (encrypted when possible)
        try {
          // Use crypto service to encrypt sensitive data
          const { cryptoService } = await import('../services/crypto');
          const encToken = await cryptoService.encrypt(token);
          const encUser = await cryptoService.encrypt(userData);
          if (encToken.success) localStorage.setItem('token_enc', encToken.encrypted);
          else localStorage.setItem('token', token);
          if (encUser.success) localStorage.setItem('user_enc', encUser.encrypted);
          else localStorage.setItem('user', JSON.stringify(userData));
          localStorage.setItem('auth_ts', Date.now());
        } catch (e) {
          console.warn('Encryption unavailable; storing token/user in localStorage as fallback', e);
          localStorage.setItem('token', token);
          localStorage.setItem('user', JSON.stringify(userData));
          localStorage.setItem('auth_ts', Date.now());
        }

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

  // Restore cached session when offline
  const restoreCachedSession = async () => {
    try {
      // Prefer encrypted values if available
      const encToken = localStorage.getItem('token_enc');
      const encUser = localStorage.getItem('user_enc');
      let token = null;
      let userObj = null;

      if (encToken || encUser) {
        try {
          const { cryptoService } = await import('../services/crypto');
          if (encToken) {
            const d = await cryptoService.decrypt(encToken);
            if (d.success) token = d.data;
          }
          if (encUser) {
            const d2 = await cryptoService.decrypt(encUser);
            if (d2.success) userObj = d2.data;
          }
        } catch (err) {
          console.warn('Failed to decrypt cached session, falling back to plain storage', err);
        }
      }

      // Fallback to plain localStorage
      if (!token) token = localStorage.getItem('token');
      if (!userObj) {
        const saved = localStorage.getItem('user');
        if (saved) userObj = JSON.parse(saved);
      }

      if (token && userObj) {
        setUser(userObj);
        setIsAuthenticated(true);
        setBackendStatus(navigator.onLine ? 'connected' : 'offline');
        return { success: true, user: userObj };
      }

      return { success: false, message: 'No cached session' };
    } catch (e) {
      console.error('Failed to restore cached session', e);
      return { success: false, message: e.message };
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
    // Navigate to login (SPA navigation to avoid full reload)
    try {
      navigate('/login');
    } catch (err) {
      console.warn('navigate failed; unable to redirect to /login');
    }
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

  // Listen for programmatic logout events fired by other modules (e.g., API 401 handler)
  useEffect(() => {
    const handler = (e) => {
      console.log('🔔 auth.logout event received, clearing auth and redirecting to login');
      clearAuthData();
      try {
        navigate('/login');
      } catch (err) {
        console.warn('Failed to navigate to /login after auth.logout event');
      }
    };
    window.addEventListener('auth.logout', handler);
    return () => window.removeEventListener('auth.logout', handler);
  }, [navigate]);

  const value = {
    user,
    loading,
    isAuthenticated,
    backendStatus,
    login,
    logout,
    clearAuthData,
    restoreCachedSession,
    switchToDemo
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
