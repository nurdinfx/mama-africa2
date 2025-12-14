/**
 * API Configuration
 * Automatically detects environment and uses appropriate URLs
 */

// Detect if we're in production
const isLocal = typeof window !== 'undefined' && (
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1' ||
  /^192\.168\./.test(window.location.hostname) ||
  /^10\./.test(window.location.hostname) ||
  /^172\.(1[6-9]|2\d|3[0-1])\./.test(window.location.hostname)
);

const isProduction = import.meta.env.MODE === 'production' && !isLocal;

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

  // Explicitly check for known production domains
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    // If we are on the production domain (render or vercel), use production API
    if (hostname.includes('onrender.com') || hostname.includes('vercel.app')) {
      return (import.meta.env.VITE_PRODUCTION_API_URL || 'https://mama-africa1.onrender.com/api/v1');
    }
  }

  // Force local API if running locally, ignoring .env if it points to production
  if (isLocal) {
    if (import.meta.env.VITE_API_URL) {
      const envUrl = import.meta.env.VITE_API_URL;
      const isProdUrl = envUrl.includes('onrender.com') || envUrl.includes('vercel.app');

      if (isProdUrl) {
        console.warn('⚠️ Ignoring production VITE_API_URL in local environment to ensure persistence. Using local server.');
        return 'http://localhost:5000/api/v1';
      }
    }
    // If no .env or .env is local, use default local
    return 'http://localhost:5000/api/v1';
  }

  // If VITE_API_URL is explicitly set (e.g. in .env), respect it for non-local builds
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  // Default to relative path /api/v1 for ALL other cases
  return '/api/v1';
};

const getBackendUrl = () => {
  // Derive from runtime API if present
  if (typeof window !== 'undefined' && window.__APP_CONFIG__ && window.__APP_CONFIG__.apiBaseUrl) {
    return window.__APP_CONFIG__.apiBaseUrl.replace('/api/v1', '');
  }

  // Explicitly check for known production domains
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname.includes('onrender.com') || hostname.includes('vercel.app')) {
      return 'https://mama-africa1.onrender.com';
    }
  }

  // Environment variable next - but safeguard against prod URL in local dev
  if (import.meta.env.VITE_BACKEND_URL) {
    if (isLocal && (import.meta.env.VITE_BACKEND_URL.includes('onrender.com') || import.meta.env.VITE_BACKEND_URL.includes('vercel.app'))) {
      console.warn('⚠️ Ignoring production VITE_BACKEND_URL in local environment to ensure persistence. Using local server.');
    } else {
      return import.meta.env.VITE_BACKEND_URL;
    }
  }

  // Default to local server on port 5000 for all other cases
  if (typeof window !== 'undefined') {
    return 'http://' + window.location.hostname + ':5000';
  }

  return 'http://localhost:5000';
};

const getSocketUrl = () => {
  // Reuse backend URL logic but ensure no trailing slash if needed
  const backendUrl = getBackendUrl();
  return backendUrl;
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
