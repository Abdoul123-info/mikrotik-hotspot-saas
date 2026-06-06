const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    startServer: () => ipcRenderer.invoke('start-server'),
    stopServer: () => ipcRenderer.invoke('stop-server'),
    getNetworkInfo: () => ipcRenderer.invoke('get-network-info'),
    generateQR: (url) => ipcRenderer.invoke('generate-qr', url)
});
