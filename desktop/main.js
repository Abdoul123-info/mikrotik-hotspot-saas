import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { networkInterfaces } from 'os';
import QRCode from 'qrcode';
import { startServer, stopServer } from '../mikrotik-proxy.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 400,
    height: 650,
    resizable: false,
    frame: true, // Keep frame for dragging/closing easily
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    backgroundColor: '#07090D'
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  
  // Remove menu bar
  mainWindow.setMenuBarVisibility(false);
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  stopServer(); // Ensure server stops when app closes
  if (process.platform !== 'darwin') app.quit();
});

// --- IPC HANDLERS ---

ipcMain.handle('start-server', async () => {
    try {
        await startServer(3001);
        return true;
    } catch (e) {
        console.error('Failed to start server:', e);
        return false;
    }
});

ipcMain.handle('stop-server', async () => {
    try {
        stopServer();
        return true;
    } catch (e) {
        return false;
    }
});

ipcMain.handle('get-network-info', () => {
    const nets = networkInterfaces();
    let ip = '127.0.0.1';
    
    // Trier les interfaces pour prioriser les cartes physiques (Wi-Fi, Ethernet)
    // et rejeter les cartes virtuelles (WSL, Docker, VirtualBox, vEthernet, etc.) à la fin
    const sortedInterfaces = Object.keys(nets).sort((a, b) => {
        const aLower = a.toLowerCase();
        const bLower = b.toLowerCase();
        
        const aIsVirtual = aLower.includes('virtual') || aLower.includes('wsl') || aLower.includes('docker') || aLower.includes('vbox') || aLower.includes('vmware') || aLower.includes('vethernet');
        const bIsVirtual = bLower.includes('virtual') || bLower.includes('wsl') || bLower.includes('docker') || bLower.includes('vbox') || bLower.includes('vmware') || bLower.includes('vethernet');
        
        const aIsPhysical = aLower.includes('wi-fi') || aLower.includes('wifi') || aLower.includes('wlan') || aLower.includes('ethernet') || aLower.includes('sans fil');
        const bIsPhysical = bLower.includes('wi-fi') || bLower.includes('wifi') || bLower.includes('wlan') || bLower.includes('ethernet') || bLower.includes('sans fil');
        
        if (aIsVirtual && !bIsVirtual) return 1;
        if (!aIsVirtual && bIsVirtual) return -1;
        if (aIsPhysical && !bIsPhysical) return -1;
        if (!aIsPhysical && bIsPhysical) return 1;
        return 0;
    });

    for (const name of sortedInterfaces) {
        for (const net of nets[name]) {
            // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
            if (net.family === 'IPv4' && !net.internal) {
                ip = net.address;
                return { ip };
            }
        }
    }
    return { ip };
});

ipcMain.handle('generate-qr', async (event, url) => {
    try {
        return await QRCode.toDataURL(url);
    } catch (err) {
        console.error(err);
        return '';
    }
});
