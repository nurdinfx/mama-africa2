const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const isDev = !app.isPackaged; // Use app.isPackaged for reliable check
const { fork } = require('child_process');
const fs = require('fs');

let mainWindow;
let serverProcess;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
        },
        icon: path.join(__dirname, 'public/logo.png'), // Ensure icon exists
    });

    if (isDev) {
        mainWindow.loadURL('http://localhost:3000');
        mainWindow.webContents.openDevTools();
    } else {
        // In production, load the built index.html
        mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

const startServer = () => {
    const serverPath = path.join(__dirname, 'backend', 'server.js');

    if (!fs.existsSync(serverPath)) {
        console.error('Backend server file not found at:', serverPath);
        return;
    }

    // Use the same node executable running Electron (if possible) or system node
    // In production, you might bundle node or rely on system node. 
    // For simplicity here, we assume 'node' is in path or we fork.

    serverProcess = fork(serverPath, [], {
        stdio: 'inherit',
        env: {
            ...process.env,
            // Force backend ports or settings if needed
            PORT: 5000,
            NODE_ENV: isDev ? 'development' : 'production',
            // Fix for SQLite persistence in built app
            PERSISTENT_STORAGE_PATH: app.getPath('userData')
        }
    });

    serverProcess.on('error', (err) => {
        console.error('Failed to start server process:', err);
    });
};

app.whenReady().then(() => {
    startServer();
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', () => {
    if (serverProcess) {
        serverProcess.kill();
    }
});
