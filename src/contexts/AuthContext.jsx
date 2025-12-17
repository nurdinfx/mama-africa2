// src/contexts/AuthContext.jsx - STRICT SESSION SECURITY
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

  // STRICT SECURITY: Clear session on tab close/refresh/background
  useEffect(() => {
    const handleUnload = () => {
      // Clear sensitive data when the session ends (tab closed or refreshed)
      sessionStorage.clear();
    };

    const handleVisibilityChange = () => {
       if (document.visibilityState === 'hidden') {
         // Clear session when app is backgrounded (mobile/PWA switching)
         sessionStorage.clear();
         // Optional: You might want to force state update or reload if the user comes back without reloading content
         // But simply clearing storage means next API call or page load will fail auth check
       }
    };

    window.addEventListener("beforeunload", handleUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    
    return () => {
      window.removeEventListener("beforeunload", handleUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    
    const initializeAuth = async () => {
      console.log('🔐 Initializing strict session authentication...');
      
      try {
        // Test backend connection
        const connectionTest = await realApi.testConnection();
        setBackendStatus(connectionTest.success ? 'connected' : 'disconnected');
        
        // Check for existing SESSION (not persistent storage)
        const token = sessionStorage.getItem('token');
        const savedUser = sessionStorage.getItem('user');
        
        if (token && savedUser) {
          try {
            // Validate token is still valid
            if (connectionTest.success) {
              const userResponse = await realApi.getMe();
              if (userResponse.success) {
                const userData = realApi.extractData(userResponse);
                setUser(userData);
                setIsAuthenticated(true);
              } else {
                clearAuthData();
              }
            } else {
               // Offline fallback (only valid for current session)
               setUser(JSON.parse(savedUser));
               setIsAuthenticated(true);
            }
          } catch (error) {
            clearAuthData();
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
    sessionStorage.clear(); // Clear EVERYTHING
    // Also clear localStorage just in case older versions left debris
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    
    setUser(null);
    setIsAuthenticated(false);
  };

  const login = async (identifier, password) => {
    try {
      const result = await realApi.login(identifier, password);
      
      if (result.success) {
        const { token, user: userData } = result.data;
        
        // Store in SESSION only
        sessionStorage.setItem('token', token);
        sessionStorage.setItem('user', JSON.stringify(userData));
        
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
      await realApi.logout();
    } catch (e) {
      console.warn('Logout API failed', e);
    }
    clearAuthData();
    // Force reload to completely clear memory state if desired, or just navigate
    window.location.href = '/login'; 
    return { success: true };
  };

  const switchToDemo = async (role = 'manager') => {
      // Demo logic adapted for simplified session
      const demoToken = `demo-${role}-${Date.now()}`;
      const demoUser = {
        _id: `demo-${role}`,
        name: `Demo ${role}`,
        role: role,
        isDemo: true,
        email: `${role}@demo.com`
      };
      
      sessionStorage.setItem('token', demoToken);
      sessionStorage.setItem('user', JSON.stringify(demoUser));
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
