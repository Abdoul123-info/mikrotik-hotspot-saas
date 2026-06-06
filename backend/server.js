import express from 'express';
import cors from 'cors';
import { RouterOSAPI } from 'node-routeros';
import { adminDb } from './firebaseAdmin.js';
import { requireAuth } from './middleware/auth.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { networkInterfaces } from 'os';
import QRCode from 'qrcode';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// 🔥 MONKEY-PATCH: prevent node-routeros from crashing on "!empty" replies
try {
    const { Channel } = await import('node-routeros/dist/Channel.js');
    if (Channel && Channel.prototype && Channel.prototype.onUnknown) {
        Channel.prototype.onUnknown = function(reply) {
            console.warn(`⚠️ Intercepted unknown reply type: "${reply}" (ignored to prevent crash)`);
            this.close(); // Cleanly close the channel instead of throwing
        };
        console.log('✅ node-routeros crash-protection patch applied.');
    }
} catch (e) {
    console.warn('⚠️ Could not apply crash-protection patch:', e.message);
}

// 🚀 Connection Pool and Caching
const connectionPool = new Map();
const responseCache = new Map();

const DEFAULT_CACHE_TTL = 30000;
const ENDPOINT_TTLS = {
  '/system/script': 60000,     
  '/ip/hotspot/user': 30000,   
  '/ip/hotspot/active': 10000,  
  '/system/resource': 10000,    
  '/interface/monitor-traffic': 2000, 
};

function getCacheKey(ip, endpoint, cmd, params, dateFilter) {
  return `${ip}:${endpoint}:${cmd}:${JSON.stringify(params)}:${dateFilter || 'none'}`;
}

async function getConnection(ip, username, password, port) {
    const key = `${username}@${ip}:${port}`;
    
    try {
        if (connectionPool.has(key)) {
            const existing = connectionPool.get(key);
            if (existing.connected) return existing;
            
            if (existing.lastError && Date.now() - existing.lastError < 5000) {
                throw new Error('Lockout: Attente de 5s avant nouvel essai.');
            }
        }

        console.log(`📡 [PROBE] Tentative de connexion TCP vers ${ip}:${port}...`);
        
        const conn = new RouterOSAPI({
            host: ip,
            user: username,
            password: password || '',
            port: parseInt(port) || 8728,
            timeout: 20,
            tls: port === '8729' ? { rejectUnauthorized: false } : false
        });

        const connPromise = conn.connect();
        
        const result = await Promise.race([
            connPromise,
            new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT_BRIDGE: Le routeur ne répond pas.')), 18000))
        ]);

        const errorHandler = (err) => {
            console.error(`🔌 [DISCONNECT] ${key}:`, err.message);
            connectionPool.delete(key);
            try { conn.close(); } catch(e) {}
        };

        conn.on('error', errorHandler);
        connectionPool.set(key, conn);
        console.log(`✅ [ESTABLISHED] Connexion réussie : ${key}`);
        return conn;
    } catch (err) {
        connectionPool.set(key, { connected: false, lastError: Date.now() });
        console.error(`❌ [FAILURE] @ ${ip}:${port} -> Error: ${err.message || err.code || 'UNKNOWN'}`);
        throw err;
    }
}

// Helper function: convert REST-style endpoint to RouterOS command
const endpointToCommand = (endpoint, method, data) => {
  const parts = endpoint.replace(/^\//, '').split('/');
  
  if (endpoint === '/interface/monitor-traffic') {
    return { cmd: '/interface/monitor-traffic', params: [`=interface=${data?.interface || 'ether1'}`, '=once='] };
  }

  const path = '/' + parts.join('/');
  let cmd = '';
  if (method === 'GET' || !method) cmd = `${path}/print`;
  else if (method === 'PUT') cmd = `${path}/add`;
  else if (method === 'DELETE') cmd = `${path}/remove`;
  else if (method === 'PATCH') cmd = `${path}/set`;
  else cmd = `${path}/print`;

  const params = data ? Object.entries(data).map(([k, v]) => {
    if (k.startsWith('?') || k.startsWith('&') || k.startsWith('#')) return `${k}=${v}`;
    return `=${k}=${v}`;
  }) : [];
  
  return { cmd, params };
};

// Get server network IP and QR code for mobile login access
app.get('/api/network-info', async (req, res) => {
  try {
    const nets = networkInterfaces();
    let ip = '127.0.0.1';
    
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
            if (net.family === 'IPv4' && !net.internal) {
                ip = net.address;
                break;
            }
        }
        if (ip !== '127.0.0.1') break;
    }

    const clientPort = req.query.port || PORT;
    const isDefaultPort = clientPort === '80' || clientPort === '443';
    const appUrl = isDefaultPort ? `http://${ip}` : `http://${ip}:${clientPort}`;
    const qrCodeDataUrl = await QRCode.toDataURL(appUrl);

    res.status(200).json({
      ip,
      port: clientPort,
      url: appUrl,
      qrCode: qrCodeDataUrl
    });
  } catch (error) {
    console.error('Failed to generate network info or QR code:', error);
    res.status(500).json({ error: 'Failed to retrieve network info.' });
  }
});

