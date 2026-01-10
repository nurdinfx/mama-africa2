const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // Expose capabilities here if needed, 
    // currently frontend communicates with backend via HTTP/Socket.io
    // so strictly speaking possibly minimal needed.
    isElectron: true,
});
