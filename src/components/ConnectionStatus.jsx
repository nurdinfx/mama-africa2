// src/components/ConnectionStatus.jsx
import React, { useState, useEffect } from 'react';
import { realApi, testBackendConnection } from '../api/realApi';

const ConnectionStatus = () => {
  const [status, setStatus] = useState('checking');
  const [backendInfo, setBackendInfo] = useState(null);

  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    try {
      setStatus('checking');
      const result = await testBackendConnection();
      
      if (result.success) {
        setStatus('connected');
        setBackendInfo(result.data);
      } else {
        setStatus('failed');
        setBackendInfo(result.error);
      }
    } catch (error) {
      setStatus('failed');
      setBackendInfo(error);
    }
  };

  return (
    <div className={`fixed top-4 right-4 p-3 rounded-lg text-white text-sm ${
      status === 'connected' ? 'bg-green-500' :
      status === 'failed' ? 'bg-red-500' : 'bg-yellow-500'
    }`}>
      {status === 'connected' && '✅ Backend Connected'}
      {status === 'failed' && '❌ Backend Offline'}
      {status === 'checking' && '🔄 Checking Connection...'}
    </div>
  );
};

export default ConnectionStatus;
