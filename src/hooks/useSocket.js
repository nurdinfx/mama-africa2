import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../contexts/AuthContext';
import { API_CONFIG } from '../config/api.config';

export const useRealSocket = () => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const socketRef = useRef(null);
  const { user, branch } = useAuth();

  useEffect(() => {
    if (!user || !branch) return;

    const socketUrl = API_CONFIG.SOCKET_URL;
    
    socketRef.current = io(socketUrl, {
      auth: {
        token: localStorage.getItem('token')
      },
      transports: ['websocket', 'polling']
    });

    socketRef.current.on('connect', () => {
      console.log('✅ Socket connected:', socketRef.current.id);
      setIsConnected(true);
      setReconnectAttempts(0);
      
      // Join branch room
      socketRef.current.emit('join-branch', branch._id);
      
      // Join specific rooms based on role
      if (['admin', 'chef'].includes(user.role)) {
        socketRef.current.emit('join-kitchen', branch._id);
      }
      
      if (['admin', 'manager', 'cashier'].includes(user.role)) {
        socketRef.current.emit('join-pos', branch._id);
      }
    });

    socketRef.current.on('disconnect', (reason) => {
      console.log('❌ Socket disconnected:', reason);
      setIsConnected(false);
    });

    socketRef.current.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      setIsConnected(false);
    });

    socketRef.current.on('reconnect_attempt', (attempt) => {
      setReconnectAttempts(attempt);
      console.log(`🔄 Socket reconnection attempt: ${attempt}`);
    });

    socketRef.current.on('reconnect', (attempt) => {
      console.log('✅ Socket reconnected after', attempt, 'attempts');
      setIsConnected(true);
    });

    setSocket(socketRef.current);

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        console.log('🔌 Socket disconnected on cleanup');
      }
    };
  }, [user, branch]);

  // Event handlers for different real-time events
  const onEvent = (event, callback) => {
    if (socket) {
      socket.on(event, callback);
    }
  };

  const offEvent = (event, callback) => {
    if (socket) {
      socket.off(event, callback);
    }
  };

  const emitEvent = (event, data) => {
    if (socket) {
      socket.emit(event, data);
    }
  };

  return {
    socket,
    isConnected,
    reconnectAttempts,
    onEvent,
    offEvent,
    emitEvent
  };
};