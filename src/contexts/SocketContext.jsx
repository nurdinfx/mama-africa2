import React, { createContext, useContext } from 'react';

const SocketContext = createContext();

const mockSocket = {
  connected: true,
  id: 'demo-socket',
  emit: (event, data) => {
    console.log('📤 Socket emit:', event, data);
    return true;
  },
  on: (event, callback) => {
    console.log('📥 Socket listening:', event);
    if (event === 'connect') {
      setTimeout(callback, 0);
    }
    return () => {}; // No-op unsubscribe
  },
  off: () => {},
  disconnect: () => {},
  connect: () => {}
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  return context || { 
    socket: mockSocket, 
    isConnected: true,
    emit: mockSocket.emit,
    on: mockSocket.on 
  };
};

export const SocketProvider = ({ children }) => {
  const socketValue = {
    socket: mockSocket,
    isConnected: true,
    emit: mockSocket.emit,
    on: mockSocket.on,
    off: mockSocket.off,
    disconnect: mockSocket.disconnect
  };

  return (
    <SocketContext.Provider value={socketValue}>
      {children}
    </SocketContext.Provider>
  );
};

export default SocketContext;
