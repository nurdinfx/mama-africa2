/**
 * API Configuration
 * Automatically detects environment and uses appropriate URLs
 */

// Detect if we're in production
const isProduction = import.meta.env.MODE === 'production' || 
                     window.location.hostname !== 'localhost';

// Get the appropriate API URL based on environment
const getApiUrl = () => {
  // Runtime config overrides everything when present
  if (typeof window !== 'undefined' && window.__APP_CONFIG__ && window.__APP_CONFIG__.apiBaseUrl) {
    const v = window.__APP_CONFIG__.apiBaseUrl;
    // Normalize to absolute URL
    if (/^https?:\/\//i.test(v)) return v;
    const backend = import.meta.env.VITE_BACKEND_URL || 'https://mama-africa1.onrender.com';
    if (v.startsWith('/')) return backend + v;
    return backend + '/' + v;
  }
  // Environment variable next
  if (typeof window !== 'undefined' && /vercel\.app$/i.test(window.location.hostname)) {
    return 'https://mama-africa1.onrender.com/api/v1';
  }
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  // Fallback to production URL (live backend)
  return (import.meta.env.VITE_PRODUCTION_API_URL || 'https://mama-africa1.onrender.com/api/v1');
};

const getBackendUrl = () => {
  // Derive from runtime API if present
  if (typeof window !== 'undefined' && window.__APP_CONFIG__ && window.__APP_CONFIG__.apiBaseUrl) {
    return window.__APP_CONFIG__.apiBaseUrl.replace('/api/v1', '');
  }
  // Environment variable next
  if (import.meta.env.VITE_BACKEND_URL) {
    return import.meta.env.VITE_BACKEND_URL;
  }
  // Fallback to production URL (live backend)
  return 'https://mama-africa1.onrender.com';
};

const getSocketUrl = () => {
  // Derive from runtime API if present
  if (typeof window !== 'undefined' && window.__APP_CONFIG__ && window.__APP_CONFIG__.apiBaseUrl) {
    return window.__APP_CONFIG__.apiBaseUrl.replace('/api/v1', '');
  }
  // Environment variable next
  if (import.meta.env.VITE_SOCKET_URL) {
    return import.meta.env.VITE_SOCKET_URL;
  }
  // Fallback to production URL (live backend)
  return 'https://mama-africa1.onrender.com';
};

export const API_CONFIG = {
  get API_URL() { return getApiUrl(); },
  get BACKEND_URL() { return getBackendUrl(); },
  get SOCKET_URL() { return getSocketUrl(); },
  IS_PRODUCTION: isProduction,
  IS_DEVELOPMENT: !isProduction,
};

// Log configuration in development
if (!isProduction) {
  console.log('🔧 API URL:', API_CONFIG.API_URL);
  console.log('🔧 BACKEND URL:', API_CONFIG.BACKEND_URL);
  console.log('🔧 SOCKET URL:', API_CONFIG.SOCKET_URL);
}

export default API_CONFIG;
