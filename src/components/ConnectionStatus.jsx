// src/components/ConnectionStatus.jsx
import React, { useState, useEffect } from 'react';
import { realApi } from '../api/realApi';
import { dbService } from '../services/db';

const ConnectionStatus = () => {
  const [status, setStatus] = useState('checking');
  const [backendInfo, setBackendInfo] = useState(null);
  const [queuedCount, setQueuedCount] = useState(0);
  const [offlineOrdersCount, setOfflineOrdersCount] = useState(0);

  useEffect(() => {
    checkConnection();
    updateCounts();

    const handleOnlineOffline = () => {
      checkConnection();
      updateCounts();
    };

    window.addEventListener('online', handleOnlineOffline);
    window.addEventListener('offline', handleOnlineOffline);

    return () => {
      window.removeEventListener('online', handleOnlineOffline);
      window.removeEventListener('offline', handleOnlineOffline);
    };
  }, []);

  const updateCounts = async () => {
    try {
      const outbox = await dbService.getAll('outbox');
      const offlineOrders = await dbService.getAll('offline_orders');
      setQueuedCount(outbox ? outbox.length : 0);
      setOfflineOrdersCount(offlineOrders ? offlineOrders.length : 0);
    } catch (e) {
      // ignore
    }
  };

  const checkConnection = async () => {
    try {
      setStatus('checking');
      const result = await realApi.testConnection();

      if (result && result.success) {
        setStatus('connected');
        setBackendInfo(result.data || result);
      } else {
        setStatus('failed');
        setBackendInfo(result?.error || result?.message || result);
      }
    } catch (error) {
      setStatus('failed');
      setBackendInfo(error?.message || error);
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

      {(queuedCount > 0 || offlineOrdersCount > 0) && (
        <div className="mt-1 text-xs opacity-90">
          {queuedCount > 0 && <div>📤 Queued: {queuedCount} operation(s)</div>}
          {offlineOrdersCount > 0 && <div>🧾 Offline orders: {offlineOrdersCount}</div>}
        </div>
      )}
    </div>
  );
};

export default ConnectionStatus;
