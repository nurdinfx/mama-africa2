/**
 * API Configuration
 * Automatically detects environment and uses appropriate URLs
 */

// OFFLINE-ONLY: force local
const isLocal = true;
const isProduction = import.meta.env.MODE === 'production' && !isLocal;

// Get the appropriate API URL based on environment
const getApiUrl = () => 'http://localhost:5000/api/v1';

const getBackendUrl = () => 'http://localhost:5000';

const getSocketUrl = () => 'http://localhost:5000';

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