// Secure MikroTik Proxy - fetches router credentials from Firestore
app.post('/api/mikrotik', requireAuth, async (req, res) => {
  const { routerId, endpoint, method, data, dateFilter } = req.body;

  if (!routerId) return res.status(400).json({ error: 'routerId manquant.' });

  const start = Date.now();

  try {
    const routerDoc = await adminDb.collection('routers').doc(routerId).get();
    
    if (!routerDoc.exists) {
      return res.status(404).json({ error: 'Routeur introuvable.' });
    }

    const router = routerDoc.data();

    if (router.ownerId !== req.user.userId) {
      return res.status(403).json({ error: 'Accès refusé à ce routeur.' });
    }

    const apiPort = parseInt(router.port) || 8728;
    console.log(`📡 [User:${req.user.userId}] API:${apiPort} ${method || 'GET'} ${endpoint} @ ${router.ip}`);

    const conn = await getConnection(router.ip, router.login, router.password, apiPort);
    
    const cleanData = data ? { ...data } : {};
    let proplist = cleanData.proplist;
    delete cleanData.proplist; 

    if (!proplist && (endpoint.includes('/user') || endpoint.includes('/active')) && (method === 'GET' || !method)) {
        proplist = '.id,name,user,profile,comment,uptime,disabled,mac-address,address,bytes-in,bytes-out,session-time-left,idle-time';
    }

    const { cmd, params: baseParams } = endpointToCommand(endpoint, method, cleanData);
    
    let finalParams = [...baseParams];
    if (proplist) finalParams.push(`=.proplist=${proplist}`);
    
    const isReadOperation = method === 'GET' || !method || cmd.endsWith('/print') || (method === 'POST' && (endpoint.includes('print') || !['SET','PUT','PATCH','DELETE'].includes(method)));
    const cacheKey = getCacheKey(router.ip, endpoint, cmd, finalParams, dateFilter);

    if (isReadOperation && responseCache.has(cacheKey)) {
        const cachedEntry = responseCache.get(cacheKey);
        const specificTTL = ENDPOINT_TTLS[endpoint] || DEFAULT_CACHE_TTL;
        
        if (Date.now() - cachedEntry.timestamp < specificTTL) {
            const duration = Date.now() - start;
            console.log(`⚡ [CACHE HIT] ${endpoint} (${Math.round(specificTTL/1000)}s TTL) ${Array.isArray(cachedEntry.data) ? cachedEntry.data.length + ' items' : '1 item'} en ${duration}ms`);
            return res.status(200).json(cachedEntry.data);
        }
    }

    let result;
    try {
      if (cmd === '/system/script/print') {
          result = await new Promise((resolve, reject) => {
              const streamItems = [];
              const stream = conn.stream(cmd, finalParams);
              stream.on('data', pkt => streamItems.push(pkt));
              stream.on('trap', err => reject(new Error('RouterOS Trap: ' + JSON.stringify(err))));
              stream.on('done', () => resolve(streamItems));
              setTimeout(() => { if (!streamItems.length || streamItems.length < 50000) resolve(streamItems); }, 170000);
          });
      } else {
          result = await conn.write(cmd, finalParams);
      }
    } catch (writeErr) {
      if (writeErr.errno === 'UNKNOWNREPLY' || (writeErr.message && (writeErr.message.includes('!empty') || writeErr.message.includes('unknown reply')))) {
        const emptyResult = [];
        responseCache.set(cacheKey, { data: emptyResult, timestamp: Date.now() });
        return res.status(200).json(emptyResult);
      }
      
      const key = `${router.login}@${router.ip}:${apiPort}`;
      if (writeErr.message && (writeErr.message.includes('busy') || writeErr.message.includes('Timed out') || writeErr.message.includes('UNKNOWNREPLY'))) {
          connectionPool.delete(key);
          try { conn.close(); } catch(e) {}
      }
      throw writeErr;
    }

    let output = result;
    if (endpoint.endsWith('/resource') && Array.isArray(result)) output = result[0] || {};

    if (cmd === '/system/script/print' && Array.isArray(output)) {
      output = output.filter(s => s.name && s.name.includes('-|-'));
      if (dateFilter) {
        output = output.filter(s => s.name.startsWith(dateFilter));
      }
    }

    responseCache.set(cacheKey, {
        data: output,
        timestamp: Date.now()
    });

    const duration = Date.now() - start;
    console.log(`✅ ${endpoint} (${Array.isArray(output) ? output.length : '1'} items) en ${duration}ms`);

    res.status(200).json(output);

  } catch (error) {
    console.error(`❌ [Erreur RouterOS]`, error);
    let errMsg = 'Erreur inconnue';
    if (error.code === 'ETIMEDOUT' || error.errno === -4039 || (error.message && error.message.includes('ETIMEDOUT'))) {
      errMsg = "Le routeur est injoignable (Délai d'attente dépassé - ETIMEDOUT).";
    } else if (error.message && error.message !== 'RosException') {
      errMsg = error.message;
    } else if (error.trap) {
      errMsg = JSON.stringify(error.trap);
    }

    res.status(500).json({ 
      error: errMsg,
      tip: "Vérifiez l'adresse IP, votre connexion VPN, et assurez-vous que le routeur est allumé."
    });
  }
});

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: '🚀 MikroTik Hotspot SaaS Backend is running!' });
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 Backend SaaS MikroTik + Firebase (Port ${PORT})`);
  console.log(`   → Prêt pour accepter des connexions\n`);
});

server.timeout = 180000;
server.keepAliveTimeout = 180000;
