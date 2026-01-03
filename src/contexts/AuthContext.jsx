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
        // 1. Check for persistent storage (localStorage) first
        const token = localStorage.getItem('token');
        const savedUser = localStorage.getItem('user');

        // 2. Determine connection status
        let connectionWorking = false;
        try {
          if (navigator.onLine) {
            const connectionTest = await realApi.testConnection();
            connectionWorking = connectionTest.success;
          }
        } catch (e) {
          console.warn('Connection test failed (likely offline or timeout)');
        }

        setBackendStatus(connectionWorking ? 'connected' : (navigator.onLine ? 'disconnected' : 'offline'));

        // 3. Auth Logic
        if (token && savedUser) {
          try {
            // CASE A: Online and connected -> Validate with server
            if (connectionWorking) {
              const userResponse = await realApi.getMe();
              if (userResponse.success) {
                const userData = realApi.extractData(userResponse);
                setUser(userData);
                setIsAuthenticated(true);
              } else {
                // Token invalid on server
                console.warn('Token rejected by server, clearing session');
                clearAuthData();
              }
            }
            // CASE B: Offline or server unreachable -> Trust local storage
            else {
              console.log('📡 Offline/Disconnected mode: Restoring user from local storage');
              try {
                const parsedUser = JSON.parse(savedUser);
                if (parsedUser) {
                  setUser(parsedUser);
                  setIsAuthenticated(true);
                } else {
                  clearAuthData();
                }
              } catch (e) {
                console.error('Failed to parse saved user JSON', e);
                clearAuthData();
              }
            }
          } catch (error) {
            // If validation fails hard (e.g. 401), clear.
            if (error?.response?.status === 401) {
              console.warn('401 during init, clearing auth');
              clearAuthData();
            } else {
              // Assume offline/network error - Keep session!
              console.log('📡 Network error during auth check: Restoring user from local storage (Fallback)');
              try {
                const parsedUser = JSON.parse(savedUser);
                setUser(parsedUser);
                setIsAuthenticated(true);
              } catch (e) {
                clearAuthData();
              }
            }
          }
        } else {
          // No active session
          clearAuthData(); // ensuring state is clean
        }
      } catch (error) {
        console.error('Auth Init Critical Error:', error);
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
      // 1. Try explicit offline login if we know we are offline
      if (!navigator.onLine) {
        return await attemptOfflineLogin(identifier, password);
      }

      // 2. Try online login
      const result = await realApi.login(identifier, password);

      if (result.success) {
        // Online success
        const { token, user: userData } = result.data;
        handleSuccessfulLogin(token, userData, password);
        setBackendStatus('connected');
        return { success: true, user: userData };
      } else {
        // 3. Online failed - check if it was a network/connection error or server error
        // If message implies network error, try offline fallback
        if (result.message && (
          result.message.toLowerCase().includes('network') ||
          result.message.toLowerCase().includes('failed to fetch') ||
          result.message.toLowerCase().includes('offline') ||
          result.status === 0 ||
          !result.status
        )) {
          console.log('📡 Network error during login, attempting offline fallback...');
          return await attemptOfflineLogin(identifier, password);
        }

        // Genuine auth failure (wrong password etc) from server
        return { success: false, message: result.message };
      }
    } catch (error) {
      console.warn('Login exception:', error);
      // Fallback for any other crash/error during fetch
      return await attemptOfflineLogin(identifier, password);
    }
  };

  const attemptOfflineLogin = async (identifier, password) => {
    try {
      const offlineRes = await realApi.auth.offlineLogin(identifier, password);
      if (offlineRes && offlineRes.success) {
        const { token, user: userData } = offlineRes.data;
        // Store locally without encryption if needed, or re-use existing helper
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(userData));
        localStorage.setItem('auth_ts', Date.now());

        setUser(userData);
        setIsAuthenticated(true);
        setBackendStatus('offline');
        return { success: true, user: userData };
      }
      return offlineRes || { success: false, message: 'Offline login failed' };
    } catch (e) {
      return { success: false, message: 'Offline login attempt failed' };
    }
  };

  const handleSuccessfulLogin = async (token, userData) => {
    // Store in localStorage for persistence (attempt encryption)
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

      // CRITICAL: Cache the user's password hash for future offline login
      // We can't get the hash from the server usually, but if we just logged in,
      // we might want to ensure the LOCAL DB has this user record.
      // Note: We can't hash the password here without the plain text, which we have in 'login' scope but not here.
      // To fix "create user online then login offline" issue:
      // Ideally the server returns the hash OR we rely on the fact that 'createUser' stores it locally.
      // If the user logs in on a new device, we won't have the hash.
      // We can generate it now if we had the password, but we separated this function.
      // For now, relies on 'createUser' or previous cache.

    } catch (e) {
      console.warn('Encryption unavailable; storing token/user in localStorage as fallback', e);
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(userData));
      localStorage.setItem('auth_ts', Date.now());
    }

    setUser(userData);
    setIsAuthenticated(true);
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
