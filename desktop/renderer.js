// Renderer logic for Hotspot Manager Server

const btnToggle = document.getElementById('btn-toggle');
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const btnLabel = document.getElementById('btn-label');
const powerIcon = document.getElementById('power-icon');
const infoSection = document.getElementById('info-section');
const qrSection = document.getElementById('qr-section');
const ipAddressEl = document.getElementById('ip-address');
const qrCodeEl = document.getElementById('qr-code');

let isOnline = false;

btnToggle.addEventListener('click', async () => {
    if (!isOnline) {
        // Start Server
        const success = await window.electronAPI.startServer();
        if (success) {
            setOnline(true);
        }
    } else {
        // Stop Server
        const success = await window.electronAPI.stopServer();
        if (success) {
            setOnline(false);
        }
    }
});

function setOnline(online) {
    isOnline = online;
    if (online) {
        statusDot.classList.add('online');
        statusText.innerText = 'En ligne';
        statusText.style.color = '#00E5A0';
        btnToggle.classList.add('online');
        btnLabel.innerText = 'Stop';
        btnLabel.style.color = '#FFFFFF';
        powerIcon.style.color = '#00E5A0';
        infoSection.style.display = 'grid';
        qrSection.style.display = 'flex';
        
        // Fetch IP and update QR
        updateNetworkInfo();
    } else {
        statusDot.classList.remove('online');
        statusText.innerText = 'Hors ligne';
        statusText.style.color = 'rgba(255,255,255,0.4)';
        btnToggle.classList.remove('online');
        btnLabel.innerText = 'Start';
        btnLabel.style.color = 'rgba(255,255,255,0.4)';
        powerIcon.style.color = 'rgba(255,255,255,0.4)';
        infoSection.style.display = 'none';
        qrSection.style.display = 'none';
    }
}

async function updateNetworkInfo() {
    const info = await window.electronAPI.getNetworkInfo();
    ipAddressEl.innerText = info.ip;
    
    // Generate QR Code using the pre-installed qrcode library
    const url = `http://${info.ip}:3001`;
    const qrDataUrl = await window.electronAPI.generateQR(url);
    qrCodeEl.innerHTML = `<img src="${qrDataUrl}" width="120" height="120" />`;
}
